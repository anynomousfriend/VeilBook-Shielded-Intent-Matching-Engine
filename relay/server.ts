import { WebSocketServer, WebSocket } from 'ws';

// --- Message types ---

interface JoinMessage {
  type: 'JOIN';
  contractAddress: string;
  walletAddress: string;
}

interface OrderSubmittedMessage {
  type: 'ORDER_SUBMITTED';
  data: {
    direction: 'BUY' | 'SELL';
    price: string;
    size: string;
    nonce: string;
    commitment: string;
    walletAddress: string;
    blockHeight: number;
    order: { direction: string; price: string; size: string };
  };
}

interface MatchAttemptedMessage {
  type: 'MATCH_ATTEMPTED';
  by: string;
}

interface MatchConfirmedMessage {
  type: 'MATCH_CONFIRMED';
  blockHeight: number;
  by: string;
}

interface MatchFailedMessage {
  type: 'MATCH_FAILED';
  reason: string;
  by: string;
}

type ClientMessage =
  | JoinMessage
  | OrderSubmittedMessage
  | MatchAttemptedMessage
  | MatchConfirmedMessage
  | MatchFailedMessage;

// --- Room management ---

interface ClientInfo {
  walletAddress: string;
  room: string;
}

const rooms = new Map<string, Map<WebSocket, ClientInfo>>();
const clientRooms = new Map<WebSocket, string>();

function broadcast(room: string, message: object, exclude?: WebSocket) {
  const clients = rooms.get(room);
  if (!clients) return;
  const payload = JSON.stringify(message);
  for (const [ws] of clients) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastAll(room: string, message: object) {
  const clients = rooms.get(room);
  if (!clients) return;
  const payload = JSON.stringify(message);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function removeFromRoom(ws: WebSocket) {
  const room = clientRooms.get(ws);
  if (!room) return;

  const clients = rooms.get(room);
  if (!clients) return;

  const info = clients.get(ws);
  clients.delete(ws);
  clientRooms.delete(ws);

  if (clients.size === 0) {
    rooms.delete(room);
  } else if (info) {
    broadcast(room, {
      type: 'PEER_LEFT',
      walletAddress: info.walletAddress,
      peerCount: clients.size,
    });
  }
}

// --- Server ---

const PORT = parseInt(process.env.RELAY_PORT || '4400');
const wss = new WebSocketServer({ port: PORT });

console.log(`[relay] Veilbook relay server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('[relay] New connection');

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'JOIN': {
        // Remove from any existing room
        removeFromRoom(ws);

        const room = msg.contractAddress;
        if (!rooms.has(room)) {
          rooms.set(room, new Map());
        }
        const clients = rooms.get(room)!;
        clients.set(ws, { walletAddress: msg.walletAddress, room });
        clientRooms.set(ws, room);

        console.log(`[relay] ${msg.walletAddress.slice(0, 8)}... joined room ${room.slice(0, 8)}... (${clients.size} peers)`);

        // Notify all in room (including the joiner)
        broadcastAll(room, {
          type: 'PEER_JOINED',
          walletAddress: msg.walletAddress,
          peerCount: clients.size,
        });
        break;
      }

      case 'ORDER_SUBMITTED': {
        const room = clientRooms.get(ws);
        if (!room) return;
        console.log(`[relay] Order from ${msg.data.walletAddress.slice(0, 8)}... (${msg.data.direction}) in room ${room.slice(0, 8)}...`);
        // Broadcast to others in the room
        broadcast(room, msg, ws);
        break;
      }

      case 'MATCH_ATTEMPTED': {
        const room = clientRooms.get(ws);
        if (!room) return;
        console.log(`[relay] Match attempted by ${msg.by.slice(0, 8)}...`);
        broadcast(room, msg, ws);
        break;
      }

      case 'MATCH_CONFIRMED': {
        const room = clientRooms.get(ws);
        if (!room) return;
        console.log(`[relay] Match confirmed at block ${msg.blockHeight} by ${msg.by.slice(0, 8)}...`);
        broadcast(room, msg, ws);
        break;
      }

      case 'MATCH_FAILED': {
        const room = clientRooms.get(ws);
        if (!room) return;
        console.log(`[relay] Match failed: ${msg.reason}`);
        broadcast(room, msg, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log('[relay] Connection closed');
    removeFromRoom(ws);
  });

  ws.on('error', (err) => {
    console.error('[relay] WebSocket error:', err.message);
    removeFromRoom(ws);
  });
});
