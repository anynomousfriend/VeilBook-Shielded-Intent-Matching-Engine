import { buildWalletAndWaitForFunds, setLogger } from './src/api.js';
import { PreprodConfig } from './src/config.js';
import pino from 'pino';
import * as Rx from 'rxjs';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';

const logger = pino({ level: 'info' });
setLogger(logger);

async function run() {
  const config = new PreprodConfig();
  const seed = '91aa1d30794688d27b2560c037e42143943bef5c3d5a968c3ea209094e52c20e';
  const walletCtx = await buildWalletAndWaitForFunds(config, seed);
  
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  
  console.log('--- Unshielded Balances ---');
  for (const [key, value] of Object.entries(state.unshielded.balances)) {
    const isNight = key === unshieldedToken().raw ? '(tNIGHT)' : '';
    console.log(`Token ${key}: ${value} ${isNight}`);
  }
  
  console.log('Address:', walletCtx.unshieldedKeystore.getAddress());
  
  await walletCtx.wallet.stop();
  process.exit(0);
}

run().catch(console.error);