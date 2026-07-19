# AGENTS.md

Developer changelog for AI-assisted fixes. Each entry records what broke, why, and exactly what was changed so future agents can orient quickly.

---

## 2026-04-10 — Browser wallet integration fixes

### Fix 1: Network ID not initialized before contract operations

**Error:** `"Network ID has not been configured. Call setNetworkId() before any wallet or contract operation."`
**Trace:** `app/dashboard/page.tsx:272` → `lib/veilbook-api.ts:69` (`contract.callTx.submit_order()`)

**Root cause:** The Midnight SDK requires a global network ID singleton (from `@midnight-ntwrk/midnight-js-network-id`) to be set before any wallet or contract call. The CLI does this in its config constructors (`veilbook-cli/src/config.ts:41/53/63` via `setAllNetworkIds()`), but the browser's `createBrowserProviders` never called it.

**Fix:** `frontend/lib/providers.ts`
- Added `import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'`
- Called `setNetworkId(network)` at the top of `createBrowserProviders()`, before any provider is constructed

---

### Fix 2: Duplicate WASM module instances causing `instanceof ChargedState` failure

**Error:** `ContractRuntimeError: Error executing circuit 'submit_order' … expected instance of ChargedState`
**Trace:** `ledger (veilbook.compact:38)` ← `_getOrderNonce_0` ← `_submit_order_0` ← `submit_order`

**Root cause:** The contract is linked as `file:../contract` in `frontend/package.json`. When webpack bundles the frontend, imports inside `contract/dist/managed/veilbook/contract/index.js` (e.g. `import * as __compactRuntime from '@midnight-ntwrk/compact-runtime'`) resolve upward to the root workspace `veilbook/node_modules/`, while the SDK packages in the frontend resolve to `frontend/node_modules/`. This creates two separate copies of `@midnight-ntwrk/onchain-runtime-v3` (the WASM module), each with its own `ChargedState` class. The WASM binding uses `_assertClass(instance, ChargedState)` which is `instanceof`-based — crossing module boundaries causes it to fail even on a correctly typed object.

Confirmed two copies:
- `veilbook/node_modules/@midnight-ntwrk/onchain-runtime-v3`
- `veilbook/frontend/node_modules/@midnight-ntwrk/onchain-runtime-v3`

**Fix:** `frontend/next.config.ts`
- Added `config.resolve.modules = [path.resolve(__dirname, 'node_modules'), 'node_modules']` inside the webpack config callback. This makes webpack prefer `frontend/node_modules` when resolving any import from any file (including those from the `file:` linked contract), collapsing both copies into one.

---

### Fix 3: `balanceTx` wrong serialization format and broken return object

**Error:** `"Unexpected error submitting scoped transaction '<unnamed>': Error"` (after wallet signs)

**Root cause (part A):** The DApp Connector API v4's `balanceUnsealedTransaction(tx: string)` expects a **hex-encoded string**, but the old code passed `tx.serialize()` raw (`Uint8Array`) directly.

**Root cause (part B):** The old `balanceTx` returned `{ ...wasmTx, serialize: () => balanced.tx }`. WASM objects have no enumerable own properties, so spreading them produces `{}`. The SDK received a bare object with only a patched `serialize()`, missing the `identifiers()` method it needs.

**Fix:** `frontend/lib/providers.ts`
- Added `import { Transaction } from '@midnight-ntwrk/ledger-v8'`
- Added `toHex()` and `fromHex()` helpers (browser-safe, no `Buffer`)
- Rewrote `balanceTx`:
  ```ts
  balanceTx: async (tx, _ttl?) => {
    const balanced = await injectedWallet.balanceUnsealedTransaction(toHex(tx.serialize()));
    return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
  }
  ```

---

### Fix 4: `submitTx` returns `void` instead of `TransactionId`

**Error:** Same "Unexpected error submitting" — the specific cause: `watchForTxData(undefined)` inside the SDK threw `new Error()` with no message, producing the bare `: Error` suffix.

**Root cause:** The DApp Connector API's `submitTransaction` returns `Promise<void>`. But `MidnightProvider.submitTx` must return `Promise<TransactionId>` (a string). The SDK immediately passes the return value to `publicDataProvider.watchForTxData(txId)`. With `txId = undefined`, that throws `new Error()`.

**Fix:** `frontend/lib/providers.ts`
- Rewrote `submitTx` to extract the tx ID from the `FinalizedTransaction` before calling `submitTransaction` (made possible by Fix 3 returning a real ledger object with `identifiers()`):
  ```ts
  submitTx: async (tx) => {
    const txId = tx.identifiers()[0];
    await injectedWallet.submitTransaction(toHex(tx.serialize()));
    return txId;
  }
  ```

---

### Fix 5: `getUnshieldedAddress` wrong field name

**Root cause:** DApp Connector API v4 returns `{ unshieldedAddress: string }`, but the code checked `addr?.address` (always `undefined`), falling through to `addr.toString()` → `"[object Object]"`.

**Fix:** `frontend/contexts/WalletContext.tsx`
- Changed field lookup order to check `addr?.unshieldedAddress` first:
  ```ts
  const addrStr = typeof addr === 'string'
    ? addr
    : (addr?.unshieldedAddress ?? addr?.address ?? addr?.toString?.() ?? String(addr));
  ```

---

## Key architectural notes for future agents

- **DApp Connector API v4 transaction flow:**
  1. `balanceUnsealedTransaction(hexString)` → `{tx: hexString}` — wallet signs here
  2. `submitTransaction(hexString)` → `void` — must return tx ID separately via `tx.identifiers()[0]`
  3. Deserialize balanced hex back to `FinalizedTransaction` using `Transaction.deserialize('signature', 'proof', 'binding', bytes)` to get a real object with `identifiers()` and `serialize()`

- **Duplicate WASM modules:** Any `file:`-linked package that imports `@midnight-ntwrk/*` WASM packages will resolve to root `node_modules` instead of `frontend/node_modules`. Always keep `config.resolve.modules = [path.resolve(__dirname, 'node_modules'), 'node_modules']` in `next.config.ts`.

- **Network ID:** Must call `setNetworkId(networkId)` once before any Midnight SDK operation. In the browser this is done inside `createBrowserProviders`. In the CLI it is done in each config class constructor via `setAllNetworkIds`.

---

## 2026-07-18 - CLI heap OOM during preprod wallet sync

**Error:** `npm run preprod` crashes during "Syncing with network" with V8 heap OOM (Ineffective mark-compacts near heap limit, ~4 GB).

**Root cause:** `buildUnshieldedConfig` in `veilbook-cli/src/api.ts` used `InMemoryTransactionHistoryStorage`, which buffers the full transaction history in memory during wallet sync. On preprod the chain history is large enough to exhaust the default V8 heap.

**Fix:** `veilbook-cli/src/api.ts`
- Replaced `InMemoryTransactionHistoryStorage` with `NoOpTransactionHistoryStorage` (both from `@midnight-ntwrk/wallet-sdk-unshielded-wallet`)
- The CLI only deploys/calls contracts - it never reads transaction history, so discarding it is safe
- Added 40 unit tests in `veilbook-cli/src/test/transaction-history-storage.test.ts` covering:
  - Source-level regression (api.ts imports NoOp, not InMemory)
  - NoOp behavioral contract (create discards, get/delete return undefined)
  - InMemory contrast (confirms it retains - the OOM cause)
  - Memory growth comparison (NoOp flat, InMemory linear)
  - Interface compatibility (both satisfy TransactionHistoryStorage)
  - Edge cases (concurrency, null fees, all status types, large UTXOs)

---

## 2026-07-18 - Remove stale codemod scripts and dev scratch files

**Issue:** One-time codemod `.cjs` scripts in `contract/` and dev scratch files in `veilbook-cli/` cluttered the repo.

**Files removed:**
- `contract/*.cjs` (9 files): `fix_all.cjs`, `fix_cli.cjs`, `remove_workaround.cjs`, `script.cjs`, `update_api.cjs`, `update_cli.cjs`, `update_cli2.cjs`, `update_cli3.cjs`, `update_readme.cjs`
- `veilbook-cli/test-decode.js`, `veilbook-cli/test-decode.ts`, `veilbook-cli/test-native.ts`, `veilbook-cli/src/test-native.ts` (untracked dev scratch)

**Why safe to remove:** No file in the repo references any of these scripts (verified via grep). They performed one-shot exact-string replacements that have already been applied. Some contradict each other.
