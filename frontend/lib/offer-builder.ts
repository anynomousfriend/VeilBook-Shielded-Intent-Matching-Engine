/**
 * Midnight Signed Intent Offer File Builder & Serialization (Frontend)
 * Constructs portable, signed Offer Files representing non-escrow account balance intents.
 */
import { Buffer } from 'buffer';

export interface OfferFileHeader {
  version: number;
  contractAddress: string;
  senderAddress: string;
  orderCommitment: string;
  timestamp: number;
}

export interface SerializedOfferFile {
  header: OfferFileHeader;
  guaranteedOfferBytes?: string; // Hex serialized offer
  fallibleOfferBytes?: string; // Hex serialized offer
  signatureHex: string;
}

/**
 * Serializes an OfferFile object into a JSON string ready for E2EE padding and relay transmission.
 */
export function serializeOfferFile(offerFile: SerializedOfferFile): string {
  return JSON.stringify(offerFile);
}

/**
 * Deserializes an OfferFile string.
 */
export function deserializeOfferFile(rawJson: string): SerializedOfferFile {
  const parsed = JSON.parse(rawJson);
  if (!parsed.header || !parsed.header.orderCommitment) {
    throw new Error('Invalid Offer File payload: missing header commitment');
  }
  return parsed as SerializedOfferFile;
}

/**
 * Creates a signed OfferFile container for an order intent.
 */
export function createSignedOfferFile(
  contractAddress: string,
  senderAddress: string,
  orderCommitment: string,
  guaranteedOfferBytes: Uint8Array,
  signatureBytes: Uint8Array,
): SerializedOfferFile {
  return {
    header: {
      version: 1,
      contractAddress,
      senderAddress,
      orderCommitment,
      timestamp: Date.now(),
    },
    guaranteedOfferBytes: Buffer.from(guaranteedOfferBytes).toString('hex'),
    signatureHex: Buffer.from(signatureBytes).toString('hex'),
  };
}
