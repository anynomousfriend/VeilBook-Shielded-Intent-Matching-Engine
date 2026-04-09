import { buildWalletAndWaitForFunds, setLogger } from './api.js';
import { PreprodConfig } from './config.js';
import pino from 'pino';
import * as Rx from 'rxjs';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import fs from 'node:fs';
import path from 'node:path';

const logger = pino({
  level: 'info',
});

setLogger(logger);

const getSeedFromEnv = (): string | undefined => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return undefined;
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^MIDNIGHT_SEED=(.*)$/m);
    return match ? match[1].trim() : undefined;
  } catch {
    return undefined;
  }
};

async function checkBalance() {
  const config = new PreprodConfig();
  const seed = process.env.MIDNIGHT_SEED || getSeedFromEnv();
  
  if (!seed) {
    console.error('No MIDNIGHT_SEED found in .env or process.env');
    process.exit(1);
  }

  logger.info('Connecting to wallet and checking balances...');
  const walletCtx = await buildWalletAndWaitForFunds(config, seed);
  
  // Wait for sync and get state
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  
  const tokenKey = unshieldedToken().raw;
  const balance = state.unshielded.balances[tokenKey] ?? 0n;
  
  logger.info(`Total Unshielded Balance: ${balance} tNight`);
  
  if (balance < 400_000_000n) {
    logger.warn('Your balance is too low (~0.4 tNIGHT or less). Please request more tNIGHT from the faucet.');
    logger.info(`Your address: ${walletCtx.unshieldedKeystore.getAddress()}`);
  } else {
    logger.info('Balance looks sufficient for transaction fees.');
  }

  await walletCtx.wallet.stop();
  process.exit(0);
}

checkBalance().catch(console.error);
