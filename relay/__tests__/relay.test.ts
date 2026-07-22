/**
 * Integration tests for the VeilBook relay server.
 * All tests use REAL WebSocket connections - no mocks.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { createRelayServer } from '../server.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_PORT = 14401; // high port to avoid conflicts

function createTestClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for message')),
      timeoutMs,
    );
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function waitForMessages(
  ws: WebSocket,
  count: number,
  timeoutMs = 5000,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${count} messages, got ${messages.length}`)),
      timeoutMs,
    );
    const handler = (data: WebSocket.RawData) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length === count) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(messages);
      }
    };
    ws.on('message', handler);
  });
}

/** Fake JWK for testing - we don't need real crypto keys for relay tests */
function makeFakeJwk(id: string): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: `fake-x-${id}`,
    y: `fake-y-${id}`,
  };
}

function makeJoinMsg(
  walletAddress: string,
  contractAddress = 'contract-room-1',
) {
  return {
    type: 'JOIN',
    contractAddress,
    walletAddress,
    protocolVersion: 1,
    encryptionPubKey: makeFakeJwk(`enc-${walletAddress}`),
    signingPubKey: makeFakeJwk(`sig-${walletAddress}`),
    signature: `fake-sig-${walletAddress}`,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let server: ReturnType<typeof createRelayServer>;
let clients: WebSocket[] = [];

beforeAll(() => {
  server = createRelayServer(TEST_PORT);
});

afterAll(async () => {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }
  clients = [];
  await server.close();
});

beforeEach(() => {
  // Close any leftover clients from previous tests
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }
  clients = [];
});

// ---------------------------------------------------------------------------
// Connection Tests
// ---------------------------------------------------------------------------

describe('Connection', () => {
  it('accepts a WebSocket connection', async () => {
    const ws = await createTestClient(TEST_PORT);
    clients.push(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('handles multiple concurrent connections', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    const ws3 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2, ws3);
    expect(ws1.readyState).toBe(WebSocket.OPEN);
    expect(ws2.readyState).toBe(WebSocket.OPEN);
    expect(ws3.readyState).toBe(WebSocket.OPEN);
    ws1.close();
    ws2.close();
    ws3.close();
  });
});

// ---------------------------------------------------------------------------
// Room Management Tests
// ---------------------------------------------------------------------------

describe('Room Management', () => {
  it('client receives ROOM_STATE when joining a room', async () => {
    const ws = await createTestClient(TEST_PORT);
    clients.push(ws);

    const msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify(makeJoinMsg('0xAlice')));
    const msg = await msgPromise;

    expect(msg.type).toBe('ROOM_STATE');
    expect(msg.peers).toEqual([]); // first to join, no existing peers
    expect(msg.peerCount).toBe(1);
    ws.close();
  });

  it('joining broadcasts PEER_JOINED with keys to existing peers', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    // ws1 joins first
    const roomState1Promise = waitForMessage(ws1);
    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-A')));
    await roomState1Promise; // consume ROOM_STATE

    // ws2 joins - ws1 should get PEER_JOINED
    const peerJoinedPromise = waitForMessage(ws1);
    const roomState2Promise = waitForMessage(ws2);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-A')));

    const peerJoined = await peerJoinedPromise;
    expect(peerJoined.type).toBe('PEER_JOINED');
    expect(peerJoined.walletAddress).toBe('0xBob');
    expect(peerJoined.encryptionPubKey).toEqual(makeFakeJwk('enc-0xBob'));
    expect(peerJoined.signingPubKey).toEqual(makeFakeJwk('sig-0xBob'));
    expect(peerJoined.peerCount).toBe(2);

    // ws2 should get ROOM_STATE with ws1's keys
    const roomState2 = await roomState2Promise;
    expect(roomState2.type).toBe('ROOM_STATE');
    expect(roomState2.peers).toHaveLength(1);
    expect(roomState2.peers[0].walletAddress).toBe('0xAlice');
    expect(roomState2.peers[0].encryptionPubKey).toEqual(
      makeFakeJwk('enc-0xAlice'),
    );

    ws1.close();
    ws2.close();
  });

  it('PEER_LEFT is broadcast when a client disconnects', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    // Both join the same room
    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-leave')));
    await waitForMessage(ws1); // ROOM_STATE

    const peerJoinedPromise = waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-leave')));
    await waitForMessage(ws2); // ROOM_STATE
    await peerJoinedPromise; // PEER_JOINED for Bob

    // ws2 disconnects - ws1 should get PEER_LEFT
    const peerLeftPromise = waitForMessage(ws1);
    ws2.close();
    const peerLeft = await peerLeftPromise;

    expect(peerLeft.type).toBe('PEER_LEFT');
    expect(peerLeft.walletAddress).toBe('0xBob');
    expect(peerLeft.peerCount).toBe(1);
    ws1.close();
  });
});

// ---------------------------------------------------------------------------
// Opaque Message Routing Tests
// ---------------------------------------------------------------------------

describe('Opaque Message Routing', () => {
  it('ORDER_SUBMITTED is routed to peers without modification', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    // Both join the same room
    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-order')));
    await waitForMessage(ws1); // ROOM_STATE

    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-order')));
    await waitForMessage(ws2); // ROOM_STATE
    await waitForMessage(ws1); // PEER_JOINED

    // ws1 sends an encrypted order
    const orderMsg = {
      type: 'ORDER_SUBMITTED',
      sender: '0xAlice',
      protocolVersion: 1,
      payload: 'opaque-encrypted-base64-ciphertext-that-relay-cannot-read',
    };

    const receivedPromise = waitForMessage(ws2);
    ws1.send(JSON.stringify(orderMsg));
    const received = await receivedPromise;

    // Message should be forwarded exactly as-is
    expect(received.type).toBe('ORDER_SUBMITTED');
    expect(received.sender).toBe('0xAlice');
    expect(received.protocolVersion).toBe(1);
    expect(received.payload).toBe(
      'opaque-encrypted-base64-ciphertext-that-relay-cannot-read',
    );

    ws1.close();
    ws2.close();
  });

  it('messages are NOT sent back to the sender', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    // Both join
    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-echo')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-echo')));
    await waitForMessage(ws2);
    await waitForMessage(ws1); // PEER_JOINED

    // ws1 sends an order
    ws1.send(
      JSON.stringify({
        type: 'ORDER_SUBMITTED',
        sender: '0xAlice',
        protocolVersion: 1,
        payload: 'test-payload',
      }),
    );

    // ws2 should receive it
    const received = await waitForMessage(ws2);
    expect(received.type).toBe('ORDER_SUBMITTED');

    // ws1 should NOT receive its own message back (wait briefly to be sure)
    const selfEchoPromise = waitForMessage(ws1, 500).catch(() => null);
    const selfEcho = await selfEchoPromise;
    expect(selfEcho).toBeNull();

    ws1.close();
    ws2.close();
  });

  it('messages are only sent to peers in the same room', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    const ws3 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2, ws3);

    // ws1 and ws2 join room-A; ws3 joins room-B
    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-iso-A')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-iso-A')));
    await waitForMessage(ws2);
    await waitForMessage(ws1); // PEER_JOINED

    ws3.send(JSON.stringify(makeJoinMsg('0xCharlie', 'room-iso-B')));
    await waitForMessage(ws3);

    // ws1 sends order in room-A
    ws1.send(
      JSON.stringify({
        type: 'ORDER_SUBMITTED',
        sender: '0xAlice',
        protocolVersion: 1,
        payload: 'room-A-only',
      }),
    );

    // ws2 should receive it
    const received = await waitForMessage(ws2);
    expect(received.payload).toBe('room-A-only');

    // ws3 should NOT receive it (different room)
    const crossRoom = await waitForMessage(ws3, 500).catch(() => null);
    expect(crossRoom).toBeNull();

    ws1.close();
    ws2.close();
    ws3.close();
  });
});

// ---------------------------------------------------------------------------
// Match Event Routing
// ---------------------------------------------------------------------------

describe('Opaque Match Events', () => {
  it('MATCH_ATTEMPTED is routed as opaque', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-match')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-match')));
    await waitForMessage(ws2);
    await waitForMessage(ws1);

    const msg = {
      type: 'MATCH_ATTEMPTED',
      sender: '0xAlice',
      protocolVersion: 1,
      payload: 'encrypted-match-attempt-data',
    };

    const receivedPromise = waitForMessage(ws2);
    ws1.send(JSON.stringify(msg));
    const received = await receivedPromise;

    expect(received.type).toBe('MATCH_ATTEMPTED');
    expect(received.payload).toBe('encrypted-match-attempt-data');
    ws1.close();
    ws2.close();
  });

  it('MATCH_CONFIRMED is routed as opaque', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-confirm')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-confirm')));
    await waitForMessage(ws2);
    await waitForMessage(ws1);

    ws1.send(
      JSON.stringify({
        type: 'MATCH_CONFIRMED',
        sender: '0xAlice',
        protocolVersion: 1,
        payload: 'encrypted-confirm-data',
      }),
    );

    const received = await waitForMessage(ws2);
    expect(received.type).toBe('MATCH_CONFIRMED');
    expect(received.payload).toBe('encrypted-confirm-data');
    ws1.close();
    ws2.close();
  });

  it('MATCH_FAILED is routed as opaque', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-fail')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-fail')));
    await waitForMessage(ws2);
    await waitForMessage(ws1);

    ws1.send(
      JSON.stringify({
        type: 'MATCH_FAILED',
        sender: '0xAlice',
        protocolVersion: 1,
        payload: 'encrypted-fail-data',
      }),
    );

    const received = await waitForMessage(ws2);
    expect(received.type).toBe('MATCH_FAILED');
    expect(received.payload).toBe('encrypted-fail-data');
    ws1.close();
    ws2.close();
  });
});

// ---------------------------------------------------------------------------
// Key Rotation Tests
// ---------------------------------------------------------------------------

describe('Key Rotation', () => {
  it('KEY_ROTATED is broadcast to other peers', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-rotate')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-rotate')));
    await waitForMessage(ws2);
    await waitForMessage(ws1);

    const rotateMsg = {
      type: 'KEY_ROTATED',
      walletAddress: '0xAlice',
      newEncryptionPubKey: makeFakeJwk('enc-alice-v2'),
      newSigningPubKey: makeFakeJwk('sig-alice-v2'),
      signature: 'new-sig',
    };

    const receivedPromise = waitForMessage(ws2);
    ws1.send(JSON.stringify(rotateMsg));
    const received = await receivedPromise;

    expect(received.type).toBe('KEY_ROTATED');
    expect(received.walletAddress).toBe('0xAlice');
    expect(received.newEncryptionPubKey).toEqual(makeFakeJwk('enc-alice-v2'));
    ws1.close();
    ws2.close();
  });

  it('KEY_ROTATED updates peer keys visible in subsequent ROOM_STATE', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    const ws3 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2, ws3);

    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-rotate-state')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-rotate-state')));
    await waitForMessage(ws2);
    await waitForMessage(ws1);

    // Alice rotates her keys
    ws1.send(
      JSON.stringify({
        type: 'KEY_ROTATED',
        walletAddress: '0xAlice',
        newEncryptionPubKey: makeFakeJwk('enc-alice-rotated'),
        newSigningPubKey: makeFakeJwk('sig-alice-rotated'),
        signature: 'rotated-sig',
      }),
    );
    await waitForMessage(ws2); // consume KEY_ROTATED

    // ws3 joins - should see Alice's ROTATED keys in ROOM_STATE
    const roomStatePromise = waitForMessage(ws3);
    ws3.send(JSON.stringify(makeJoinMsg('0xCharlie', 'room-rotate-state')));
    const roomState = await roomStatePromise;

    expect(roomState.type).toBe('ROOM_STATE');
    const alicePeer = roomState.peers.find(
      (p: any) => p.walletAddress === '0xAlice',
    );
    expect(alicePeer).toBeDefined();
    expect(alicePeer.encryptionPubKey).toEqual(
      makeFakeJwk('enc-alice-rotated'),
    );
    expect(alicePeer.signingPubKey).toEqual(makeFakeJwk('sig-alice-rotated'));

    ws1.close();
    ws2.close();
    ws3.close();
  });
});

// ---------------------------------------------------------------------------
// Privacy Verification
// ---------------------------------------------------------------------------

describe('Privacy', () => {
  it('payload field is forwarded as-is without any modification', async () => {
    const ws1 = await createTestClient(TEST_PORT);
    const ws2 = await createTestClient(TEST_PORT);
    clients.push(ws1, ws2);

    ws1.send(JSON.stringify(makeJoinMsg('0xAlice', 'room-privacy')));
    await waitForMessage(ws1);
    ws2.send(JSON.stringify(makeJoinMsg('0xBob', 'room-privacy')));
    await waitForMessage(ws2);
    await waitForMessage(ws1);

    // Send a payload that looks like random binary data (base64)
    const opaquePayload =
      'dGhpcyBjb3VsZCBiZSBhbnl0aGluZyAtIHRoZSByZWxheSBjYW5ub3QgcmVhZCBpdA==';

    ws1.send(
      JSON.stringify({
        type: 'ORDER_SUBMITTED',
        sender: '0xAlice',
        protocolVersion: 1,
        payload: opaquePayload,
      }),
    );

    const received = await waitForMessage(ws2);
    // Payload must be byte-for-byte identical
    expect(received.payload).toBe(opaquePayload);

    ws1.close();
    ws2.close();
  });
});
