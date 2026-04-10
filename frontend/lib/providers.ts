import { type MidnightProviders, type WalletProvider, type MidnightProvider, ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ProverKey, VerifierKey, ZKIR } from '@midnight-ntwrk/midnight-js-types';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { InMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import { VeilbookPrivateStateId, type VeilbookCircuits, type VeilbookProviders } from '../../veilbook-cli/src/common-types';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array =>
  new Uint8Array((hex.match(/.{1,2}/g) ?? []).map(byte => parseInt(byte, 16)));

const NETWORK_CONFIGS = {
  preview: {
    indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
  },
  preprod: {
    indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
  }
};

/**
 * Browser-compatible ZK config provider that fetches keys and ZKIR via HTTP
 * from the Next.js public directory. Extends the SDK's ZKConfigProvider so
 * getVerifierKeys(), get(), and asKeyMaterialProvider() work automatically.
 */
class FetchZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  constructor(private readonly baseUrl: string) {
    super();
  }

  private async fetchAsset(path: string): Promise<Uint8Array> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ZK asset: ${path} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    return this.fetchAsset(`${this.baseUrl}/zkir/${circuitId}.bzkir`) as unknown as Promise<ZKIR>;
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    return this.fetchAsset(`${this.baseUrl}/keys/${circuitId}.prover`) as unknown as Promise<ProverKey>;
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    return this.fetchAsset(`${this.baseUrl}/keys/${circuitId}.verifier`) as unknown as Promise<VerifierKey>;
  }
}

// We adapt the injected wallet API to the MidnightProvider and WalletProvider interfaces.
export const createBrowserProviders = (
  injectedWallet: any, // The connected DApp wallet API
  coinPublicKey: string,
  encryptionPublicKey: string,
  network: 'preview' | 'preprod' = 'preview'
): VeilbookProviders => {
  setNetworkId(network);
  const config = network === 'preview' ? NETWORK_CONFIGS.preview : NETWORK_CONFIGS.preprod;

  const privateStateProvider = new InMemoryPrivateStateProvider<typeof VeilbookPrivateStateId>();
  const publicDataProvider = indexerPublicDataProvider(config.indexer, config.indexerWS);

  // Fetch ZK config from Next.js public directory
  const zkConfigProvider = new FetchZkConfigProvider('/zk') as any;
  const proofProvider = httpClientProofProvider(config.proofServer, zkConfigProvider);

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
    balanceTx: async (tx: any, _ttl?: Date) => {
      try {
        const balanced = await injectedWallet.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx)) as any;
      } catch (err) {
        console.error("Wallet balanceUnsealedTransaction failed:", err);
        throw err;
      }
    }
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      try {
        const txId: string = tx.identifiers()[0];
        await injectedWallet.submitTransaction(toHex(tx.serialize()));
        return txId;
      } catch (err) {
        console.error("Wallet submitTransaction failed:", err);
        throw err;
      }
    }
  };

  return {
    privateStateProvider: privateStateProvider as any,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
};
