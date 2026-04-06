const fs = require('fs');

let content = fs.readFileSync('cli.ts', 'utf-8');

// Replace the main menu options
const oldMenu = `  [1] Submit Order A
  [2] Submit Order B
  [3] Match Orders
  [4] Display Status
  [5] Monitor DUST
  [6] Exit`;

const newMenu = `  [1] Submit Order
  [2] Match Orders
  [3] Cancel Order
  [4] Display Status
  [5] Distribute Tokens
  [6] Monitor DUST
  [7] Exit`;

content = content.replace(oldMenu, newMenu);

// Update promptOrder to ask for direction
const oldPrompt = `  const priceStr = await rli.question('  Price (Uint<64>): ');
  const sizeStr = await rli.question('  Size (Uint<64>): ');`;

const newPrompt = `  const directionStr = await rli.question('  Direction (0=BUY, 1=SELL): ');
  const priceStr = await rli.question('  Price (Uint<64>): ');
  const sizeStr = await rli.question('  Size (Uint<64>): ');`;

content = content.replace(oldPrompt, newPrompt);

// Update promptOrder return
const oldPromptReturn = `  return {
    order: { direction: 0n, price: BigInt(priceStr), size: BigInt(sizeStr) },
    nonce: generateRandomSeed(),
  };`;

const newPromptReturn = `  return {
    order: { direction: BigInt(directionStr), price: BigInt(priceStr), size: BigInt(sizeStr) },
    nonce: generateRandomSeed(),
  };`;

content = content.replace(oldPromptReturn, newPromptReturn);

// We need to keep track of local orders to match/cancel them
const oldMainLoopVars = `  let orderA: Veilbook.Order | null = null;
  let aNonce: Uint8Array | null = null;
  let orderB: Veilbook.Order | null = null;
  let bNonce: Uint8Array | null = null;`;

const newMainLoopVars = `  // Store local orders with their commitments
  const localOrders: { order: Veilbook.Order, nonce: Uint8Array, commitment: Uint8Array }[] = [];
  
  // Get the user's unshielded address bytes for token operations
  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');`;

content = content.replace(oldMainLoopVars, newMainLoopVars);

// Rewrite the main loop switch statement
const oldSwitch = `      case '1': // Submit Order A
        try {
          const { order, nonce } = await promptOrder();
          const result = await api.withStatus('Submitting Order A', () =>
            api.submitOrderA(providers, veilbookContract, order.direction, order.price, order.size, nonce),
          );
          orderA = order;
          aNonce = nonce;
          logger.info(\`Order A submitted: \${result.txId}\`);
        } catch (e) {
          logger.error(\`Failed to submit Order A: \${e}\`);
        }
        break;
      case '2': // Submit Order B
        try {
          const { order, nonce } = await promptOrder();
          order.direction = 1n; // SELL
          const result = await api.withStatus('Submitting Order B', () =>
            api.submitOrderB(providers, veilbookContract, order.direction, order.price, order.size, nonce),
          );
          orderB = order;
          bNonce = nonce;
          logger.info(\`Order B submitted: \${result.txId}\`);
        } catch (e) {
          logger.error(\`Failed to submit Order B: \${e}\`);
        }
        break;
      case '3': // Match Orders
        if (!orderA || !orderB || !aNonce || !bNonce) {
          logger.error('You must submit both Order A and Order B before matching.');
          break;
        }
        try {
          await api.withStatus('Matching Orders', () =>
            api.matchOrders(providers, veilbookContract, orderA!, aNonce!, orderB!, bNonce!),
          );
          orderA = null;
          orderB = null;
          aNonce = null;
          bNonce = null;
        } catch (e) {
          logger.error(\`Failed to match orders: \${e}\`);
        }
        break;
      case '4': // Display Status
        try {
          await api.withStatus('Fetching status', () => api.displayVeilbookStatus(providers, veilbookContract));
        } catch (e) {
          logger.error(\`Failed to display status: \${e}\`);
        }
        break;
      case '5': // Monitor DUST
        try {
          let stopMonitor: () => void;
          const stopPromise = new Promise<void>((resolve) => {
            stopMonitor = resolve;
          });
          const keyPressHandler = () => {
            stopMonitor();
            process.stdin.removeListener('data', keyPressHandler);
          };
          process.stdin.on('data', keyPressHandler);
          logger.info('Monitoring DUST balance (Press Enter to return to menu)...');
          await api.monitorDustBalance(walletCtx.wallet, stopPromise);
        } catch (e) {
          logger.error(\`Monitor error: \${e}\`);
        }
        break;
      case '6': // Exit
        return;`;

const newSwitch = `      case '1': // Submit Order
        try {
          const { order, nonce } = await promptOrder();
          const result = await api.withStatus('Submitting Order', () =>
            api.submitOrder(providers, veilbookContract, order.direction, order.price, order.size, nonce),
          );
          // Store commitment locally for matching/cancelling
          const commitment = result.commitment;
          localOrders.push({ order, nonce, commitment });
          logger.info(\`Order submitted. Local ID: \${localOrders.length - 1}. Commitment: \${Buffer.from(commitment).toString('hex').slice(0, 16)}...\`);
        } catch (e) {
          logger.error(\`Failed to submit Order: \${e}\`);
        }
        break;
      case '2': // Match Orders
        if (localOrders.length < 2) {
          logger.error('You must have at least two local orders to match.');
          break;
        }
        try {
          const idxAStr = await rli.question('  Local ID of Order A (BUY): ');
          const idxBStr = await rli.question('  Local ID of Order B (SELL): ');
          const entryA = localOrders[parseInt(idxAStr, 10)];
          const entryB = localOrders[parseInt(idxBStr, 10)];
          
          if (!entryA || !entryB) {
            logger.error('Invalid local IDs.');
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
        } catch (e) {
          logger.error(\`Failed to match orders: \${e}\`);
        }
        break;
      case '3': // Cancel Order
        try {
          const idxStr = await rli.question('  Local ID of Order to cancel: ');
          const entry = localOrders[parseInt(idxStr, 10)];
          if (!entry) {
            logger.error('Invalid local ID.');
            break;
          }
          await api.withStatus('Cancelling Order', () =>
            api.cancelOrder(providers, veilbookContract, entry.order, entry.nonce, entry.commitment, myAddressBytes),
          );
        } catch (e) {
          logger.error(\`Failed to cancel order: \${e}\`);
        }
        break;
      case '4': // Display Status
        try {
          await api.withStatus('Fetching status', () => api.displayVeilbookStatus(providers, veilbookContract));
          
          // Display contract balance
          const balance = await api.withStatus('Fetching balance', () => api.getContractBalance(providers, veilbookContract));
          logger.info(\`Contract Balance: \${balance} tokens\`);

          // Display local orders
          logger.info(\`\\n--- Local Orders (\${localOrders.length}) ---\`);
          localOrders.forEach((o, i) => {
            logger.info(\`  [\${i}] DIR:\${o.order.direction} PRICE:\${o.order.price} SIZE:\${o.order.size} COMMIT:\${Buffer.from(o.commitment).toString('hex').slice(0, 16)}...\`);
          });
          logger.info('-----------------------\\n');

        } catch (e) {
          logger.error(\`Failed to display status: \${e}\`);
        }
        break;
      case '5': // Distribute Tokens
        try {
          const amount = BigInt(await rli.question('  Amount to distribute: '));
          await api.withStatus('Distributing tokens', () =>
            api.distributeTokens(providers, veilbookContract, amount, myAddressBytes),
          );
        } catch (e) {
          logger.error(\`Failed to distribute tokens: \${e}\`);
        }
        break;
      case '6': // Monitor DUST
        try {
          let stopMonitor: () => void;
          const stopPromise = new Promise<void>((resolve) => {
            stopMonitor = resolve;
          });
          const keyPressHandler = () => {
            stopMonitor();
            process.stdin.removeListener('data', keyPressHandler);
          };
          process.stdin.on('data', keyPressHandler);
          logger.info('Monitoring DUST balance (Press Enter to return to menu)...');
          await api.monitorDustBalance(walletCtx.wallet, stopPromise);
        } catch (e) {
          logger.error(\`Monitor error: \${e}\`);
        }
        break;
      case '7': // Exit
        return;`;

content = content.replace(oldSwitch, newSwitch);

// Need to update the generic imports just in case
const oldImports = `import { type FinalizedTxData, type WalletContext } from './api.js';
import * as api from './api.js';
import { type Config, StandaloneConfig } from './config.js';
import { type VeilbookProviders, type DeployedVeilbookContract } from './common-types.js';`;

const newImports = `import { type FinalizedTxData, type WalletContext } from './api.js';
import * as api from './api.js';
import { type Config, StandaloneConfig } from './config.js';
import { type VeilbookProviders, type DeployedVeilbookContract } from './common-types.js';
import { Veilbook } from '@midnight-ntwrk/veilbook-contract';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { Buffer } from 'buffer';`;

content = content.replace(oldImports, newImports);

// Fix double Veilbook imports if it happens
content = content.replace(/import { Veilbook } from '@midnight-ntwrk\/veilbook-contract';\nimport { Veilbook } from '@midnight-ntwrk\/veilbook-contract';/g, "import { Veilbook } from '@midnight-ntwrk/veilbook-contract';");
content = content.replace(/import { generateRandomSeed } from '@midnight-ntwrk\/wallet-sdk-hd';\nimport { generateRandomSeed } from '@midnight-ntwrk\/wallet-sdk-hd';/g, "import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';");
content = content.replace(/import { Buffer } from 'buffer';\nimport { Buffer } from 'buffer';/g, "import { Buffer } from 'buffer';");


fs.writeFileSync('cli.ts', content);
console.log("cli.ts updated.");
