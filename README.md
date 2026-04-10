# 🕵️‍♂️ Veilbook — The Shielded Dark Pool

Veilbook is a privacy-preserving intent-matching engine — a fully decentralised dark pool built on the Midnight blockchain. It allows traders to submit shielded order commitments and match them cryptographically. 

**For whom is it?** Institutional traders, crypto whales, and privacy-conscious retail users who need to move significant volume without moving the market.
**Why does it exist?** To solve the trillion-dollar problem of Maximal Extractable Value (MEV). On public ledgers, bots front-run your trades and exploit your transparent order flow. Veilbook ensures that prices, sizes, and trader identities remain strictly confidential until a match is confirmed on-chain. No front-running. No information leakage. No trusted intermediary.

---

## Installation & Setup

### Prerequisites
Before running this application, ensure you have the following installed:
- **Node.js** (v22 or higher)
- **npm** (v10 or higher)
- **Midnight Lace Wallet** browser extension
- **Compact Compiler** (`compactc` v0.30.0) for building the contract
- **Docker** (required for running the local ZK Proof Server)

### Midnight SDK Versions
This project uses the stable Midnight SDK:

| Package | Version |
| :--- | :--- |
| `@midnight-ntwrk/midnight-js-*` | `^4.0.0` |
| `@midnight-ntwrk/ledger-v8` | `8.x.x` |
| `@midnight-ntwrk/compact-js` | `^0.30.0` |
| `@midnight-ntwrk/compact-runtime` | `^0.15.0` |
| `@midnight-ntwrk/wallet-sdk-*` | `^3.0.0` |

### 1. Clone and Install Dependencies
```bash
git clone https://github.com/anynomousfriend/VeilBook---The-Shielded-Dark-Pool.git
cd VeilBook---The-Shielded-Dark-Pool
npm install
```

### 2. Build the Contract
The Compact smart contract must be compiled before running the UI or CLI:
```bash
cd contract
npm run compact
npm run build
```
This compiles the Compact contract and generates:
- JavaScript bindings in `src/managed/veilbook/contract/`
- Prover/verifier keys in `src/managed/veilbook/keys/`
- ZK intermediate representations in `src/managed/veilbook/zkir/`

### 3. Run the Contract Tests (Optional)
```bash
cd contract
npm run test
```

### 4. Start the Proof Server
The local proof server is required to generate zero-knowledge proofs locally, ensuring your private trade data never leaves your device. Start it before running the UI or CLI:
```bash
cd veilbook-cli
npm run preprod-ps
```
*(This runs a Docker container on `http://localhost:6300`)*

### 5. Build and Run the CLI
The CLI is used to deploy contracts, distribute demo tokens, and manage the DApp. First, build it:
```bash
cd veilbook-cli
npm run build
```
Then run the CLI connecting to the Midnight Preprod network:
```bash
npm run preprod
```
This requires a wallet seed (set via `DEPLOYER_SEED` in `veilbook-cli/.env`) funded with `tNight` tokens from the Midnight Faucet.

**CLI Interactive Menu**
Once running, the CLI presents an interactive menu:
1. `Deploy new Veilbook Contract` (Saves address to `deployed-address.txt`)
2. `Join existing Veilbook Contract`
3. `Display Status`
4. `Check Wallet Balances`
5. `Transfer Tokens` (Admin utility to fund test wallets)
6. `Submit Order / Match Orders / Cancel Order`

### 6. Start the Relay Server
Veilbook uses a lightweight WebSocket relay to broadcast commitment hashes between peers.
```bash
cd relay
npm install
npx tsx server.ts
```

### 7. Build and Run the UI
Make sure to copy the newly generated ZK assets to the frontend before starting:
```bash
cp -rf contract/src/managed/veilbook/keys/* frontend/public/zk/keys/
cp -rf contract/src/managed/veilbook/zkir/* frontend/public/zk/zkir/
```
Then start the development server:
```bash
cd frontend
npm run dev
```
The UI will be available at `http://localhost:3000/dashboard`.

### Environment Configuration
The UI connects automatically to the contract address specified in your `.env`:
```env
NEXT_PUBLIC_VEILBOOK_ADDRESS=5ccd077b2708ec890a83ffa6e4c4c0c50d9363bb0af07384d13af1fc9c078432
NEXT_PUBLIC_RELAY_URL=ws://localhost:4400
```

---

## Project Structure

```text
veilbook/
├── contract/                    # Compact smart contract
│   ├── src/
│   │   ├── veilbook.compact     # Core dark pool ZK logic
│   │   ├── witnesses.ts         # TypeScript private state fetchers
│   │   └── test/                # Contract tests & simulator
│   └── src/managed/             # Compiled output (keys, ZKIR, TS bindings)
├── veilbook-cli/                # Command-line interface
│   ├── src/
│   │   ├── api.ts               # Contract deployment & interaction
│   │   └── cli.ts               # Interactive terminal menu
│   └── proof-server.yml         # Docker config for local ZK proof server
├── frontend/                    # Next.js React frontend
│   ├── app/dashboard/           # Main split-screen trading UI
│   ├── lib/                     # MidnightJS SDK integration & providers
│   └── public/zk/               # ZK proving assets served to the browser
└── relay/                       # Peer-to-peer WebSocket service
    └── server.ts                # Relay server logic
```

---

## Relay Service
The Relay Service acts as a stateless, decentralized message bus for traders. Because the Midnight blockchain only stores hashed order commitments, traders need a way to announce their presence to counterparties. 

When a trader submits an order, the browser sends the *on-chain hash* (not the private order details) to the relay. The relay broadcasts this hash to other traders connected to the same contract address. The Relay Server never sees prices, sizes, or cryptographic nonces.

---

## The Rationale of the Veilbook Shielded Dark Pool

Veilbook is a decentralized application (DApp) designed to showcase the powerful privacy-preserving capabilities of the Midnight stack. It demonstrates how rational privacy solves one of the most toxic problems in modern decentralized finance.

### The Problem with Traditional & Crypto Exchanges
In conventional DeFi, applying for a trade is an entirely transparent process. An individual broadcasts their trade direction, size, and limit price to a public mempool. This creates critical structural flaws:
1. **MEV & Front-Running:** Bots scan the mempool, see a large pending BUY order, and buy the asset first, instantly selling it back to the victim at a higher price (Sandwich attacks).
2. **Information Leakage:** Institutional trading strategies are exposed. The moment a whale begins accumulating an asset, the entire market reacts before their order is filled.
3. **Centralized Alternatives:** To escape this, traders retreat to centralized dark pools, sacrificing self-custody and trusting a black-box operator not to trade against them.

### Midnight's Solution: Rational Privacy in Action
Veilbook leverages Midnight's Kachina model to completely decouple the *knowledge* of a trade from the *validation* of a trade.

- **The Private State:** The trader's actual order (Direction, Price, Size) and a cryptographic Nonce remain securely on their local machine. This data is provided to the circuit as a *witness* and is never transmitted to the network.
- **The Public State:** The contract only records the `commitment` (a cryptographic hash of the order) and its status (`OPEN`, `MATCHED`, `CANCELLED`).

The bridge between these two worlds is the **Zero-Knowledge Proof**. The local proof server evaluates the private data off-chain to ensure two orders are a valid match (crossing prices, opposite directions). It then submits a proof to the ledger. The blockchain verifies the proof without ever seeing the underlying prices. 

**Until now, the choice has always been: Privacy OR Trustlessness. Pick one. Veilbook gives you both.**

### Live Deployment Info
You can interact with Veilbook live on the Midnight Preprod network today. 
- **Network:** Midnight Preprod
- **Deployed Veilbook Contract:** `5ccd077b2708ec890a83ffa6e4c4c0c50d9363bb0af07384d13af1fc9c078432`
- **View on Explorer:** [Midnight Preprod Explorer](https://explorer.preprod.midnight.network/contracts/stream/5ccd077b2708ec890a83ffa6e4c4c0c50d9363bb0af07384d13af1fc9c078432)

*(Note: Ensure your Lace wallet network is set to Preprod before connecting).*

---

## 🛣️ Roadmap & Future Phases

Due to current time constraints and Midnight Preprod limitations, Veilbook is currently in **Phase 1: The Core Matching Engine**. To evolve into a fully-fledged institutional dark pool, the following phases are planned:

### Phase 2: Trustless Atomic Settlement
Currently, Veilbook handles the intent and cryptographic matching of orders. The next immediate step is integrating Midnight's native token shielding (`receiveUnshielded` / `sendUnshielded`) directly into the ZK circuits. Upon a successful match, the smart contract will atomically swap the underlying shielded tokens between the buyer and seller, eliminating counterparty risk entirely.

### Phase 3: Fragmented Order Fills & Nullifier State Splitting
In real-world dark pools, large block orders are rarely filled by a single counterparty. Phase 3 will introduce Nullifier-based state splitting. When a 10,000 token BUY order is matched against a 2,000 token SELL order, the ZK circuit will invalidate the original 10,000 token commitment and automatically generate a new, valid commitment for the remaining 8,000 tokens — all without revealing the original or remaining size to the public ledger.

### Phase 4: Decentralized Matchmaker Nodes
To improve liquidity discovery without compromising privacy, Veilbook will introduce decentralized "Matchmaker" nodes (replacing the simple Relay Server). Traders will submit their ZK proofs and encrypted order data to these nodes. The Matchmakers will run algorithms to pair overlapping orders and submit the final settlement proofs to the blockchain. Because the order data remains encrypted via ZK, the Matchmakers cannot see the prices or front-run the trades, but they earn a fraction of the spread for successfully finding a match.

---

## 2. Goals of the Example

Veilbook is designed to achieve three primary educational goals for developers building on the Midnight ecosystem:

**Goal 1: Demonstrating Private Data Processing (Commitments)**
It provides a clear template for handling sensitive intent data. The `submit_order` circuit demonstrates how to use the `persistentCommit` function to hash public user inputs (Direction, Price, Size) together with a locally generated secret `nonce`. This ensures the blockchain can record the existence of an order without knowing its contents, while preventing dictionary attacks.

**Goal 2: Managing Shielded State & ZK Comparisons**
The `match_orders` circuit moves beyond simple storage to demonstrate complex relational logic in Zero-Knowledge. It takes two opaque commitment hashes, forces the local user to prove they know the pre-images (the underlying order details) for both, and uses `assert(disclose(...))` to verify crossing logic (Prices match, Sizes match, Directions are opposite) *without* disclosing the actual numbers.

**Goal 3: Zero-Knowledge Ownership**
The `cancel_order` circuit demonstrates how to prove ownership of an asset/intent on Midnight without relying on `msg.sender`. Instead of checking if the caller's address matches the order creator, the circuit requires the caller to provide the exact `order` and `nonce` that successfully hashes to the on-chain commitment.

---

## 3. Contract Features

The Veilbook contract is designed with two distinct roles: the **Trader** and the **Owner** (Deployer).

### The Trader Role
The primary user of the DApp. Their interactions are completely permissionless.
- **Submitting Orders (`submit_order`):** Any user can submit a shielded order.
- **Matching Orders (`match_orders`):** Any user who discovers a compatible counterparty commitment can submit a match proof to the network.
- **Canceling Orders (`cancel_order`):** Users can remove their commitments from the active pool. Only the creator (who holds the secret nonce) can generate this proof.

### The Owner Role
The Owner role is assigned to the wallet that deploys the contract.
- **Funding Wallets (`transfer_tokens`):** For demonstration purposes, the contract mints a custom token upon deployment. The Owner can call `transfer_tokens` to distribute these demo tokens to traders, allowing them to simulate trades. 

---

## 4. Circuit Logic and Design Decisions

### `submit_order` Circuit
**Logic:** Takes the private order details and nonce from the local witness, hashes them, and stores the commitment in the `orders_state` ledger map.
**Design Decision:** The order data is never passed as a function argument. By retrieving it exclusively via `getOrder()` and `getOrderNonce()` witnesses, we guarantee the data originates directly from the user's local, isolated memory state.

### `match_orders` Circuit
**Logic:** 
```typescript
  assert(disclose(a_order.direction != b_order.direction), "Orders must be opposite");
  assert(disclose(a_order.size == b_order.size), "Size mismatch");
  
  if (disclose(a_order.direction == 0)) { // A is BUY, B is SELL
    assert(disclose(a_order.price >= b_order.price), "Price mismatch");
  }
```
**Design Decision:** The `disclose()` wrapper is used *only* on the boolean result of the comparison (`a_order.size == b_order.size`). It does not disclose the size itself. This is the core magic of Midnight: The network verifies that "Order A's size equals Order B's size is TRUE", without ever knowing what the size actually is.

### `cancel_order` Circuit
**Logic:** Verifies the user knows the pre-image of the commitment, then updates the status in `orders_state` to `CANCELLED`.
**Design Decision:** State transitions are handled explicitly. Instead of deleting the commitment from the map, its state is updated to `CANCELLED`. This prevents the `match_orders` circuit from utilizing it (as `match_orders` requires the state to be `OPEN`), while preserving an on-chain audit trail of intent flow.
