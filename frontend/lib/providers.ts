import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type MidnightProviders, type WalletProvider, type MidnightProvider, type ProofProvider, type PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { InMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import { VeilbookPrivateStateId, type VeilbookCircuits, type VeilbookProviders } from '../../veilbook-cli/src/common-types';

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

class FetchZkConfigProvider {
  constructor(private readonly baseUrl: string) {}

  async getZkConfig(circuitId: string) {
    const [bzkirRes, proverRes, verifierRes] = await Promise.all([
      fetch(`${this.baseUrl}/zkir/${circuitId}.bzkir`),
      fetch(`${this.baseUrl}/keys/${circuitId}.prover`),
      fetch(`${this.baseUrl}/keys/${circuitId}.verifier`)
    ]);

    if (!bzkirRes.ok || !proverRes.ok || !verifierRes.ok) {
      throw new Error(`Failed to fetch ZK assets for circuit ${circuitId}`);
    }

    return {
      bzkir: new Uint8Array(await bzkirRes.arrayBuffer()),
      pk: new Uint8Array(await proverRes.arrayBuffer()),
      vk: new Uint8Array(await verifierRes.arrayBuffer())
    };
  }
}

// We adapt the injected wallet API to the MidnightProvider and WalletProvider interfaces.
export const createBrowserProviders = (
  injectedWallet: any, // The connected DApp wallet API
  coinPublicKey: string,
  encryptionPublicKey: string,
  network: 'preview' | 'preprod' = 'preview'
): VeilbookProviders => {
  const config = network === 'preview' ? NETWORK_CONFIGS.preview : NETWORK_CONFIGS.preprod;

  const privateStateProvider = new InMemoryPrivateStateProvider<typeof VeilbookPrivateStateId>();
  const publicDataProvider = indexerPublicDataProvider(config.indexer, config.indexerWS);

  // Fetch ZK config from Next.js public directory
  const zkConfigProvider = new FetchZkConfigProvider('/zk') as any;
  const proofProvider = httpClientProofProvider(config.proofServer, zkConfigProvider);

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
    balanceTx: async (tx: any, newCoins: any) => {
      const balanced = await injectedWallet.balanceUnsealedTransaction(tx.serialize());
      return { ...tx, serialize: () => balanced.tx } as any; 
    }
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      return injectedWallet.submitTransaction(tx.serialize());
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
