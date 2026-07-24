export interface RelayPeerInfo {
  walletAddress: string;
  encryptionPubKey: JsonWebKey;
  signingPubKey: JsonWebKey;
}

export interface RelayOrderData {
  direction: 'BUY' | 'SELL';
  price: string;
  size: string;
  nonce: string;
  commitment: string;
  walletAddress: string;
  blockHeight: number;
  order: {
    direction: string;
    price: string;
    size: string;
  };
  offerFile?: any;
}

export type RelayMessage =
  | { type: 'ROOM_STATE'; peers: RelayPeerInfo[]; peerCount: number }
  | {
      type: 'PEER_JOINED';
      walletAddress: string;
      encryptionPubKey: JsonWebKey;
      signingPubKey: JsonWebKey;
      peerCount: number;
    }
  | { type: 'PEER_LEFT'; walletAddress: string; peerCount: number }
  | {
      type: 'ORDER_SUBMITTED';
      sender: string;
      protocolVersion: number;
      payload: string;
    }
  | {
      type: 'MATCH_ATTEMPTED' | 'MATCH_CONFIRMED' | 'MATCH_FAILED';
      sender: string;
      protocolVersion: number;
      payload: string;
    };

export type RelayEventHandler = (msg: RelayMessage) => void;

export class RelayClient {
  private ws: WebSocket | null = null;
  private handlers: Set<RelayEventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private contractAddress: string | null = null;
  private walletAddress: string | null = null;
  private encryptionPubKey: JsonWebKey | null = null;
  private signingPubKey: JsonWebKey | null = null;

  constructor(private url: string) {}

  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[relay-client] Connected to relay');
      if (
        this.contractAddress &&
        this.walletAddress &&
        this.encryptionPubKey &&
        this.signingPubKey
      ) {
        this.send({
          type: 'JOIN',
          contractAddress: this.contractAddress,
          walletAddress: this.walletAddress,
          protocolVersion: 1,
          encryptionPubKey: this.encryptionPubKey,
          signingPubKey: this.signingPubKey,
        });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: RelayMessage = JSON.parse(event.data as string);
        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      console.log('[relay-client] Disconnected, reconnecting in 3s...');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
  }

  join(
    contractAddress: string,
    walletAddress: string,
    encryptionPubKey: JsonWebKey,
    signingPubKey: JsonWebKey,
  ): void {
    this.contractAddress = contractAddress;
    this.walletAddress = walletAddress;
    this.encryptionPubKey = encryptionPubKey;
    this.signingPubKey = signingPubKey;
    this.send({
      type: 'JOIN',
      contractAddress,
      walletAddress,
      protocolVersion: 1,
      encryptionPubKey,
      signingPubKey,
    });
  }

  publishEncryptedOrder(sender: string, payload: string): void {
    this.send({
      type: 'ORDER_SUBMITTED',
      sender,
      protocolVersion: 1,
      payload,
    });
  }

  publishMatchAttempt(sender: string, payload: string): void {
    this.send({
      type: 'MATCH_ATTEMPTED',
      sender,
      protocolVersion: 1,
      payload,
    });
  }

  publishMatchConfirmed(sender: string, payload: string): void {
    this.send({
      type: 'MATCH_CONFIRMED',
      sender,
      protocolVersion: 1,
      payload,
    });
  }

  publishMatchFailed(sender: string, payload: string): void {
    this.send({
      type: 'MATCH_FAILED',
      sender,
      protocolVersion: 1,
      payload,
    });
  }

  onMessage(handler: RelayEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}
