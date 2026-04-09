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

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { Veilbook, type VeilbookPrivateState, witnesses } from '@midnight-ntwrk/veilbook-contract';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import pino, { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import {
  type VeilbookCircuits,
  type VeilbookContract,
  VeilbookPrivateStateId,
  type VeilbookProviders,
  type DeployedVeilbookContract,
} from './common-types.js';
import { type Config, contractConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Buffer } from 'buffer';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';

let logger: Logger = pino({ level: 'silent' });

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

// Pre-compile the veilbook contract with ZK circuit assets
const veilbookCompiledContract = CompiledContract.make('veilbook', Veilbook.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

export const getVeilbookLedgerState = async (
  providers: VeilbookProviders,
  contractAddress: ContractAddress,
): Promise<Veilbook.Ledger | null> => {
  assertIsContractAddress(contractAddress);
  logger.info('Checking contract ledger state...');
  const state = (await providers.publicDataProvider.queryContractState(contractAddress).then((contractState) => {
    return contractState != null ? Veilbook.ledger(contractState.data) : null;
  })) as Veilbook.Ledger | null;
  logger.info(`Ledger state: ${JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
  return state;
};

export const veilbookContractInstance: VeilbookContract = new Veilbook.Contract(witnesses);

export const joinContract = async (
  providers: VeilbookProviders,
  contractAddress: string,
): Promise<DeployedVeilbookContract> => {
  const veilbookContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: veilbookCompiledContract,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: {},
  });
  logger.info(`Joined contract at address: ${veilbookContract.deployTxData.public.contractAddress}`);
  return veilbookContract;
};

export const deploy = async (
  providers: VeilbookProviders,
  privateState: VeilbookPrivateState,
  ownerAddr: Uint8Array,
  initialSupply: bigint = 1_000_000n,
): Promise<DeployedVeilbookContract> => {
  logger.info('Deploying veilbook contract...');
  const veilbookContract = await deployContract(providers, {
    compiledContract: veilbookCompiledContract,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: privateState,
    args: [initialSupply, { bytes: ownerAddr }],
  });
  logger.info(`Deployed contract at address: ${veilbookContract.deployTxData.public.contractAddress}`);
  return veilbookContract;
};

const updatePrivateState = async (
  providers: VeilbookProviders,
  address: string,
  state: Partial<VeilbookPrivateState>,
) => {
  providers.privateStateProvider.setContractAddress(address);
  const currentState = (await providers.privateStateProvider.get(VeilbookPrivateStateId)) ?? {};
  await providers.privateStateProvider.set(VeilbookPrivateStateId, {
    ...currentState,
    ...state,
  });
};

// Either<ContractAddress, UserAddress> helper — `right` wraps a UserAddress
type EitherAddress = {
  is_left: boolean;
  left: { bytes: Uint8Array };
  right: { bytes: Uint8Array };
};

const userAddress = (bytes: Uint8Array): EitherAddress => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes },
});

export const submitOrder = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  direction: bigint,
  price: bigint,
  size: bigint,
  nonce?: Uint8Array,
): Promise<{ txData: FinalizedTxData; commitment: Uint8Array }> => {
  logger.info('Submitting order...');
  const orderNonce = nonce ?? generateRandomSeed();
  const address = contract.deployTxData.public.contractAddress;
  const order: Veilbook.Order = { direction, price, size };
  await updatePrivateState(providers, address, {
    submitOrder: { order, nonce: orderNonce },
  });

  const finalizedTxData = await contract.callTx.submit_order(size);
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  // Circuit returns Bytes<32> (the commitment) — available on private.result
  const commitment = finalizedTxData.private.result as Uint8Array;
  return { txData: finalizedTxData.public, commitment };
};

export const matchOrders = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  orderA: Veilbook.Order,
  aNonce: Uint8Array,
  orderB: Veilbook.Order,
  bNonce: Uint8Array,
  commitA: Uint8Array,
  commitB: Uint8Array,
  buyerAddr: Uint8Array,
  sellerAddr: Uint8Array,
): Promise<FinalizedTxData> => {
  logger.info('Matching orders...');
  const address = contract.deployTxData.public.contractAddress;
  await updatePrivateState(providers, address, {
    matchOrderA: { order: orderA, nonce: aNonce },
    matchOrderB: { order: orderB, nonce: bNonce },
    matchBuyerAddress: userAddress(buyerAddr),
    matchSellerAddress: userAddress(sellerAddr),
  });

  const finalizedTxData = await contract.callTx.match_orders(commitA, commitB);
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const cancelOrder = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  order: Veilbook.Order,
  nonce: Uint8Array,
  commitment: Uint8Array,
  refundAddr: Uint8Array,
): Promise<FinalizedTxData> => {
  logger.info('Cancelling order...');
  const address = contract.deployTxData.public.contractAddress;
  await updatePrivateState(providers, address, {
    cancelOrder: { order, nonce },
    cancelUserAddress: userAddress(refundAddr),
  });

  const finalizedTxData = await contract.callTx.cancel_order(commitment);
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const getContractBalance = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
): Promise<bigint> => {
  const finalizedTxData = await contract.callTx.get_balance();
  // Circuit returns Uint<128> — available on private.result
  return finalizedTxData.private.result as bigint;
};

export const transferTokens = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  amount: bigint,
  recipientAddr: Uint8Array,
): Promise<FinalizedTxData> => {
  logger.info(`Transferring ${amount} tokens...`);
  const finalizedTxData = await contract.callTx.transfer_tokens(amount, { bytes: recipientAddr });
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const displayVeilbookStatus = async (
  providers: VeilbookProviders,
  veilbookContract: DeployedVeilbookContract,
): Promise<{ contractAddress: string; ledgerState: Veilbook.Ledger | null }> => {
  const contractAddress = veilbookContract.deployTxData.public.contractAddress;
  const ledgerState = await getVeilbookLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no veilbook contract deployed at ${contractAddress}.`);
  } else {
    logger.info(`Match Count: ${ledgerState.match_count}`);
    logger.info(`Token Color: ${Buffer.from(ledgerState.token_color).toString('hex')}`);
    const orderCount = ledgerState.orders_state.size();
    logger.info(`Orders in state map: ${orderCount}`);
    for (const [key, state] of ledgerState.orders_state) {
      const commitHex = Buffer.from(key).toString('hex').slice(0, 16) + '...';
      logger.info(`  ${commitHex} → ${Veilbook.State[state]}`);
    }
  }
  return { contractAddress, ledgerState };
};

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map(
        (s) =>
          (s.unshielded?.balances[unshieldedToken().raw] ?? 0n) + (s.shielded?.balances[unshieldedToken().raw] ?? 0n),
      ),
      Rx.filter((balance) => balance > 0n),
    ),
  );

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (seed: string, state: any, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();

  const DIV = '──────────────────────────────────────────────────────────────';

  console.log(
    `\n${DIV}\n  Wallet Overview                            Network: ${networkId}\n${DIV}\n  Seed: ${seed}\n${DIV}\n\n  Shielded (ZSwap)\n  └─ Address: ${shieldedAddress}\n\n  Unshielded\n  ├─ Address: ${unshieldedKeystore.getBech32Address()}\n  └─ Balance: ${formatBalance(unshieldedBalance)} tNight\n\n  Dust\n  └─ Address: ${MidnightBech32m.encode(networkId, state.dust.address).toString()}\n\n${DIV}`,
  );
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');

  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    'Building wallet',
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

      const walletConfig = {
        ...buildShieldedConfig(config),
        ...buildUnshieldedConfig(config),
        ...buildDustConfig(config),
      };
      const wallet = await WalletFacade.init({
        configuration: walletConfig,
        shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
        unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
        dust: (cfg) =>
          DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
      });
      await wallet.start(shieldedSecretKeys, dustSecretKey);

      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );

  const networkId = getNetworkId();
  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(
    `\n${DIV}\n  Wallet Overview                            Network: ${networkId}\n${DIV}\n  Seed: ${seed}\n\n  Unshielded Address (send tNight here):\n  ${unshieldedKeystore.getBech32Address()}\n\n  Fund your wallet with tNight from the Preprod faucet:\n  https://faucet.preprod.midnight.network/\n${DIV}\n`,
  );

  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));

  printWalletSummary(seed, syncedState, unshieldedKeystore);

  const balance =
    (syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n) +
    (syncedState.shielded.balances[unshieldedToken().raw] ?? 0n);
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

export const getCoinPublicKeyBytes = async (ctx: WalletContext): Promise<Uint8Array> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return Buffer.from(state.shielded.coinPublicKey.toHexString(), 'hex');
};

export const configureProviders = async (ctx: WalletContext, config: Config) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<VeilbookCircuits>(contractConfig.zkConfigPath);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${accountId}!A`;
  return {
    privateStateProvider: levelPrivateStateProvider<typeof VeilbookPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.balance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};

export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => {
    stopped = true;
  });

  const sub = wallet
    .state()
    .pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
    )
    .subscribe((state) => {
      if (stopped) return;

      const now = new Date();
      const available = state.dust.balance(now);
      const availableCoins = state.dust.availableCoins.length;
      const pendingCoins = state.dust.pendingCoins.length;

      const registeredNight = state.unshielded.availableCoins.filter(
        (coin: any) => coin.meta?.registeredForDustGeneration !== true,
      ).length;
      const totalNight = state.unshielded.availableCoins.length;

      let status = '';
      if (pendingCoins > 0 && availableCoins === 0) {
        status = '⚠ locked by pending tx';
      } else if (available > 0n) {
        status = '✓ ready to deploy';
      } else if (availableCoins > 0) {
        status = 'accruing...';
      } else if (registeredNight > 0) {
        status = 'waiting for generation...';
      } else {
        status = 'no NIGHT registered';
      }

      const time = now.toLocaleTimeString();
      console.log(
        `  [${time}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`,
      );
    });

  await stopSignal;
  sub.unsubscribe();
};

export function setLogger(_logger: Logger) {
  logger = _logger;
}
