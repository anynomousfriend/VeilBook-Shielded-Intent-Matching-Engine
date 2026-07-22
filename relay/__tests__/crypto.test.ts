/**
 * Comprehensive tests for the VeilBook E2E cryptographic engine.
 * All tests use REAL crypto operations via Node.js webcrypto - no mocks.
 */
import { describe, it, expect } from 'vitest';
import {
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  exportPublicKeyJwk,
  importPublicKeyJwk,
  signPublicKey,
  verifyPublicKeySignature,
  deriveSharedSecret,
  encryptPayload,
  decryptPayload,
  createSession,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../../frontend/lib/crypto.js';

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

describe('Key Generation', () => {
  it('generates a valid ECDH P-256 encryption keypair', async () => {
    const kp = await generateEncryptionKeyPair();
    expect(kp.publicKey).toBeDefined();
    expect(kp.privateKey).toBeDefined();
    expect(kp.publicKey.algorithm).toMatchObject({ name: 'ECDH' });
    expect(kp.publicKey.type).toBe('public');
    expect(kp.privateKey.type).toBe('private');
  });

  it('generates a valid ECDSA P-256 signing keypair', async () => {
    const kp = await generateSigningKeyPair();
    expect(kp.publicKey).toBeDefined();
    expect(kp.privateKey).toBeDefined();
    expect(kp.publicKey.algorithm).toMatchObject({ name: 'ECDSA' });
    expect(kp.publicKey.type).toBe('public');
    expect(kp.privateKey.type).toBe('private');
  });

  it('generates unique keypairs on each call', async () => {
    const kp1 = await generateEncryptionKeyPair();
    const kp2 = await generateEncryptionKeyPair();
    const jwk1 = await exportPublicKeyJwk(kp1.publicKey);
    const jwk2 = await exportPublicKeyJwk(kp2.publicKey);
    // Different x/y coordinates means different keys
    expect(jwk1.x).not.toBe(jwk2.x);
  });

  it('createSession() returns all required key material', async () => {
    const session = await createSession();
    expect(session.encryption.publicKey).toBeDefined();
    expect(session.encryption.privateKey).toBeDefined();
    expect(session.encryption.publicKeyJwk).toBeDefined();
    expect(session.encryption.publicKeyJwk.kty).toBe('EC');
    expect(session.encryption.publicKeyJwk.crv).toBe('P-256');

    expect(session.signing.publicKey).toBeDefined();
    expect(session.signing.privateKey).toBeDefined();
    expect(session.signing.publicKeyJwk).toBeDefined();
    expect(session.signing.publicKeyJwk.kty).toBe('EC');
    expect(session.signing.publicKeyJwk.crv).toBe('P-256');
  });
});

// ---------------------------------------------------------------------------
// Key Export / Import
// ---------------------------------------------------------------------------

describe('Key Export / Import', () => {
  it('exports a public key to valid JWK with correct curve', async () => {
    const kp = await generateEncryptionKeyPair();
    const jwk = await exportPublicKeyJwk(kp.publicKey);
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();
    // Public key should NOT have the private component
    expect(jwk.d).toBeUndefined();
  });

  it('imports a JWK encryption key back to CryptoKey', async () => {
    const kp = await generateEncryptionKeyPair();
    const jwk = await exportPublicKeyJwk(kp.publicKey);
    const imported = await importPublicKeyJwk(jwk, 'encryption');
    expect(imported.type).toBe('public');
    expect(imported.algorithm).toMatchObject({ name: 'ECDH' });
  });

  it('imports a JWK signing key back to CryptoKey', async () => {
    const kp = await generateSigningKeyPair();
    const jwk = await exportPublicKeyJwk(kp.publicKey);
    const imported = await importPublicKeyJwk(jwk, 'signing');
    expect(imported.type).toBe('public');
    expect(imported.algorithm).toMatchObject({ name: 'ECDSA' });
  });

  it('round-trip export/import produces functionally equivalent keys', async () => {
    const kp = await generateEncryptionKeyPair();
    const jwk = await exportPublicKeyJwk(kp.publicKey);
    const imported = await importPublicKeyJwk(jwk, 'encryption');
    const reExported = await exportPublicKeyJwk(imported);
    expect(reExported.x).toBe(jwk.x);
    expect(reExported.y).toBe(jwk.y);
    expect(reExported.crv).toBe(jwk.crv);
  });
});

// ---------------------------------------------------------------------------
// MITM Protection - Signatures
// ---------------------------------------------------------------------------

describe('MITM Protection - Signed Key Exchange', () => {
  it('signs and verifies a public key successfully', async () => {
    const encKp = await generateEncryptionKeyPair();
    const sigKp = await generateSigningKeyPair();
    const encJwk = await exportPublicKeyJwk(encKp.publicKey);
    const walletAddress = '0xABCDEF1234567890';

    const sig = await signPublicKey(sigKp.privateKey, walletAddress, encJwk);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);

    const valid = await verifyPublicKeySignature(
      sigKp.publicKey,
      walletAddress,
      encJwk,
      sig,
    );
    expect(valid).toBe(true);
  });

  it('verification fails with wrong wallet address', async () => {
    const encKp = await generateEncryptionKeyPair();
    const sigKp = await generateSigningKeyPair();
    const encJwk = await exportPublicKeyJwk(encKp.publicKey);

    const sig = await signPublicKey(
      sigKp.privateKey,
      '0xABCDEF1234567890',
      encJwk,
    );

    const valid = await verifyPublicKeySignature(
      sigKp.publicKey,
      '0xDIFFERENT_WALLET',
      encJwk,
      sig,
    );
    expect(valid).toBe(false);
  });

  it('verification fails with wrong encryption public key', async () => {
    const encKp1 = await generateEncryptionKeyPair();
    const encKp2 = await generateEncryptionKeyPair();
    const sigKp = await generateSigningKeyPair();
    const encJwk1 = await exportPublicKeyJwk(encKp1.publicKey);
    const encJwk2 = await exportPublicKeyJwk(encKp2.publicKey);
    const walletAddress = '0xABCDEF1234567890';

    const sig = await signPublicKey(sigKp.privateKey, walletAddress, encJwk1);

    // Verify with a different encryption key
    const valid = await verifyPublicKeySignature(
      sigKp.publicKey,
      walletAddress,
      encJwk2,
      sig,
    );
    expect(valid).toBe(false);
  });

  it('verification fails with wrong signing key', async () => {
    const encKp = await generateEncryptionKeyPair();
    const sigKp1 = await generateSigningKeyPair();
    const sigKp2 = await generateSigningKeyPair();
    const encJwk = await exportPublicKeyJwk(encKp.publicKey);
    const walletAddress = '0xABCDEF1234567890';

    const sig = await signPublicKey(sigKp1.privateKey, walletAddress, encJwk);

    // Verify with a different signing public key (MITM attack)
    const valid = await verifyPublicKeySignature(
      sigKp2.publicKey,
      walletAddress,
      encJwk,
      sig,
    );
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Key Derivation
// ---------------------------------------------------------------------------

describe('Key Derivation (ECDH Shared Secret)', () => {
  it('derives a shared secret from two keypairs', async () => {
    const kpA = await generateEncryptionKeyPair();
    const kpB = await generateEncryptionKeyPair();

    const secret = await deriveSharedSecret(kpA.privateKey, kpB.publicKey);
    expect(secret).toBeDefined();
    expect(secret.type).toBe('secret');
    expect(secret.algorithm).toMatchObject({ name: 'AES-GCM' });
  });

  it('shared secret is symmetric (A->B equals B->A)', async () => {
    const kpA = await generateEncryptionKeyPair();
    const kpB = await generateEncryptionKeyPair();

    const secretAB = await deriveSharedSecret(kpA.privateKey, kpB.publicKey);
    const secretBA = await deriveSharedSecret(kpB.privateKey, kpA.publicKey);

    // Encrypt with A->B, decrypt with B->A to prove symmetry
    const testPayload = { message: 'symmetry test', value: 42 };
    const encrypted = await encryptPayload(secretAB, testPayload, 1);
    const decrypted = await decryptPayload(
      secretBA,
      encrypted.iv,
      encrypted.ciphertext,
      0,
      60_000,
    );
    expect(decrypted.payload).toEqual(testPayload);
  });

  it('different keypairs produce different shared secrets', async () => {
    const kpA = await generateEncryptionKeyPair();
    const kpB = await generateEncryptionKeyPair();
    const kpC = await generateEncryptionKeyPair();

    const secretAB = await deriveSharedSecret(kpA.privateKey, kpB.publicKey);
    const secretAC = await deriveSharedSecret(kpA.privateKey, kpC.publicKey);

    // Encrypt the same payload with both keys - ciphertexts should differ
    const payload = { test: 'different secrets' };
    const enc1 = await encryptPayload(secretAB, payload, 1);
    const enc2 = await encryptPayload(secretAC, payload, 1);

    // Can only decrypt with the correct key
    const dec1 = await decryptPayload(secretAB, enc1.iv, enc1.ciphertext, 0);
    expect(dec1.payload).toEqual(payload);

    // Decrypting enc1 with the wrong key should fail
    await expect(
      decryptPayload(secretAC, enc1.iv, enc1.ciphertext, 0),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Encryption / Decryption
// ---------------------------------------------------------------------------

describe('Encryption / Decryption', () => {
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    const kpA = await generateEncryptionKeyPair();
    const kpB = await generateEncryptionKeyPair();
    sharedKey = await deriveSharedSecret(kpA.privateKey, kpB.publicKey);
  });

  it('encrypts and decrypts a payload successfully', async () => {
    const payload = { direction: 'BUY', price: '100.50', size: '10' };
    const encrypted = await encryptPayload(sharedKey, payload, 1);
    const decrypted = await decryptPayload(
      sharedKey,
      encrypted.iv,
      encrypted.ciphertext,
      0,
    );
    expect(decrypted.payload).toEqual(payload);
    expect(decrypted.seq).toBe(1);
    expect(typeof decrypted.ts).toBe('number');
  });

  it('encrypted output contains iv and ciphertext as base64 strings', async () => {
    const payload = { test: true };
    const encrypted = await encryptPayload(sharedKey, payload, 1);

    expect(typeof encrypted.iv).toBe('string');
    expect(typeof encrypted.ciphertext).toBe('string');

    // Verify they're valid base64 by round-tripping
    const ivBytes = base64ToArrayBuffer(encrypted.iv);
    expect(ivBytes.byteLength).toBe(12); // 96-bit IV for AES-GCM

    const ctBytes = base64ToArrayBuffer(encrypted.ciphertext);
    expect(ctBytes.byteLength).toBeGreaterThan(0);
  });

  it('decryption fails with wrong key', async () => {
    const kpC = await generateEncryptionKeyPair();
    const kpD = await generateEncryptionKeyPair();
    const wrongKey = await deriveSharedSecret(kpC.privateKey, kpD.publicKey);

    const payload = { secret: 'data' };
    const encrypted = await encryptPayload(sharedKey, payload, 1);

    await expect(
      decryptPayload(wrongKey, encrypted.iv, encrypted.ciphertext, 0),
    ).rejects.toThrow();
  });

  it('different IVs produce different ciphertexts for same payload', async () => {
    const payload = { same: 'payload' };
    const enc1 = await encryptPayload(sharedKey, payload, 1);
    const enc2 = await encryptPayload(sharedKey, payload, 2);

    // IVs should differ (random)
    expect(enc1.iv).not.toBe(enc2.iv);
    // Ciphertexts should differ
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });
});

// ---------------------------------------------------------------------------
// Replay Protection
// ---------------------------------------------------------------------------

describe('Replay Protection', () => {
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    const kpA = await generateEncryptionKeyPair();
    const kpB = await generateEncryptionKeyPair();
    sharedKey = await deriveSharedSecret(kpA.privateKey, kpB.publicKey);
  });

  it('accepts payload with seq > lastSeq', async () => {
    const encrypted = await encryptPayload(sharedKey, { data: 'ok' }, 5);
    const result = await decryptPayload(
      sharedKey,
      encrypted.iv,
      encrypted.ciphertext,
      4, // lastSeq = 4, incoming = 5 -> valid
    );
    expect(result.seq).toBe(5);
  });

  it('rejects payload with seq <= lastSeq (replay attack)', async () => {
    const encrypted = await encryptPayload(sharedKey, { data: 'replay' }, 3);
    await expect(
      decryptPayload(
        sharedKey,
        encrypted.iv,
        encrypted.ciphertext,
        3, // lastSeq = 3, incoming = 3 -> rejected
      ),
    ).rejects.toThrow(/Replay detected/);
  });

  it('rejects payload with seq < lastSeq (old message)', async () => {
    const encrypted = await encryptPayload(sharedKey, { data: 'old' }, 1);
    await expect(
      decryptPayload(
        sharedKey,
        encrypted.iv,
        encrypted.ciphertext,
        5, // lastSeq = 5, incoming = 1 -> rejected
      ),
    ).rejects.toThrow(/Replay detected/);
  });

  it('rejects payload with timestamp older than staleness window', async () => {
    const encrypted = await encryptPayload(sharedKey, { data: 'stale' }, 10);

    // Simulate waiting by using a very small staleness window
    await expect(
      decryptPayload(
        sharedKey,
        encrypted.iv,
        encrypted.ciphertext,
        9,
        0, // maxStalenessMs = 0 -> everything is stale
      ),
    ).rejects.toThrow(/Stale payload/);
  });

  it('accepts payload within staleness window', async () => {
    const encrypted = await encryptPayload(sharedKey, { data: 'fresh' }, 10);
    const result = await decryptPayload(
      sharedKey,
      encrypted.iv,
      encrypted.ciphertext,
      9,
      60_000, // 60 seconds - should be fine
    );
    expect(result.seq).toBe(10);
  });

  it('returns correct seq number for tracking', async () => {
    let lastSeq = 0;
    for (let i = 1; i <= 5; i++) {
      const encrypted = await encryptPayload(sharedKey, { order: i }, i);
      const result = await decryptPayload(
        sharedKey,
        encrypted.iv,
        encrypted.ciphertext,
        lastSeq,
      );
      expect(result.seq).toBe(i);
      lastSeq = result.seq;
    }
    expect(lastSeq).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Base64 Utilities
// ---------------------------------------------------------------------------

describe('Base64 Utilities', () => {
  it('round-trips ArrayBuffer through base64', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
    const b64 = arrayBufferToBase64(original.buffer);
    const restored = new Uint8Array(base64ToArrayBuffer(b64));
    expect(restored).toEqual(original);
  });

  it('handles empty ArrayBuffer', () => {
    const empty = new ArrayBuffer(0);
    const b64 = arrayBufferToBase64(empty);
    const restored = base64ToArrayBuffer(b64);
    expect(restored.byteLength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-End Flow
// ---------------------------------------------------------------------------

describe('End-to-End Flow: Two Traders', () => {
  it('complete E2E: key exchange, signature verify, encrypt, decrypt', async () => {
    // --- Trader A creates a session ---
    const sessionA = await createSession();
    const walletA = '0xTraderA_abcdef1234567890';

    // --- Trader B creates a session ---
    const sessionB = await createSession();
    const walletB = '0xTraderB_1234567890abcdef';

    // --- Trader A signs their encryption key ---
    const sigA = await signPublicKey(
      sessionA.signing.privateKey,
      walletA,
      sessionA.encryption.publicKeyJwk,
    );

    // --- Trader B signs their encryption key ---
    const sigB = await signPublicKey(
      sessionB.signing.privateKey,
      walletB,
      sessionB.encryption.publicKeyJwk,
    );

    // --- Both exchange public keys via relay (simulated) ---
    // Trader B verifies Trader A's signed key
    const signingPubA = await importPublicKeyJwk(
      sessionA.signing.publicKeyJwk,
      'signing',
    );
    const aVerified = await verifyPublicKeySignature(
      signingPubA,
      walletA,
      sessionA.encryption.publicKeyJwk,
      sigA,
    );
    expect(aVerified).toBe(true);

    // Trader A verifies Trader B's signed key
    const signingPubB = await importPublicKeyJwk(
      sessionB.signing.publicKeyJwk,
      'signing',
    );
    const bVerified = await verifyPublicKeySignature(
      signingPubB,
      walletB,
      sessionB.encryption.publicKeyJwk,
      sigB,
    );
    expect(bVerified).toBe(true);

    // --- Both derive the shared secret ---
    const encPubA = await importPublicKeyJwk(
      sessionA.encryption.publicKeyJwk,
      'encryption',
    );
    const encPubB = await importPublicKeyJwk(
      sessionB.encryption.publicKeyJwk,
      'encryption',
    );

    const sharedAB = await deriveSharedSecret(
      sessionA.encryption.privateKey,
      encPubB,
    );
    const sharedBA = await deriveSharedSecret(
      sessionB.encryption.privateKey,
      encPubA,
    );

    // --- Trader A encrypts an order ---
    const order = {
      direction: 'SELL',
      price: '42000.00',
      size: '1.5',
      nonce: 'abc123',
      commitment: '0xcommit...',
    };

    const encrypted = await encryptPayload(sharedAB, order, 1);

    // --- Trader B decrypts the order ---
    const decrypted = await decryptPayload(
      sharedBA,
      encrypted.iv,
      encrypted.ciphertext,
      0, // first message from A
    );

    expect(decrypted.payload).toEqual(order);
    expect(decrypted.seq).toBe(1);

    // --- Trader B encrypts a response order ---
    const responseOrder = {
      direction: 'BUY',
      price: '42000.00',
      size: '1.5',
      nonce: 'xyz789',
      commitment: '0xcommit2...',
    };

    const encryptedResponse = await encryptPayload(sharedBA, responseOrder, 1);

    // --- Trader A decrypts the response ---
    const decryptedResponse = await decryptPayload(
      sharedAB,
      encryptedResponse.iv,
      encryptedResponse.ciphertext,
      0, // first message from B
    );

    expect(decryptedResponse.payload).toEqual(responseOrder);

    // --- Replay attack: re-send encrypted order ---
    await expect(
      decryptPayload(
        sharedBA,
        encrypted.iv,
        encrypted.ciphertext,
        1, // lastSeq is now 1, so seq=1 is a replay
      ),
    ).rejects.toThrow(/Replay detected/);
  });
});
