// This file is part of midnightntwrk/veilbook.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { type WalletContext } from './api';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';
import { type StartedDockerComposeEnvironment, type DockerComposeEnvironment } from 'testcontainers';
import { type VeilbookProviders, type DeployedVeilbookContract } from './common-types';
import { type Config, StandaloneConfig } from './config';
import * as api from './api';
import { Veilbook } from '@midnight-ntwrk/veilbook-contract';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node.
 * Only used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

// ─── Display Helpers ────────────────────────────────────────────────────────

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              Veilbook Shielded Dark Pool                     ║
║              ──────────────────────────                      ║
║              A privacy-preserving order book demo            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const DIVIDER = '──────────────────────────────────────────────────────────────';

// ─── Menu Helpers ──────────────────────────────────────────────────────────

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${'─'.repeat(62)}
> `;

/** Build the contract actions menu, showing current DUST balance in the header. */
const contractMenu = (dustBalance: string) => `
${DIVIDER}
  Contract Actions${dustBalance ? `                    DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Deploy a new Veilbook contract
  [2] Join an existing Veilbook contract
  [3] Monitor DUST balance
  [4] Exit
${'─'.repeat(62)}
> `;

/** Build the veilbook actions menu, showing current DUST balance in the header. */
const veilbookMenu = (dustBalance: string) => `
${DIVIDER}
  Veilbook Actions${dustBalance ? `                     DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Submit Order
  [2] Match Orders
  [3] Cancel Order
  [4] Display Status
  [5] Monitor DUST
  [6] Transfer Tokens
  [7] Exit
${'─'.repeat(62)}
> `;

// ─── Wallet Setup ───────────────────────────────────────────────────────────

/** Prompt the user for a seed phrase and restore a wallet from it. */
const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await api.buildWalletAndWaitForFunds(config, seed);
};

/**
 * Wallet creation flow.
 * - Standalone configs skip the menu and use the genesis seed automatically.
 * - All other configs present a menu to create or restore a wallet.
 */
const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  // Standalone mode: use the pre-funded genesis wallet
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }

  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

// ─── Contract Interaction ───────────────────────────────────────────────────

/** Format dust balance for menu headers. */
const getDustLabel = async (wallet: api.WalletContext['wallet']): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.available.toLocaleString();
  } catch {
    return '';
  }
};

/** Prompt for a contract address and join an existing deployed contract. */
const joinContract = async (providers: VeilbookProviders, rli: Interface): Promise<DeployedVeilbookContract> => {
  const contractAddress = await rli.question('Enter the contract address (hex): ');
  return await api.joinContract(providers, contractAddress);
};

/**
 * Start the DUST monitor. Shows a live-updating balance display
 * that runs until the user presses Enter.
 */
const startDustMonitor = async (wallet: api.WalletContext['wallet'], rli: Interface): Promise<void> => {
  console.log('');
  // Use readline question to wait for Enter — the monitor will render above this line
  const stopPromise = rli.question('  Press Enter to return to menu...\n').then(() => {});
  await api.monitorDustBalance(wallet, stopPromise);
  console.log('');
};

/**
 * Deploy or join flow. Returns the contract handle, or null if the user exits.
 * Errors during deploy/join are caught and displayed — the user stays in the menu.
 */
const deployOrJoin = async (
  providers: VeilbookProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedVeilbookContract | null> => {
  const ownerBytes = await api.getCoinPublicKeyBytes(walletCtx);
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const contract = await api.withStatus('Deploying Veilbook contract', () =>
            api.deploy(providers, {}, ownerBytes),
          );
          console.log(`  Contract deployed at: ${contract.deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  ✗ Deploy failed: ${msg}`);
          // Log the full cause chain to help debug WASM/ledger errors
          if (e instanceof Error && e.cause) {
            let cause: unknown = e.cause;
            let depth = 0;
            while (cause && depth < 5) {
              const causeMsg =
                cause instanceof Error
                  ? `${cause.message}\n      ${cause.stack?.split('\n').slice(1, 3).join('\n      ') ?? ''}`
                  : String(cause);
              console.log(`    cause: ${causeMsg}`);
              cause = cause instanceof Error ? cause.cause : undefined;
              depth++;
            }
          }
          if (msg.toLowerCase().includes('dust') || msg.toLowerCase().includes('no dust')) {
            console.log('    Insufficient DUST for transaction fees. Use option [3] to monitor your balance.');
          }
          console.log('');
        }
        break;
      case '2':
        try {
          return await joinContract(providers, rli);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to join contract: ${msg}\n`);
        }
        break;
      case '3':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '4':
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

/**
 * Main interaction loop. Once a contract is deployed/joined, the user
 * can submit orders or match them.
 */
const mainLoop = async (providers: VeilbookProviders, walletCtx: api.WalletContext, rli: Interface): Promise<void> => {
  const veilbookContract = await deployOrJoin(providers, walletCtx, rli);
  if (veilbookContract === null) {
    return;
  }

  // Store local orders with their commitments
  const localOrders: { order: Veilbook.Order; nonce: Uint8Array; commitment: Uint8Array }[] = [];

  // Get the user's unshielded address bytes for token operations
  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');

  const promptOrder = async (label: string): Promise<{ order: Veilbook.Order; nonce: Uint8Array }> => {
    console.log(`\n  --- ${label} ---`);
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
          console.log(
            `  ✓ Order submitted. Local ID: ${localOrders.length - 1}. Commitment: ${Buffer.from(commitment).toString('hex').slice(0, 16)}...\n`,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to submit Order: ${msg}\n`);
        }
        break;
      case '2':
        if (localOrders.length < 2) {
          console.log('  ✗ Error: You must have at least two local orders to match.\n');
          break;
        }
        try {
          const idxAStr = await rli.question('  Local ID of Order A (BUY): ');
          const idxBStr = await rli.question('  Local ID of Order B (SELL): ');
          const entryA = localOrders[parseInt(idxAStr, 10)];
          const entryB = localOrders[parseInt(idxBStr, 10)];

          if (!entryA || !entryB) {
            console.log('  ✗ Invalid local IDs.\n');
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
          console.log(`  ✓ Orders matched.\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to match orders: ${msg}\n`);
        }
        break;
      case '3':
        try {
          const idxStr = await rli.question('  Local ID of Order to cancel: ');
          const entry = localOrders[parseInt(idxStr, 10)];
          if (!entry) {
            console.log('  ✗ Invalid local ID.\n');
            break;
          }
          await api.withStatus('Cancelling Order', () =>
            api.cancelOrder(providers, veilbookContract, entry.order, entry.nonce, entry.commitment, myAddressBytes),
          );
          console.log(`  ✓ Order cancelled.\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to cancel order: ${msg}\n`);
        }
        break;
      case '4':
        try {
          await api.displayVeilbookStatus(providers, veilbookContract);

          // Display contract balance
          const balance = await api.withStatus('Fetching balance', () =>
            api.getContractBalance(providers, veilbookContract),
          );
          console.log(`\n  Contract Balance: ${balance} tokens\n`);

          // Display local orders
          console.log(`  --- Local Orders (${localOrders.length}) ---`);
          localOrders.forEach((o, i) => {
            console.log(
              `  [${i}] DIR:${o.order.direction} PRICE:${o.order.price} SIZE:${o.order.size} COMMIT:${Buffer.from(o.commitment).toString('hex').slice(0, 16)}...`,
            );
          });
          console.log('  -----------------------\n');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to display status: ${msg}\n`);
        }
        break;

      case '5':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '6':
        try {
          const amountStr = await rli.question('  Amount to transfer: ');
          const recipientInput = await rli.question('  Recipient address (hex or mn_addr...): ');
          const amount = BigInt(amountStr);

          let recipientBytes: Uint8Array;
          if (recipientInput.startsWith('mn_addr')) {
            const parsed = MidnightBech32m.parse(recipientInput);
            // UnshieldedAddress wraps a Uint8Array exposed via `.data`
            const decoded = parsed.decode(UnshieldedAddress, getNetworkId()) as unknown as { data: Uint8Array };
            recipientBytes = new Uint8Array(decoded.data);
          } else {
            recipientBytes = Buffer.from(recipientInput.replace(/^0x/, ''), 'hex');
          }

          await api.withStatus(`Transferring ${amount} tokens`, () =>
            api.transferTokens(providers, veilbookContract, amount, recipientBytes),
          );
          console.log(`  ✓ Tokens transferred.\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to transfer tokens: ${msg}\n`);
        }
        break;
      case '7':
        return;
      default:
        console.log(`  Invalid choice: ${choice}\n`);
    }
  }
};

// ─── Docker Port Mapping ────────────────────────────────────────────────────

/** Map a container's first exposed port into the config URL. */
const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, '');
};

// ─── Entry Point ────────────────────────────────────────────────────────────

/**
 * Main entry point for the CLI.
 *
 * Flow:
 *   1. (Optional) Start Docker containers for proof server / node / indexer
 *   2. Build or restore a wallet and wait for it to be funded
 *   3. Configure midnight-js providers (proof server, indexer, wallet, private state)
 *   4. Enter the contract deploy/join and veilbook interaction loop
 *   5. Clean up: close wallet, readline, and docker environment
 */
export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);

  // Print the title banner
  console.log(BANNER);

  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    // Step 1: Start Docker environment if provided (e.g. local proof server)
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();

      // In standalone mode, remap ports to the dynamically assigned container ports
      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, 'veilbook-indexer');
        config.indexerWS = mapContainerPort(env, config.indexerWS, 'veilbook-indexer');
        config.node = mapContainerPort(env, config.node, 'veilbook-node');
        config.proofServer = mapContainerPort(env, config.proofServer, 'veilbook-proof-server');
      }
    }

    // Step 2: Build wallet (create new or restore from seed)
    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) {
      return;
    }

    try {
      // Step 3: Configure midnight-js providers
      const providers = await api.withStatus('Configuring providers', () => api.configureProviders(walletCtx, config));
      console.log('');

      // Step 4: Enter the contract interaction loop
      await mainLoop(providers, walletCtx, rli);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error: ${e.message}`);
        logger.debug(`${e.stack}`);
      } else {
        throw e;
      }
    } finally {
      // Step 5a: Stop the wallet
      try {
        await walletCtx.wallet.stop();
      } catch (e) {
        logger.error(`Error stopping wallet: ${e}`);
      }
    }
  } finally {
    // Step 5b: Close readline and Docker environment
    rli.close();
    rli.removeAllListeners();

    if (env !== undefined) {
      try {
        await env.down();
      } catch (e) {
        logger.error(`Error shutting down docker environment: ${e}`);
      }
    }

    logger.info('Goodbye.');
  }
};
