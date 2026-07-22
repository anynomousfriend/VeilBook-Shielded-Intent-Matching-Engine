import { WebSocketServer, WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Protocol version
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Message types - Client -> Server
// ---------------------------------------------------------------------------

interface JoinMessage {
  type: 'JOIN';
  contractAddress: string;
  walletAddress: string;
  protocolVersion: number;
  encryptionPubKey: JsonWebKey;
  signingPubKey: JsonWebKey;
  signature: string;
}

/**
 * ORDER_SUBMITTED is now an opaque envelope.
 * The relay MUST NOT parse or log the `payload` field.
 */
interface EncryptedOrderMessage {
  type: 'ORDER_SUBMITTED';
  sender: string;
  protocolVersion: number;
  payload: string; // opaque base64 ciphertext
}

/**
 * Match events are also opaque envelopes.
 */
interface EncryptedMatchMessage {
  type: 'MATCH_ATTEMPTED' | 'MATCH_CONFIRMED' | 'MATCH_FAILED';
  sender: string;
  protocolVersion: number;
  payload: string; // opaque
}

interface KeyRotatedMessage {
  type: 'KEY_ROTATED';
  walletAddress: string;
  newEncryptionPubKey: JsonWebKey;
  newSigningPubKey: JsonWebKey;
  signature: string;
}

type ClientMessage =
  | JoinMessage
  | EncryptedOrderMessage
  | EncryptedMatchMessage
  | KeyRotatedMessage;

// ---------------------------------------------------------------------------
// Room management
// ---------------------------------------------------------------------------

interface ClientInfo {
  walletAddress: string;
  room: string;
  encryptionPubKey: JsonWebKey;
  signingPubKey: JsonWebKey;
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

// ---------------------------------------------------------------------------
// Server factory (exported for testing)
// ---------------------------------------------------------------------------

export function createRelayServer(port: number) {
  const wss = new WebSocketServer({ port });

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

          const clientInfo: ClientInfo = {
            walletAddress: msg.walletAddress,
            room,
            encryptionPubKey: msg.encryptionPubKey,
            signingPubKey: msg.signingPubKey,
          };

          // Send ROOM_STATE to the joining user (before adding them)
          const existingPeers = Array.from(clients.entries())
            .map(([, info]) => ({
              walletAddress: info.walletAddress,
              encryptionPubKey: info.encryptionPubKey,
              signingPubKey: info.signingPubKey,
            }));

          ws.send(
            JSON.stringify({
              type: 'ROOM_STATE',
              peers: existingPeers,
              peerCount: clients.size + 1, // including the joiner
            }),
          );

          // Add the new client
          clients.set(ws, clientInfo);
          clientRooms.set(ws, room);

          const logAddr = msg.walletAddress.slice(0, 8);
          const logRoom = room.slice(0, 8);
          console.log(
            `[relay] ${logAddr}... joined room ${logRoom}... (${clients.size} peers)`,
          );

          // Notify existing peers (excluding the joiner)
          broadcast(
            room,
            {
              type: 'PEER_JOINED',
              walletAddress: msg.walletAddress,
              encryptionPubKey: msg.encryptionPubKey,
              signingPubKey: msg.signingPubKey,
              peerCount: clients.size,
            },
            ws,
          );
          break;
        }

        case 'ORDER_SUBMITTED': {
          const room = clientRooms.get(ws);
          if (!room) return;

          // Log metadata only - NEVER log payload content
          const logSender = msg.sender.slice(0, 8);
          const logRoom = room.slice(0, 8);
          console.log(
            `[relay] Encrypted order from ${logSender}... in room ${logRoom}...`,
          );

          // Route the opaque message to all other peers
          broadcast(room, msg, ws);
          break;
        }

        case 'MATCH_ATTEMPTED':
        case 'MATCH_CONFIRMED':
        case 'MATCH_FAILED': {
          const room = clientRooms.get(ws);
          if (!room) return;

          // Log metadata only - NEVER log payload content
          console.log(
            `[relay] ${msg.type} from ${msg.sender.slice(0, 8)}...`,
          );

          // Route the opaque message
          broadcast(room, msg, ws);
          break;
        }

        case 'KEY_ROTATED': {
          const room = clientRooms.get(ws);
          if (!room) return;

          // Update the client's keys
          const clients = rooms.get(room);
          if (clients) {
            const info = clients.get(ws);
            if (info) {
              info.encryptionPubKey = msg.newEncryptionPubKey;
              info.signingPubKey = msg.newSigningPubKey;
            }
          }

          console.log(
            `[relay] Key rotated by ${msg.walletAddress.slice(0, 8)}...`,
          );

          // Broadcast to other peers
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

  return {
    wss,
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        // Close all client connections first
        for (const client of wss.clients) {
          client.terminate();
        }
        wss.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const PORT = parseInt(process.env.RELAY_PORT || '4400');
  createRelayServer(PORT);
  console.log(
    `[relay] Veilbook relay server listening on ws://localhost:${PORT}`,
  );
}
