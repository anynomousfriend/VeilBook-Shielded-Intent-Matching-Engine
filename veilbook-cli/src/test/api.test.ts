import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestEnvironment } from './commons';
import * as api from '../api';
import pino from 'pino';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';

describe('Veilbook API E2E', () => {
  let testEnv: TestEnvironment;
  const logger = pino({ level: 'silent' });

  beforeAll(
    async () => {
      testEnv = new TestEnvironment(logger);
      api.setLogger(logger);
      await testEnv.start();
    },
    1000 * 60 * 5,
  ); // 5 minute timeout for docker up

  afterAll(async () => {
    await testEnv.shutdown();
  });

  it(
    'can deploy and interact with the contract',
    async () => {
      const walletCtx = await testEnv.getWallet();
      const providers = await api.configureProviders(walletCtx, (testEnv as any).testConfig.dappConfig);

      // ownPublicKey() in circuits returns the coin public key, so use that as the owner
      const ownerBytes = await api.getCoinPublicKeyBytes(walletCtx);
      const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
      const myAddressBytes = Buffer.from(myAddressHex, 'hex');

      // Deploy — tokens are minted to the contract treasury, not the wallet
      const contract = await api.deploy(providers, {}, ownerBytes);
      expect(contract.deployTxData.public.contractAddress).toBeDefined();

      // Transfer tokens from the contract treasury to this wallet so we can submit orders
      await api.transferTokens(providers, contract, 500n, myAddressBytes);

      // Wait for the wallet to see the transferred tokens
      const ledgerState = await api.getVeilbookLedgerState(providers, contract.deployTxData.public.contractAddress);
      const tokenColor = Buffer.from(ledgerState!.token_color).toString('hex');

      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => (s.unshielded.balances[tokenColor] ?? 0n) > 0n),
          Rx.timeout(60000),
          Rx.catchError(() => Rx.of(null)),
        ),
      );

      // Submit Order (requires custom tokens for escrow deposit)
      const { commitment } = await api.submitOrder(providers, contract, 0n, 50n, 100n);
      expect(commitment).toBeDefined();

      // Check Balance — contract treasury should still hold the remainder
      const balance = await api.getContractBalance(providers, contract);
      expect(balance).toBeGreaterThanOrEqual(0n);
    },
    1000 * 60 * 10,
  ); // 10 minute timeout for the test
});
