# Veilbook: End-to-End Institutional Flow Manual

This manual provides authoritative, step-by-step instructions for executing a realistic dark pool intent-matching sequence. 

In a real-world scenario, you (the Deployer) orchestrate the network but do NOT participate as a trader. Two independent institutions (Trader A and Trader B) will connect to your dark pool and trade with each other.

Therefore, this test requires **3 separate wallets**:
1.  **The Deployer Wallet (CLI only):** Controls the dark pool and acts as a token faucet.
2.  **Wallet A (Browser 1 - e.g., Chrome):** Belongs to Institutional Firm A.
3.  **Wallet B (Browser 2 - e.g., Brave):** Belongs to Institutional Firm B.

## Important Information At-a-Glance
*   **Active Preprod Contract Address:** `c9cdf52982b1b8d41b411c10f84b8760840422907e11eeda79910b36291cbd6f`
*   **Deployer Admin Seed:** `91aa1d30794688d27b2560c037e42143943bef5c3d5a968c3ea209094e52c20e`

---

## Phase 1: Initialize Required Services
You must leave three terminal windows running in the background.

1.  **Start the ZK Proof Server (Docker):**
    ```bash
    cd veilbook/veilbook-cli
    docker compose -f proof-server.yml up -d
    ```

2.  **Start the WebSocket Relay Server:**
    ```bash
    cd veilbook/relay
    npx tsx server.ts
    ```

3.  **Start the Web UI:**
    ```bash
    cd veilbook/frontend
    npm run dev
    ```

---

## Phase 2: Distribute Test Tokens via CLI (The Administrator's Role)

Because the smart contract mints all custom tokens directly to the Deployer's wallet, neither Trader A nor Trader B has tokens yet. You must act as a token faucet and send them funds so they don't get an `InsufficientFunds` error when trying to use the dark pool.

**Step 2.1: Locate the Traders' Addresses**
1.  Open Browser 1 (Chrome) and log into Lace Wallet A. Click **Receive** and copy the **Unshielded Address** (`mn_addr_...`).
2.  Open Browser 2 (Brave) and log into Lace Wallet B. Click **Receive** and copy its **Unshielded Address**.

**Step 2.2: Send Tokens using the Deployer CLI Wallet**
1.  Open a terminal to run your Admin CLI:
    ```bash
    cd veilbook/veilbook-cli
    npm run preprod
    ```
2.  When prompted, select `Restore existing wallet from seed`.
3.  Paste the **Deployer Admin Seed**: `91aa...` (from the top of this document).
4.  Next, choose to `Join an existing contract` and paste the active address: `c9cdf5...`.
5.  From the Main Menu, choose `[6] Transfer Tokens`.
6.  Paste **Wallet A's Unshielded Address** and send them 500 tokens. Wait for confirmation.
7.  Repeat this process (`[6] Transfer Tokens`) to send 500 tokens to **Wallet B's Unshielded Address**.

*You are now finished with the Admin CLI. Both firms are funded.*

---

## Phase 3: Browser Preparation & Submitting Orders

**Firm A (Using Wallet A in Chrome):**
1.  Navigate to `http://localhost:3000/dashboard?contract=c9cdf52982b1b8d41b411c10f84b8760840422907e11eeda79910b36291cbd6f`
2.  Connect Wallet A (which now has 500 tokens).
3.  Fill out the institutional order:
    *   Direction: **BUY**
    *   Price: **50**
    *   Size: **100**
4.  Click **Submit Order** and sign the transaction in Lace. Wait for the feed to display `ORDER_COMMITTED`.

**Firm B (Using Wallet B in Brave):**
1.  Navigate to the exact same URL: `http://localhost:3000/dashboard?contract=c9cdf52982b1b8d41b411c10f84b8760840422907e11eeda79910b36291cbd6f`
2.  Connect Wallet B (which also has 500 tokens).
3.  Because of the relay server, Firm B will instantly see "PEER CONNECTED".
4.  Fill out the matching institutional order:
    *   Direction: **SELL**
    *   Price: **50**
    *   Size: **100**
5.  Click **Submit Order** and sign the transaction in Lace.

---

## Phase 4: ZK Order Matching

1.  After Firm A and Firm B have both completed their ledger submissions, both browsers will flash a badge stating `COUNTERPARTY_ORDER: ORDER_RECEIVED`.
2.  Because the prices overlap and the sizes are equal, the dark pool cryptographic logic is legally allowed to execute the swap.
3.  On **either** browser, a trader clicks the **EXECUTE_MATCH_PROTOCOL** button.
4.  That browser rapidly computes the matching Zero-Knowledge Proof locally. It asserts mathematically that the hidden conditions (`Buy >= Sell`) are satisfied, without broadcasting the private prices to the network.
5.  Upon blockchain finalization, the websocket relay updates both clients to **EXECUTED**, and the token escrow securely swaps between Firm A and Firm B.
