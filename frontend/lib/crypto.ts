/**
 * WebCrypto E2EE Cryptographic Engine & Constant-Size Padding Utility
 * Fully compliant with Node.js & browser WebCrypto APIs.
 */

import { Buffer } from 'buffer';

const PADDING_SIZE = 256;

export interface EncryptedEnvelope {
  ciphertext: string; // Base64 AES-GCM ciphertext
  iv: string;         // Base64 IV
  ephemeralPubKey?: JsonWebKey;
}

export interface SessionKeyInfo {
  keyPair: CryptoKeyPair;
  publicKeyJwk: JsonWebKey;
}

export interface Session {
  encryption: SessionKeyInfo;
  signing: SessionKeyInfo;
}

export interface DecryptedPayload<T = any> {
  payload: T;
  seq: number;
  ts: number;
}

/**
 * Converts ArrayBuffer to Base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Converts Base64 string to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Generates an ECDH (P-256) keypair for encryption and key exchange.
 */
export async function generateEncryptionKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

/**
 * Generates an ECDSA (P-256) keypair for identity signing and verification.
 */
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify'],
  );
}

/**
 * Exports a CryptoKey to JsonWebKey format.
 */
export async function exportPublicKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', key);
}

/**
 * Imports a public key from JsonWebKey format.
 */
export async function importPublicKeyJwk(
  jwk: JsonWebKey,
  usage: 'encryption' | 'signing',
): Promise<CryptoKey> {
  if (usage === 'encryption') {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      [],
    );
  } else {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['verify'],
    );
  }
}

/**
 * Creates a complete local crypto session with keypairs and JWKs.
 */
export async function createSession(): Promise<Session> {
  const encKeyPair = await generateEncryptionKeyPair();
  const encJwk = await exportPublicKeyJwk(encKeyPair.publicKey);

  const sigKeyPair = await generateSigningKeyPair();
  const sigJwk = await exportPublicKeyJwk(sigKeyPair.publicKey);

  return {
    encryption: {
      publicKey: encKeyPair.publicKey,
      privateKey: encKeyPair.privateKey,
      publicKeyJwk: encJwk,
    },
    signing: {
      publicKey: sigKeyPair.publicKey,
      privateKey: sigKeyPair.privateKey,
      publicKeyJwk: sigJwk,
    },
  };
}

/**
 * Signs a public key binding payload (walletAddress + stringified JWK) using ECDSA P-256.
 */
export async function signPublicKey(
  signingPrivateKey: CryptoKey,
  walletAddress: string,
  encPubKeyJwk: JsonWebKey,
): Promise<string> {
  const payloadStr = walletAddress + JSON.stringify(encPubKeyJwk);
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadStr);

  const sigBuffer = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    signingPrivateKey,
    data,
  );

  return arrayBufferToBase64(sigBuffer);
}

/**
 * Verifies an ECDSA P-256 public key signature binding payload.
 */
export async function verifyPublicKeySignature(
  signingPublicKey: CryptoKey,
  walletAddress: string,
  encPubKeyJwk: JsonWebKey,
  signatureB64: string,
): Promise<boolean> {
  const payloadStr = walletAddress + JSON.stringify(encPubKeyJwk);
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadStr);
  const signature = base64ToArrayBuffer(signatureB64);

  return await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    signingPublicKey,
    signature,
    data,
  );
}

/**
 * Derives a 256-bit AES-GCM shared secret from an ECDH private key and public key.
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Pads a string to a fixed byte length to prevent traffic analysis.
 */
export function padPayload(dataStr: string, targetLength: number = PADDING_SIZE): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(dataStr);

  if (encoded.length > targetLength) {
    throw new Error(
      `Payload size (${encoded.length} bytes) exceeds fixed padding size (${targetLength} bytes)`,
    );
  }

  const padded = new Uint8Array(targetLength);
  padded.set(encoded);
  return padded;
}

/**
 * Strips zero-padding and returns original string.
 */
export function unpadPayload(padded: Uint8Array): string {
  let end = padded.indexOf(0);
  if (end === -1) {
    end = padded.length;
  }
  const slice = padded.subarray(0, end);
  const decoder = new TextDecoder();
  return decoder.decode(slice);
}

/**
 * Encrypts a payload object using AES-GCM with constant-size padding and sequence tracking.
 */
export async function encryptPayload(
  sharedSecret: CryptoKey,
  payload: any,
  seq: number = 1,
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const container = {
    payload,
    seq,
    ts: Date.now(),
  };

  const paddedBuffer = padPayload(JSON.stringify(container), PADDING_SIZE);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedSecret,
    paddedBuffer,
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypts an encrypted envelope payload using AES-GCM and enforces replay & staleness checks.
 */
export async function decryptPayload<T = any>(
  sharedSecret: CryptoKey,
  ivB64: string,
  ciphertextB64: string,
  lastSeq: number = 0,
  maxStalenessMs: number = 60_000,
): Promise<DecryptedPayload<T>> {
  const iv = base64ToArrayBuffer(ivB64);
  const ciphertext = base64ToArrayBuffer(ciphertextB64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedSecret,
    ciphertext,
  );

  const jsonStr = unpadPayload(new Uint8Array(decryptedBuffer));
  const container: DecryptedPayload<T> = JSON.parse(jsonStr);

  if (container.seq <= lastSeq) {
    throw new Error(`Replay detected: seq ${container.seq} <= lastSeq ${lastSeq}`);
  }

  if (Date.now() - container.ts > maxStalenessMs) {
    throw new Error(`Stale payload: timestamp ${container.ts} is older than maxStalenessMs ${maxStalenessMs}`);
  }

  return container;
}

// Backward-compatibility aliases
export const exportPublicKey = exportPublicKeyJwk;
export const importPublicKey = (jwk: JsonWebKey) => importPublicKeyJwk(jwk, 'encryption');
export async function encryptOrderPayload(
  payloadObj: object,
  recipientPubKeyJwk: JsonWebKey,
): Promise<EncryptedEnvelope> {
  const recipientPubKey = await importPublicKeyJwk(recipientPubKeyJwk, 'encryption');
  const ephemeralKeyPair = await generateEncryptionKeyPair();
  const sharedKey = await deriveSharedSecret(ephemeralKeyPair.privateKey, recipientPubKey);
  const envelope = await encryptPayload(sharedKey, payloadObj, 1);
  const ephemeralJwk = await exportPublicKeyJwk(ephemeralKeyPair.publicKey);
  return {
    ...envelope,
    ephemeralPubKey: ephemeralJwk,
  };
}
export async function decryptOrderPayload(
  envelope: EncryptedEnvelope,
  recipientPrivateKey: CryptoKey,
): Promise<any> {
  if (!envelope.ephemeralPubKey) {
    throw new Error('Missing ephemeral public key in envelope');
  }
  const ephemeralPubKey = await importPublicKeyJwk(envelope.ephemeralPubKey, 'encryption');
  const sharedKey = await deriveSharedSecret(recipientPrivateKey, ephemeralPubKey);
  const decrypted = await decryptPayload(sharedKey, envelope.iv, envelope.ciphertext, 0);
  return decrypted.payload;
}
