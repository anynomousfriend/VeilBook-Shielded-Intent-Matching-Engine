// Tests for the OOM fix: buildUnshieldedConfig must use NoOpTransactionHistoryStorage
// instead of InMemoryTransactionHistoryStorage, because the CLI never reads transaction
// history and the in-memory variant causes V8 heap OOM (~4 GB) on preprod.

import { describe, it, expect } from 'vitest';
import {
  NoOpTransactionHistoryStorage,
  InMemoryTransactionHistoryStorage,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import type { TransactionHistoryEntry } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet/dist/storage/TransactionHistoryStorage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake TransactionHistoryEntry for testing. */
const makeFakeEntry = (id: number, hash?: string): TransactionHistoryEntry => ({
  id,
  hash: hash ?? `tx-hash-${id}`,
  protocolVersion: 1,
  identifiers: [`id-${id}`],
  timestamp: new Date(),
  fees: 1000n,
  status: 'SUCCESS' as const,
  createdUtxos: [
    {
      value: 100n,
      owner: 'owner-addr',
      tokenType: 'tNIGHT',
      intentHash: 'intent-hash',
      outputIndex: 0,
    },
  ],
  spentUtxos: [],
});

/** Collect all entries from an async iterable into an array. */
const collectAll = async (iter: AsyncIterableIterator<TransactionHistoryEntry>) => {
  const results: TransactionHistoryEntry[] = [];
  for await (const entry of iter) {
    results.push(entry);
  }
  return results;
};

// ---------------------------------------------------------------------------
// 1. Source-level regression: api.ts must import NoOpTransactionHistoryStorage
// ---------------------------------------------------------------------------

describe('api.ts source-level regression', () => {
  it('imports NoOpTransactionHistoryStorage, not InMemoryTransactionHistoryStorage', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const apiSource = fs.readFileSync(
      path.resolve(import.meta.dirname, '..', 'api.ts'),
      'utf-8',
    );

    // Must import NoOp
    expect(apiSource).toContain('NoOpTransactionHistoryStorage');

    // Must NOT import InMemory (the old code that caused OOM)
    expect(apiSource).not.toMatch(/import\s+.*InMemoryTransactionHistoryStorage.*from/);

    // Must use NoOp in buildUnshieldedConfig
    expect(apiSource).toMatch(/txHistoryStorage:\s*new\s+NoOpTransactionHistoryStorage\(\)/);

    // Must NOT instantiate InMemory anywhere
    expect(apiSource).not.toMatch(/new\s+InMemoryTransactionHistoryStorage\(/);
  });
});

// ---------------------------------------------------------------------------
// 2. NoOpTransactionHistoryStorage: behavioral contract
// ---------------------------------------------------------------------------

describe('NoOpTransactionHistoryStorage', () => {
  it('implements the TransactionHistoryStorage interface', () => {
    const storage = new NoOpTransactionHistoryStorage();
    expect(typeof storage.create).toBe('function');
    expect(typeof storage.delete).toBe('function');
    expect(typeof storage.getAll).toBe('function');
    expect(typeof storage.get).toBe('function');
  });

  it('create() resolves without storing anything', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const entry = makeFakeEntry(1);

    // Should not throw
    await expect(storage.create(entry)).resolves.toBeUndefined();

    // Entry should NOT be retrievable (it was discarded)
    const retrieved = await storage.get(entry.hash);
    expect(retrieved).toBeUndefined();
  });

  it('get() always returns undefined', async () => {
    const storage = new NoOpTransactionHistoryStorage();

    expect(await storage.get('nonexistent-hash')).toBeUndefined();
    expect(await storage.get('')).toBeUndefined();
    expect(await storage.get('tx-hash-1')).toBeUndefined();
  });

  it('delete() always returns undefined (nothing to delete)', async () => {
    const storage = new NoOpTransactionHistoryStorage();

    const result = await storage.delete('any-hash');
    expect(result).toBeUndefined();
  });

  it('getAll() yields zero entries', async () => {
    const storage = new NoOpTransactionHistoryStorage();

    const entries = await collectAll(storage.getAll());
    expect(entries).toEqual([]);
  });

  it('getAll() yields zero entries even after creates', async () => {
    const storage = new NoOpTransactionHistoryStorage();

    // Create several entries
    for (let i = 0; i < 10; i++) {
      await storage.create(makeFakeEntry(i));
    }

    const entries = await collectAll(storage.getAll());
    expect(entries).toEqual([]);
  });

  it('create-then-get roundtrip returns undefined (no retention)', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const entry = makeFakeEntry(42, 'unique-hash');

    await storage.create(entry);
    const result = await storage.get('unique-hash');
    expect(result).toBeUndefined();
  });

  it('create-then-delete roundtrip returns undefined', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const entry = makeFakeEntry(1);

    await storage.create(entry);
    const deleted = await storage.delete(entry.hash);
    expect(deleted).toBeUndefined();
  });

  it('serialize() returns a valid JSON object', () => {
    const storage = new NoOpTransactionHistoryStorage();
    const serialized = storage.serialize();

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(JSON.parse(serialized)).toEqual({});
  });

  it('deserialize() returns a fresh NoOp instance', () => {
    const restored = NoOpTransactionHistoryStorage.deserialize('{}');
    expect(restored).toBeInstanceOf(NoOpTransactionHistoryStorage);
  });

  it('deserialize() ignores input content', () => {
    // Even if given garbage, deserialize just returns a new NoOp
    const restored = NoOpTransactionHistoryStorage.deserialize('{"anything": true}');
    expect(restored).toBeInstanceOf(NoOpTransactionHistoryStorage);
  });

  it('serialize/deserialize roundtrip produces a working instance', async () => {
    const original = new NoOpTransactionHistoryStorage();
    await original.create(makeFakeEntry(1));

    const serialized = original.serialize();
    const restored = NoOpTransactionHistoryStorage.deserialize(serialized);

    expect(await restored.get('tx-hash-1')).toBeUndefined();
    expect(await collectAll(restored.getAll())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. InMemoryTransactionHistoryStorage: confirm it DOES retain (the problem)
// ---------------------------------------------------------------------------

describe('InMemoryTransactionHistoryStorage retains entries (the OOM cause)', () => {
  it('stores and retrieves entries in memory', async () => {
    const storage = new InMemoryTransactionHistoryStorage();
    const entry = makeFakeEntry(1, 'stored-hash');

    await storage.create(entry);

    const retrieved = await storage.get('stored-hash');
    expect(retrieved).toBeDefined();
    expect(retrieved!.hash).toBe('stored-hash');
  });

  it('getAll() returns all stored entries', async () => {
    const storage = new InMemoryTransactionHistoryStorage();

    for (let i = 0; i < 5; i++) {
      await storage.create(makeFakeEntry(i));
    }

    const all = await collectAll(storage.getAll());
    expect(all).toHaveLength(5);
  });

  it('delete() removes and returns the entry', async () => {
    const storage = new InMemoryTransactionHistoryStorage();
    const entry = makeFakeEntry(1, 'delete-me');

    await storage.create(entry);
    const deleted = await storage.delete('delete-me');

    expect(deleted).toBeDefined();
    expect(deleted!.hash).toBe('delete-me');

    // Should be gone now
    expect(await storage.get('delete-me')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Memory behavior: NoOp does NOT grow, InMemory DOES
// ---------------------------------------------------------------------------

describe('memory growth comparison', () => {
  const ENTRY_COUNT = 10_000;

  it('NoOpTransactionHistoryStorage does not grow with entries', async () => {
    const storage = new NoOpTransactionHistoryStorage();

    for (let i = 0; i < ENTRY_COUNT; i++) {
      await storage.create(makeFakeEntry(i));
    }

    // After 10k creates, getAll still empty - nothing retained
    const all = await collectAll(storage.getAll());
    expect(all).toHaveLength(0);
  });

  it('InMemoryTransactionHistoryStorage grows linearly with entries', async () => {
    const storage = new InMemoryTransactionHistoryStorage();

    for (let i = 0; i < ENTRY_COUNT; i++) {
      await storage.create(makeFakeEntry(i));
    }

    const all = await collectAll(storage.getAll());
    expect(all).toHaveLength(ENTRY_COUNT);
  });

  it('NoOp serialized size stays constant regardless of creates', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const baseSize = storage.serialize().length;

    for (let i = 0; i < 1_000; i++) {
      await storage.create(makeFakeEntry(i));
    }

    const afterSize = storage.serialize().length;
    expect(afterSize).toBe(baseSize);
  });

  it('InMemory serialized size grows with creates', async () => {
    const storage = new InMemoryTransactionHistoryStorage();
    const baseSize = storage.serialize().length;

    for (let i = 0; i < 100; i++) {
      await storage.create(makeFakeEntry(i));
    }

    const afterSize = storage.serialize().length;
    expect(afterSize).toBeGreaterThan(baseSize * 10);
  });
});

// ---------------------------------------------------------------------------
// 5. Interface compatibility: both implement the same contract
// ---------------------------------------------------------------------------

describe('interface compatibility', () => {
  const implementations = [
    { name: 'NoOpTransactionHistoryStorage', factory: () => new NoOpTransactionHistoryStorage() },
    { name: 'InMemoryTransactionHistoryStorage', factory: () => new InMemoryTransactionHistoryStorage() },
  ] as const;

  for (const { name, factory } of implementations) {
    describe(name, () => {
      it('create() returns Promise<void>', async () => {
        const storage = factory();
        const result = await storage.create(makeFakeEntry(1));
        expect(result).toBeUndefined();
      });

      it('delete() returns Promise<TransactionHistoryEntry | undefined>', async () => {
        const storage = factory();
        const result = await storage.delete('nonexistent');
        expect(result === undefined || typeof result === 'object').toBe(true);
      });

      it('get() returns Promise<TransactionHistoryEntry | undefined>', async () => {
        const storage = factory();
        const result = await storage.get('nonexistent');
        expect(result === undefined || typeof result === 'object').toBe(true);
      });

      it('getAll() returns an AsyncIterableIterator', async () => {
        const storage = factory();
        const iter = storage.getAll();
        expect(Symbol.asyncIterator in Object(iter)).toBe(true);
        // Drain it
        await collectAll(iter);
      });

      it('handles duplicate hash creates without throwing', async () => {
        const storage = factory();
        const entry = makeFakeEntry(1, 'dupe-hash');

        await expect(storage.create(entry)).resolves.toBeUndefined();
        await expect(storage.create(entry)).resolves.toBeUndefined();
      });

      it('handles delete on nonexistent hash without throwing', async () => {
        const storage = factory();
        await expect(storage.delete('does-not-exist')).resolves.not.toThrow();
      });

      it('handles empty string hash without throwing', async () => {
        const storage = factory();
        await expect(storage.get('')).resolves.not.toThrow();
        await expect(storage.delete('')).resolves.not.toThrow();
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('NoOp handles concurrent creates without errors', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const promises = Array.from({ length: 100 }, (_, i) =>
      storage.create(makeFakeEntry(i)),
    );

    await expect(Promise.all(promises)).resolves.not.toThrow();
    expect(await collectAll(storage.getAll())).toHaveLength(0);
  });

  it('NoOp handles entries with null fees', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const entry = makeFakeEntry(1);
    entry.fees = null;

    await expect(storage.create(entry)).resolves.toBeUndefined();
  });

  it('NoOp handles entries with all status types', async () => {
    const storage = new NoOpTransactionHistoryStorage();

    for (const status of ['SUCCESS', 'FAILURE', 'PARTIAL_SUCCESS'] as const) {
      const entry = makeFakeEntry(1);
      entry.status = status;
      await expect(storage.create(entry)).resolves.toBeUndefined();
    }
  });

  it('NoOp handles entries with empty utxo arrays', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const entry = makeFakeEntry(1);
    entry.createdUtxos = [];
    entry.spentUtxos = [];

    await expect(storage.create(entry)).resolves.toBeUndefined();
  });

  it('NoOp handles entries with large utxo arrays', async () => {
    const storage = new NoOpTransactionHistoryStorage();
    const entry = makeFakeEntry(1);
    entry.createdUtxos = Array.from({ length: 500 }, (_, i) => ({
      value: BigInt(i * 100),
      owner: `owner-${i}`,
      tokenType: 'tNIGHT',
      intentHash: `intent-${i}`,
      outputIndex: i,
    }));

    await expect(storage.create(entry)).resolves.toBeUndefined();
    // Confirm nothing retained
    expect(await storage.get(entry.hash)).toBeUndefined();
  });

  it('multiple NoOp instances are independent', async () => {
    const a = new NoOpTransactionHistoryStorage();
    const b = new NoOpTransactionHistoryStorage();

    await a.create(makeFakeEntry(1, 'hash-a'));
    await b.create(makeFakeEntry(2, 'hash-b'));

    // Both should be empty regardless
    expect(await a.get('hash-a')).toBeUndefined();
    expect(await b.get('hash-b')).toBeUndefined();
    expect(await a.get('hash-b')).toBeUndefined();
  });
});
