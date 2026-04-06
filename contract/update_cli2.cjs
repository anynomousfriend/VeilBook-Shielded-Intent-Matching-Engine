const fs = require('fs');
const path = require('path');

const cliPath = path.resolve('../veilbook-cli/src/cli.ts');
let content = fs.readFileSync(cliPath, 'utf-8');

const mainLoopStart = content.indexOf('const mainLoop = async');
const dockerMappingStart = content.indexOf('// ─── Docker Port Mapping ────────────────────────────────────────────────────');

if (mainLoopStart === -1 || dockerMappingStart === -1) {
  console.log("Could not find boundaries.");
  process.exit(1);
}

const beforeMainLoop = content.slice(0, mainLoopStart);
const afterMainLoop = content.slice(dockerMappingStart);

const newMainLoop = `const mainLoop = async (providers: VeilbookProviders, walletCtx: api.WalletContext, rli: Interface): Promise<void> => {
  const veilbookContract = await deployOrJoin(providers, walletCtx, rli);
  if (veilbookContract === null) {
    return;
  }

  // Store local orders with their commitments
  const localOrders: { order: Veilbook.Order, nonce: Uint8Array, commitment: Uint8Array }[] = [];
  
  // Get the user's unshielded address bytes for token operations
  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');

  const promptOrder = async (label: string): Promise<{ order: Veilbook.Order; nonce: Uint8Array }> => {
    console.log(\`\\n  --- \${label} ---\`);
    const directionStr = await rli.question('  Direction (BUY/SELL): ');
    const direction = directionStr.toUpperCase() === 'BUY' ? 0n : 1n;
    const price = BigInt(await rli.question('  Price: '));
    const size = BigInt(await rli.question('  Size: '));
    const nonce = generateRandomSeed();
    return { order: { direction, price, size }, nonce };
  };

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(veilbookMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const { order, nonce } = await promptOrder('Submit Order');
          const result = await api.withStatus('Submitting Order', () =>
            api.submitOrder(providers, veilbookContract, order.direction, order.price, order.size, nonce),
          );
          // Store commitment locally for matching/cancelling
          const commitment = result.commitment;
          localOrders.push({ order, nonce, commitment });
          console.log(\`  ✓ Order submitted. Local ID: \${localOrders.length - 1}. Commitment: \${Buffer.from(commitment).toString('hex').slice(0, 16)}...\\n\`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(\`  ✗ Failed to submit Order: \${msg}\\n\`);
        }
        break;
      case '2':
        if (localOrders.length < 2) {
          console.log('  ✗ Error: You must have at least two local orders to match.\\n');
          break;
        }
        try {
          const idxAStr = await rli.question('  Local ID of Order A (BUY): ');
          const idxBStr = await rli.question('  Local ID of Order B (SELL): ');
          const entryA = localOrders[parseInt(idxAStr, 10)];
          const entryB = localOrders[parseInt(idxBStr, 10)];
          
          if (!entryA || !entryB) {
            console.log('  ✗ Invalid local IDs.\\n');
            break;
          }

          // For v1, both buyer and seller are the same wallet (demo mode)
          await api.withStatus('Matching Orders', () =>
            api.matchOrders(
              providers, 
              veilbookContract, 
              entryA.order, 
              entryA.nonce, 
              entryB.order, 
              entryB.nonce, 
              entryA.commitment, 
              entryB.commitment,
              myAddressBytes,
              myAddressBytes,
            ),
          );
          console.log(\`  ✓ Orders matched.\\n\`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(\`  ✗ Failed to match orders: \${msg}\\n\`);
        }
        break;
      case '3':
        try {
          const idxStr = await rli.question('  Local ID of Order to cancel: ');
          const entry = localOrders[parseInt(idxStr, 10)];
          if (!entry) {
            console.log('  ✗ Invalid local ID.\\n');
            break;
          }
          await api.withStatus('Cancelling Order', () =>
            api.cancelOrder(providers, veilbookContract, entry.order, entry.nonce, entry.commitment, myAddressBytes),
          );
          console.log(\`  ✓ Order cancelled.\\n\`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(\`  ✗ Failed to cancel order: \${msg}\\n\`);
        }
        break;
      case '4':
        try {
          await api.displayVeilbookStatus(providers, veilbookContract);
          
          // Display contract balance
          const balance = await api.withStatus('Fetching balance', () => api.getContractBalance(providers, veilbookContract));
          console.log(\`\\n  Contract Balance: \${balance} tokens\\n\`);

          // Display local orders
          console.log(\`  --- Local Orders (\${localOrders.length}) ---\`);
          localOrders.forEach((o, i) => {
            console.log(\`  [\${i}] DIR:\${o.order.direction} PRICE:\${o.order.price} SIZE:\${o.order.size} COMMIT:\${Buffer.from(o.commitment).toString('hex').slice(0, 16)}...\`);
          });
          console.log('  -----------------------\\n');

        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(\`  ✗ Failed to display status: \${msg}\\n\`);
        }
        break;
      case '5':
        try {
          const amountStr = await rli.question('  Amount to distribute: ');
          const amount = BigInt(amountStr);
          await api.withStatus('Distributing tokens', () =>
            api.distributeTokens(providers, veilbookContract, amount, myAddressBytes),
          );
          console.log(\`  ✓ Tokens distributed.\\n\`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(\`  ✗ Failed to distribute tokens: \${msg}\\n\`);
        }
        break;
      case '6':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '7':
        return;
      default:
        console.log(\`  Invalid choice: \${choice}\\n\`);
    }
  }
};

`;

content = beforeMainLoop + newMainLoop + afterMainLoop;

fs.writeFileSync(cliPath, content);
console.log("cli.ts updated successfully.");
