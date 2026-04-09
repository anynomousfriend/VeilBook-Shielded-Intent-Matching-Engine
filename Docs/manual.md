# Veilbook: End-to-End Institutional Flow Manual

This manual provides authoritative, step-by-step instructions for executing a realistic dark pool intent-matching sequence.

In a real-world scenario, you (the Deployer) orchestrate the network but do NOT participate as a trader. Two independent institutions (Trader A and Trader B) will connect to your dark pool and trade with each other.

This requires **3 separate wallets**:
1. **The Deployer Wallet (CLI only):** Deploys and controls the dark pool; acts as the token faucet.
2. **Wallet A (Browser 1 — e.g., Chrome):** Belongs to Institutional Firm A.
3. **Wallet B (Browser 2 — e.g., Brave):** Belongs to Institutional Firm B.

---

## Token Model (Important — Read First)

All custom tokens are **minted directly to the contract's treasury** at deploy time, not to the deployer's wallet. The contract holds 1,000,000 tokens. Only the deployer (owner) can call `transfer_tokens` to send tokens out of the contract treasury to trader wallets.

This means:
- The deployer's Lace wallet will show **zero custom tokens** — this is expected.
- Token distribution is done exclusively through the CLI's `[6] Transfer Tokens` menu option.
- Each call to `[6] Transfer Tokens` draws from the on-chain contract balance, not from the deployer's personal wallet.

---

## When to Redeploy vs. Join

| Situation | Action |
|---|---|
| First-time setup | Deploy a new contract |
| Contract source code changed | Redeploy — old on-chain bytecode is stale |
| Resuming a session with same contract | Join existing contract using saved address |
| Using a different deployer wallet | Deploy a new contract (owner is baked in at deploy time) |

> **Note:** The previous contract address (`c9cdf52982b1b8d41b411c10f84b8760840422907e11eeda79910b36291cbd6f`) is stale and uses old bytecode. Always deploy a fresh contract after any recompile.

---

## Phase 0: Build and Start Services

Run these once before any session. Leave them running in the background.

**Step 0.1: Compile the contract** (only needed after source changes)
```bash
cd veilbook/contract
npm run compact
npm test   # all 8 tests should pass
```

**Step 0.2: Start the ZK Proof Server**
```bash
cd veilbook/veilbook-cli
docker compose -f proof-server.yml up -d
```

**Step 0.3: Start the WebSocket Relay Server**
```bash
cd veilbook/relay
npx tsx server.ts
```

**Step 0.4: Start the Web UI**
```bash
cd veilbook/frontend
npm run dev
```

---

## Phase 1: Deploy the Contract (Deployer CLI)

This step puts a fresh contract on-chain with the treasury model. Do this once, then save the contract address for all subsequent sessions.

**Step 1.1: Start the Admin CLI**
```bash
cd veilbook/veilbook-cli
npm run preprod
```

**Step 1.2: Set up the deployer wallet**

Choose one of:
- **New wallet:** Select `Create a new wallet`. Save the displayed seed phrase securely — you will need it every session.
- **Restore wallet:** Select `Restore existing wallet from seed` and paste your saved seed.

> The deployer seed is the sole credential that controls the contract. Keep it safe.

**Step 1.3: Deploy the contract**

Select `Deploy a new contract`. The CLI will:
1. Call the constructor with `initial_supply = 1,000,000` tokens and set `owner` to the deployer's address.
2. Mint all 1,000,000 tokens to the **contract address** (not to your wallet).
3. Print the new **contract address** — copy and save it.

> This is the address you will use for all subsequent `join` operations and for the browser UI URL.

---

## Phase 2: Distribute Tokens to Traders (Deployer CLI)

Because the contract holds all tokens, you must transfer tokens to each trader's wallet before they can submit orders (orders require a token deposit).

**Step 2.1: Get trader wallet addresses**

1. Open Browser 1 (Chrome) → Lace Wallet A → click **Receive** → copy the **Unshielded Address** (`mn_addr_...`).
2. Open Browser 2 (Brave) → Lace Wallet B → click **Receive** → copy its **Unshielded Address**.

**Step 2.2: Fund Trader A**

In the Admin CLI (still running from Phase 1, or restart and choose `Join existing contract`):

1. From the Main Menu, choose `[6] Transfer Tokens`.
2. Paste **Wallet A's Unshielded Address**.
3. Enter the amount (e.g., `500`).
4. Wait for blockchain confirmation (~30–60 seconds on preprod).

**Step 2.3: Fund Trader B**

Repeat:
1. Choose `[6] Transfer Tokens`.
2. Paste **Wallet B's Unshielded Address**.
3. Enter `500`. Wait for confirmation.

Trader A and Trader B each now have 500 custom tokens in their Lace wallets. You are done with the Admin CLI.

> **Verify (optional):** Choose `[5] Get Token Balance` to see the contract's remaining treasury balance.

---

## Phase 3: Traders Connect and Submit Orders (Browser)

Both traders navigate to the dark pool UI using the **same contract address** you deployed in Phase 1.

**Firm A (Wallet A in Chrome):**

1. Navigate to:
   ```
   http://localhost:3000/dashboard?contract=<YOUR_CONTRACT_ADDRESS>
   ```
2. Connect Wallet A in Lace.
3. Fill out the order:
   - Direction: **BUY**
   - Price: **50**
   - Size: **100**
4. Click **Submit Order** and sign the Lace transaction prompt.
5. Wait for the feed to display `ORDER_COMMITTED` — this means the order and its token escrow are on-chain.

**Firm B (Wallet B in Brave):**

1. Navigate to the same URL as Firm A.
2. Connect Wallet B in Lace.
3. The relay server will show **PEER CONNECTED** in the feed once both browsers are connected.
4. Fill out the matching order:
   - Direction: **SELL**
   - Price: **50**
   - Size: **100**
5. Click **Submit Order** and sign the Lace prompt.
6. Wait for `ORDER_COMMITTED`.

> Order submission escrows the trader's tokens into the contract (`receiveUnshielded`). The contract holds both sides in escrow until the match executes.

---

## Phase 4: ZK Order Matching

Once both orders are committed on-chain:

1. Both browsers display `COUNTERPARTY_ORDER: ORDER_RECEIVED` — each party's relay feed shows the other's committed order.
2. Because the prices overlap (BUY 50 ≥ SELL 50) and sizes are equal (100 = 100), the matching conditions are satisfied.
3. On **either** browser, click **EXECUTE_MATCH_PROTOCOL**.
4. That browser computes a Zero-Knowledge Proof locally. The proof mathematically asserts that `BUY price ≥ SELL price` and the commitments are valid — without revealing the private order details to the network.
5. The matching transaction is submitted to preprod. Upon finalization:
   - Both orders' states change to `MATCHED`.
   - `match_count` increments by 1.
   - The escrowed tokens are returned to both parties via `sendUnshielded` (each gets back their 100-token deposit — in v1, exact-size swaps are symmetric).
6. The relay updates both clients to **EXECUTED**.

---

## Phase 5: Resuming a Session (No Redeploy)

After the initial deploy, future sessions only need to join the existing contract.

**Step 5.1: Start services** (Phase 0 steps 0.2–0.4 — relay and frontend must be running).

**Step 5.2: Start Admin CLI**
```bash
cd veilbook/veilbook-cli
npm run preprod
```

**Step 5.3: Restore deployer wallet**

Select `Restore existing wallet from seed` and enter your saved seed.

**Step 5.4: Join existing contract**

Select `Join an existing contract` and paste the saved contract address.

**Step 5.5: Continue from Phase 2**

Proceed with `[6] Transfer Tokens` to fund any new traders, then proceed to Phase 3.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Wallet.InsufficientFunds` on transfer | Old on-chain contract uses stale bytecode (`receiveUnshielded` in transfer path) | Redeploy a fresh contract |
| `Only the owner can transfer tokens` | CLI wallet seed doesn't match the deployer who deployed the contract | Use the correct deployer seed, or redeploy with the current wallet |
| Trader gets `InsufficientFunds` on order submit | Trader has no custom tokens | Run `[6] Transfer Tokens` from Admin CLI first |
| Prices don't overlap, match fails | BUY price < SELL price | Adjust order prices so BUY ≥ SELL |
| `ORDER_COMMITTED` never appears | ZK proof server not running | Run `docker compose -f proof-server.yml up -d` |
| Browser shows no peer | Relay server not running | Run `npx tsx server.ts` in `veilbook/relay` |
| `get_balance` returns 0 | Expected — simulator limitation; on-chain balance is real | Not a bug; the CLI `[5] Get Token Balance` on preprod returns the actual contract treasury |
