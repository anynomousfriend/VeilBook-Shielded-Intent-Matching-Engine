# 🕵️‍♂️ Veilbook — The Shielded Dark Pool Example

Built on [Midnight](https://midnight.network/).

Veilbook is a privacy-preserving intent-matching engine that demonstrates how to build a "Dark Pool" on a blockchain using Zero-Knowledge Proofs (ZKP). It allows traders to submit shielded order intents and match them cryptographically, ensuring that prices, sizes, and identities remain confidential until a match is confirmed.

---

## 🛠 INSTALLATION & SETUP

### PREREQUISITES

- **Node.js**: v22.15+ (LTS recommended)
- **Docker**: Required for running the local ZK Proof Server.
- **Midnight Compact**: [Install the compiler](https://github.com/midnightntwrk/compact) (v0.30.0 recommended).
- **Midnight Lace Wallet**: Required for the frontend dashboard.

### MIDNIGHT SDK VERSIONS

| Package | Version |
| :--- | :--- |
| `@midnight-ntwrk/compact-runtime` | `0.15.0` |
| `@midnight-ntwrk/midnight-js-*` | `^4.0.0` |
| `@midnight-ntwrk/wallet-sdk-*` | `^3.0.0` |
| `compact-compiler` | `0.30.0` |

### Step-by-Step Guide

1.  **Clone the Repository**
    ```bash
    git clone git@github.com:anynomousfriend/VeilBook---The-Shielded-Dark-Pool.git
    cd veilbook
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Compile the Smart Contract**
    The contract must be compiled into WASM and ZKIR for both the CLI and Frontend.
    ```bash
    cd contract
    npm run compact
    npm run build
    cd ..
    ```

4.  **Launch the ZK Proof Server**
    Veilbook requires a local environment to generate heavy ZK proofs.
    ```bash
    cd veilbook-cli
    docker compose -f proof-server.yml up -d
    cd ..
    ```

5.  **Run the CLI (Network Setup)**
    Use the CLI to create a wallet, fund it with `tNIGHT`, and deploy the contract.
    ```bash
    cd veilbook-cli
    npm run preprod
    ```

6.  **Launch the WebSocket Relay Server**
    The relay synchronizes counterparty state between browsers without requiring chain access.
    ```bash
    cd relay
    npx tsx server.ts
    ```

7.  **Launch the Web Dashboard**
    Interact with the dark pool via a visual interface. Open the dashboard, commit an order, and share the generated URL (with `?contract=<addr>`) to connect with a counterparty.
    ```bash
    cd frontend
    npm run dev
    ```

---

## 📂 PROJECT STRUCTURE

```text
veilbook/
├── 📜 contract/              # Smart contract logic (Compact)
│   ├── src/veilbook.compact   # ZK circuit logic for matching
│   └── src/witnesses.ts       # TypeScript witness providers
├── 💻 frontend/              # Next.js 15 Dashboard
│   ├── components/            # UI components and animations
│   └── lib/veilbook-api.ts    # Midnight SDK DApp integration
└── 🛠 veilbook-cli/          # Node.js CLI & API
    ├── src/api.ts             # Wallet and contract management logic
    ├── src/deploy-preprod.ts  # Contract deployment script
    └── proof-server.yml       # Docker config for ZK proof generation
└── 📡 relay/                 # WebSocket Relay Server
    └── server.ts              # Stateless message bus for browser coordination
```

---

## 🧠 THE RATIONALE OF THE VEILBOOK SHIELDED DARK POOL EXAMPLE

### THE PROBLEM
In traditional finance, "Dark Pools" are private exchanges for trading large blocks of securities. However, they rely on trusted intermediaries. In the Web3 world, most Decentralized Exchanges (DEXs) are fully public, leading to:
- **Information Leakage:** Large trades signal intent to the market, causing price slippage before execution.
- **Front-Running (MEV):** Arbitrageurs can see pending orders and trade ahead of them.
- **Lack of Institutional Privacy:** Fund managers cannot rebalance portfolios without revealing their strategy to competitors.

### MIDNIGHT’S SOLUTION
Veilbook leverages Midnight’s **Kachina model** to provide a decentralized, trustless dark pool.
- **Private State:** Order details (Price, Size, Direction) stay on the user's machine as "witnesses."
- **Public Commitments:** Only a cryptographic hash (Pedersen Commitment) of the order is stored on the ledger.
- **ZK Matching:** A Matchmaker (or the parties themselves) can run a ZK circuit that proves `Price_Buy >= Price_Sell` without the contract ever knowing what those prices were.

---

## 🎯 GOALS OF THE EXAMPLE
1.  **Confidential Intent Matching:** Demonstrate how to compare private values (prices) using ZK circuits.
2.  **Commitment-Based State:** Show how to manage a ledger of opaque "promises" that can later be fulfilled or cancelled.
3.  **Atomic ZK-Settlement:** Use Midnight's native token features (`receiveUnshielded`/`sendUnshielded`) to escrow and distribute assets based on ZK proof outcomes.

---

## ⚡ CONTRACT FEATURES

### Trader Actions
- **`transfer_tokens(recipient, amount)`**: Allows the deployer to distribute custom test tokens to other users' Unshielded Addresses to cover order escrows.
- **`submit_order(deposit)`**: Hashes an order (Price, Size, Direction) and locks the corresponding tokens in the contract's escrow.
- **`match_orders(commit_a, commit_b)`**: Takes two public commitments and local private witnesses. It proves they are a valid pair (opposite directions, matching size, overlapping price) and settles the trade.
- **`cancel_order(commitment)`**: Allows a user to reconstruct their commitment locally to prove ownership and reclaim their locked tokens.

---

## 🛠 CIRCUIT LOGIC AND DESIGN DECISIONS

### 1. Commitment-Based Privacy
The `submit_order` circuit uses `persistentCommit<Order>(order, nonce)`.
- **Design Decision:** By including a `nonce` (salt), we ensure that two identical orders (e.g., BUY 100 at $50) result in different public hashes, preventing "dictionary attacks" where observers guess order details by hashing common values.

### 2. ZK Matching Logic
The `match_orders` circuit is the core of the dark pool.
```compact
if (disclose(a_order.direction == 0)) { // A is BUY, B is SELL
  assert(disclose(a_order.price >= b_order.price));
}
```
- **Design Decision:** We use `disclose()` on the *comparison result*, not the values themselves. The circuit outputs a boolean "Valid Match" to the ledger. If the prices don't overlap, the proof generation fails, and the public state is never updated.

### 3. Fixed-Size Matching (v1)
- **Design Decision:** In this example, we require `a_order.size == b_order.size`. While partial fills are possible in ZK, they require complex "nullifier" management or state splitting. To keep this example focused on *price* privacy, we enforce exact size matching.

### 4. Atomic Escrow
- **Design Decision:** Tokens are moved into the contract's `token_color` during `submit_order`. This prevents "double-spending" an intent. The tokens are only released when a valid ZK proof of a match or a cancellation is submitted.

---
