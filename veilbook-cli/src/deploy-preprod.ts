import { deploy, configureProviders, buildWalletAndWaitForFunds, getCoinPublicKeyBytes, setLogger } from './api.js';
import { PreprodConfig } from './config.js';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

setLogger(logger);

async function run() {
  const config = new PreprodConfig();

  // Use a fixed seed for the deployer if provided in env, otherwise generate one
  const seed = process.env.DEPLOYER_SEED || '0000000000000000000000000000000000000000000000000000000000000001';

  logger.info('Starting deployment on Preprod...');

  const walletCtx = await buildWalletAndWaitForFunds(config, seed);
  const providers = await configureProviders(walletCtx, config);

  const ownerBytes = await getCoinPublicKeyBytes(walletCtx);
  const deployedContract = await deploy(providers, {}, ownerBytes);
  const address = deployedContract.deployTxData.public.contractAddress;

  logger.info(`SUCCESS: Veilbook contract deployed at: ${address}`);

  // Save the address to a file for the interaction scripts
  const addressFile = path.resolve(process.cwd(), 'deployed-address.txt');
  fs.writeFileSync(addressFile, address);
  logger.info(`Address saved to ${addressFile}`);

  await walletCtx.wallet.stop();
}

run().catch((err) => {
  logger.error(err);
  process.exit(1);
});
