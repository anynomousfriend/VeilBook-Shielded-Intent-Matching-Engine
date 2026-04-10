# Veilbook — The Shielded Dark Pool

Built on [Midnight](https://midnight.network/).

Veilbook is a privacy-preserving intent-matching engine — a fully decentralised dark pool where traders submit shielded order commitments and match them cryptographically. Prices, sizes, and identities remain confidential until a match is confirmed on-chain. No front-running. No information leakage. No trusted intermediary.

---

## The Problem Nobody Has Solved

Every day, $200 billion moves through dark pools in traditional finance. Why? Because when you place a large order on a public exchange, the market sees it before it executes. Bots front-run you. Prices move against you. Your strategy is exposed to every competitor watching the order book.

Crypto made this worse, not better. On Ethereum, Solana, every public DEX — your pending transactions sit in a mempool for the world to see. MEV bots extracted $900M+ in 2023 alone by front-running, sandwiching, and exploiting transparent order flow.

The industry's answer? "Use a centralised dark pool." Which defeats the entire point of decentralisation. You're just trusting a different intermediary.

**Until now, the choice has been: privacy OR trustlessness. Pick one.**

Veilbook — built on Midnight's Kachina model — gives you both.

---

## How It Works

```
Trader A: BUY 500 @ 42  →  sealed commitment: 7a3f91b2...  →  on-chain
Trader B: SELL 500 @ 40  →  sealed commitment: e8c2d4a1...  →  on-chain

ZK circuit runs locally:
  BUY price (42) >= SELL price (40)  ✓
  Sizes match (500 == 500)           ✓
  Directions are opposite            ✓

Proof submitted. Match confirmed. match_count increments.
What was revealed on-chain: "these two commitments form a valid trade."
What was NOT revealed: prices, sizes, or identities.
```

The blockchain cannot see the private data — not "won't", **cannot**. The architecture makes it cryptographically impossible.

---

## What's Live Now

### Smart Contract (`contract/src/veilbook.compact`)

The Compact contract implements a simplified but production-representative dark pool:

| Circuit | Who Can Call | What It Does |
| :--- | :--- | :--- |
| `submit_order()` | Any wallet | Hashes an order (direction, price, size) with a random nonce using `persistentCommit`. Only the commitment hash goes on-chain — order details never leave the user's device. |
| `match_orders(commit_a, commit_b)` | Any wallet | Verifies two open commitments represent a valid pair: opposite directions, exact size match, crossing prices. Increments `match_count` on success. |
| `cancel_order(commitment)` | Order owner only | Proves ownership by reconstructing the commitment locally (ZK ownership proof), then marks the order as cancelled. |
| `get_balance()` | Anyone | Returns the contract's current unshielded token balance. |
| `transfer_tokens(amount, recipient)` | Owner only | Distributes demo tokens from the contract to any unshielded address. |

**Key design decisions:**
- Orders are salted with a random nonce — two identical orders produce different on-chain hashes, preventing dictionary attacks.
- `disclose()` is called only on the *comparison result*, not on the values themselves. The ledger sees a boolean "valid match", never the prices.
- No token escrow in order flow — the contract tracks commitments and states only, eliminating the "insufficient funds" failure mode for demo wallets.
- Ownership for cancellation is proved via ZK commitment reconstruction, not by checking `msg.sender`.

### Frontend Dashboard (`frontend/`)

A Next.js 15 split-screen demo designed for two browser wallets running simultaneously:

- **Wallet connect** via Midnight Lace browser extension
- **Order form** — enter direction (BUY/SELL), price, and size; ZK proof generated client-side
- **WebSocket relay** — order metadata (commitment hash, direction) shared between browsers in real time without exposing private values
- **Counterparty panel** — shows peer connection status, their commitment hash, and direction (size/price remain hidden)
- **Match button** — either party triggers `match_orders`; race conditions handled gracefully (both succeed)
- **Public feed** — live stream of on-chain commitment and match events
- **Auto-join** — both browsers join the pre-deployed contract via `NEXT_PUBLIC_VEILBOOK_ADDRESS`; no wallet needs to be the contract owner to submit intents

### CLI (`veilbook-cli/`)

Interactive Node.js CLI for wallet management and contract operations:

- Create or restore a wallet from seed
- Deploy a new Veilbook contract or join an existing one by address
- Submit, match, and cancel orders interactively
- Transfer tokens to demo wallet addresses
- Monitor DUST balance in real time
- Standalone deployment script (`npm run deploy`) that writes the contract address to `deployed-address.txt`

### Relay Server (`relay/`)

A lightweight stateless WebSocket message bus. Browsers connect via a shared contract address as the room ID. The relay forwards order commitments and match signals between peers — it never sees private order data.

---

## Project Structure

```
veilbook/
├── contract/
│   ├── src/veilbook.compact        # ZK circuit logic (Compact language)
│   ├── src/witnesses.ts            # TypeScript witness providers (private state)
│   └── src/managed/veilbook/       # Generated ZK keys, ZKIR, and contract types
├── frontend/
│   ├── app/dashboard/page.tsx      # Main two-trader demo page
│   ├── lib/veilbook-api.ts         # Midnight SDK browser integration
│   ├── lib/providers.ts            # Browser wallet → MidnightProvider adapter
│   ├── contexts/WalletContext.tsx  # Lace wallet connection state
│   ├── hooks/use-relay.ts          # WebSocket relay hook
│   └── public/zk/                  # ZK keys served to browser for proof generation
├── veilbook-cli/
│   ├── src/api.ts                  # Wallet and contract management
│   ├── src/cli.ts                  # Interactive CLI
│   ├── src/deploy-preprod.ts       # One-shot deployment script
│   └── proof-server.yml            # Docker config for local ZK proof server
└── relay/
    └── server.ts                   # WebSocket relay server
```

---

## Installation & Setup

### Prerequisites

- **Node.js** v22.15+ (LTS)
- **Docker** — for the local ZK proof server
- **Midnight Compact** compiler v0.30.0 — [install guide](https://github.com/midnightntwrk/compact)
- **Midnight Lace Wallet** browser extension — for the frontend demo

### SDK Versions

| Package | Version |
| :--- | :--- |
| `@midnight-ntwrk/compact-runtime` | `0.15.0` |
| `@midnight-ntwrk/midnight-js-*` | `^4.0.0` |
| `@midnight-ntwrk/wallet-sdk-*` | `^3.0.0` |
| Compact compiler | `0.30.0` |

### Step-by-Step

**1. Clone and install**
```bash
git clone git@github.com:anynomousfriend/VeilBook---The-Shielded-Dark-Pool.git
cd veilbook
npm install
```

**2. Compile the contract**
```bash
cd contract
npm run compact   # generates ZK keys + ZKIR + managed types
npm run build     # builds the TypeScript package
cd ..
```

**3. Start the ZK proof server**
```bash
cd veilbook-cli
docker compose -f proof-server.yml up -d
cd ..
```

**4. Deploy the contract**
```bash
cd veilbook-cli
npm run deploy
# writes the contract address to deployed-address.txt
```

**5. Sync the address into the frontend**
```bash
NEW=$(cat veilbook-cli/deployed-address.txt | tr -d '[:space:]')
echo "NEXT_PUBLIC_VEILBOOK_ADDRESS=$NEW" > frontend/.env
# also set: NEXT_PUBLIC_NETWORK=preprod
# also set: NEXT_PUBLIC_RELAY_URL=ws://localhost:4400
```

**6. Copy ZK assets to the frontend public directory**
```bash
cp -f contract/src/managed/veilbook/keys/* frontend/public/zk/keys/
cp -f contract/src/managed/veilbook/zkir/* frontend/public/zk/zkir/
```

**7. Start the relay server**
```bash
cd relay
npx tsx server.ts
```

**8. Start the frontend**
```bash
cd frontend
npm run dev
```

Open two browser windows at `http://localhost:3000/dashboard`. Connect a different Lace wallet in each. One submits a BUY order, the other submits a SELL. Either party can trigger the match.

---

## Two-Browser Demo Flow

```
Browser 1 (BUY wallet)          Browser 2 (SELL wallet)
─────────────────────           ──────────────────────
Connect Lace wallet             Open shared URL (?contract=...)
Submit BUY order                Connect Lace wallet
  → ZK proof generated          Submit SELL order
  → Commitment on-chain           → ZK proof generated
  → Relay broadcasts hash         → Commitment on-chain
  → "Counterparty received"       → Relay broadcasts hash

Either browser clicks "MATCH"
  → match_orders() called
  → ZK circuit verifies both commitments
  → match_count increments on-chain
  → Both panels show EXECUTED
```

Neither browser ever sees the other's price or size. The relay only forwards the commitment hash and direction.

---

## Why Midnight

| Chain | Order Privacy | Trustless | Programmable ZK |
| :--- | :--- | :--- | :--- |
| Ethereum / EVM | No — mempool is public | Yes | No |
| Zcash / Monero | Tx-level only | Yes | No |
| Secret Network | Yes (SGX hardware) | No — trust Intel | Limited |
| Aztec | Partial | Yes | Yes (scalability focus) |
| **Midnight** | **Yes — protocol level** | **Yes** | **Yes — Kachina model** |

Midnight's Compact language is **private by default** — you explicitly `disclose()` what should be public. Every other smart contract language is public by default. Private state lives on the user's device as witnesses; only commitments touch the chain. Proof generation and verification are built into the consensus layer — no bolted-on circuits, no external trust assumptions.

---

## Roadmap

The following features are planned for future versions:

### v2 — Settlement Layer
- Re-introduce atomic token escrow (`receiveUnshielded` / `sendUnshielded`) once multi-wallet token distribution tooling stabilises on Preprod
- Partial fill support using nullifier-based state splitting
- Configurable settlement price (midpoint between BUY and SELL price)

### v3 — Multi-Party Order Book
- On-chain order book with multiple open commitments per address
- Order expiry via block-height TTL encoded in the commitment
- Matchmaker role — a neutral third party who triggers matches without learning order details
- Priority queue matching (best price / earliest time) provable in ZK

### v4 — Institutional Features
- Request-for-Quote (RFQ) flow — private bilateral negotiation before on-chain settlement
- Sealed-bid auction circuit — generalise the matching logic for NFTs, treasury bonds, and carbon credits
- Regulatory audit trail — optional disclosed settlement record for MiFID II / Reg ATS compliance, without revealing live order flow
- Multi-asset pairs — extend `Order` struct to carry a token color field for cross-asset matching

### Infrastructure
- Hosted proof server with rate limiting (removes Docker dependency for end users)
- Persistent private state across sessions using encrypted local storage
- Mobile-compatible frontend with WalletConnect support for Midnight mobile wallets
- Indexer-driven order book feed — replace the relay server with a proper on-chain event stream

---

## One Sentence

Veilbook proves that you can match orders, settle trades, and enforce market rules on a blockchain — without the blockchain ever knowing what was traded, at what price, or by whom.

That's not a feature. That's a new category. And it's only possible on Midnight.

---

## License

Apache-2.0 — see [LICENSE](./LICENSE).
