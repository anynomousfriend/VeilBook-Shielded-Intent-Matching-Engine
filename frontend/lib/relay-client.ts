export interface RelayOrderData {
  direction: 'BUY' | 'SELL';
  price: string;
  size: string;
  nonce: string;
  commitment: string;
  walletAddress: string;
  blockHeight: number;
  order: { direction: string; price: string; size: string };
}

export type RelayMessage =
  | { type: 'PEER_JOINED'; walletAddress: string; peerCount: number }
  | { type: 'PEER_LEFT'; walletAddress: string; peerCount: number }
  | { type: 'ORDER_SUBMITTED'; data: RelayOrderData }
  | { type: 'MATCH_ATTEMPTED'; by: string }
  | { type: 'MATCH_CONFIRMED'; blockHeight: number; by: string }
  | { type: 'MATCH_FAILED'; reason: string; by: string };

export type RelayEventHandler = (msg: RelayMessage) => void;

export class RelayClient {
  private ws: WebSocket | null = null;
  private handlers: Set<RelayEventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private contractAddress: string | null = null;
  private walletAddress: string | null = null;

  constructor(private url: string) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[relay-client] Connected to relay');
      // Re-join room if we were in one
      if (this.contractAddress && this.walletAddress) {
        this.send({ type: 'JOIN', contractAddress: this.contractAddress, walletAddress: this.walletAddress });
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

  join(contractAddress: string, walletAddress: string): void {
    this.contractAddress = contractAddress;
    this.walletAddress = walletAddress;
    this.send({ type: 'JOIN', contractAddress, walletAddress });
  }

  publishOrder(data: RelayOrderData): void {
    this.send({ type: 'ORDER_SUBMITTED', data });
  }

  publishMatchAttempt(walletAddress: string): void {
    this.send({ type: 'MATCH_ATTEMPTED', by: walletAddress });
  }

  publishMatchConfirmed(blockHeight: number, walletAddress: string): void {
    this.send({ type: 'MATCH_CONFIRMED', blockHeight, by: walletAddress });
  }

  publishMatchFailed(reason: string, walletAddress: string): void {
    this.send({ type: 'MATCH_FAILED', reason, by: walletAddress });
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
