import { createLogger } from './logger-utils.js';
import { StandaloneConfig, currentDir } from './config.js';
import * as api from './api.js';
import { Veilbook } from '@midnight-ntwrk/veilbook-contract';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { DockerComposeEnvironment, Wait, StartedDockerComposeEnvironment } from 'testcontainers';
import path from 'node:path';

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, '');
};

async function runTest() {
  const config = new StandaloneConfig();
  const logger = await createLogger(config.logDir);
  api.setLogger(logger);

  console.log('Starting Docker environment...');
  const dockerEnv = new DockerComposeEnvironment(path.resolve(currentDir, '..'), 'standalone.yml')
    .withWaitStrategy('veilbook-proof-server', Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1))
    .withWaitStrategy('veilbook-indexer', Wait.forLogMessage(/starting indexing/, 1));
  const env = await dockerEnv.up();

  try {
    // MAP PORTS
    config.indexer = mapContainerPort(env, config.indexer, 'veilbook-indexer');
    config.indexerWS = mapContainerPort(env, config.indexerWS, 'veilbook-indexer');
    config.node = mapContainerPort(env, config.node, 'veilbook-node');
    config.proofServer = mapContainerPort(env, config.proofServer, 'veilbook-proof-server');

    console.log('Building wallet...');
    const walletCtx = await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);

    console.log('Configuring providers...');
    const providers = await api.configureProviders(walletCtx, config);

    const ownerBytes = await api.getCoinPublicKeyBytes(walletCtx);

    console.log('Deploying contract...');
    const contract = await api.deploy(providers, {}, ownerBytes);

    // Wait for wallet to process the deployment block (avoids stale UTXO / error 194)
    console.log('Waiting for wallet to sync deployment...');
    await api.waitForWalletRefresh(walletCtx.wallet);

    console.log('Submitting Order A (BUY 100 @ 50)...');
    const orderA: Veilbook.Order = { direction: 0n, price: 50n, size: 100n };
    const nonceA = generateRandomSeed();
    const resA = await api.submitOrder(providers, contract, orderA.direction, orderA.price, orderA.size, nonceA);

    console.log('Submitting Order B (SELL 100 @ 45)...');
    const orderB: Veilbook.Order = { direction: 1n, price: 45n, size: 100n };
    const nonceB = generateRandomSeed();
    const resB = await api.submitOrder(providers, contract, orderB.direction, orderB.price, orderB.size, nonceB);

    console.log('Matching Orders...');
    await api.matchOrders(providers, contract, orderA, nonceA, orderB, nonceB, resA.commitment, resB.commitment);

    console.log('Fetching status...');
    const status = await api.displayVeilbookStatus(providers, contract);
    console.log('Contract Match Count:', status.ledgerState?.match_count);

    console.log('SUCCESS! End-to-end execution verified.');
  } catch (e) {
    console.error('TEST FAILED:', e);
    process.exit(1);
  } finally {
    console.log('Shutting down docker...');
    await env.down();
  }
}

runTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
