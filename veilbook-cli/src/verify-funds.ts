import { configureProviders, buildWalletAndWaitForFunds, setLogger, joinContract, submitOrder } from './api.js';
import { PreprodConfig } from './config.js';
import pino from 'pino';

const logger = pino({ level: 'info' });
setLogger(logger);

async function run() {
  const config = new PreprodConfig();
  const seed = '0000000000000000000000000000000000000000000000000000000000000001';

  logger.info('Building wallet...');
  const walletCtx = await buildWalletAndWaitForFunds(config, seed);
  const providers = await configureProviders(walletCtx, config);

  const contractAddress = '8c3c33a4ce98c848b2f53b5a944c10781c53d72fe9fbf009ef93e5542e305cfe';
  logger.info(`Joining contract at ${contractAddress}...`);
  const contract = await joinContract(providers, contractAddress);

  logger.info('Submitting order...');
  const res = await submitOrder(providers, contract, 0n, 5000n, 100n);
  logger.info(`Order submitted successfully! Tx ID: ${res.txData.txId}`);

  await walletCtx.wallet.stop();
  process.exit(0);
}

run().catch(console.error);
