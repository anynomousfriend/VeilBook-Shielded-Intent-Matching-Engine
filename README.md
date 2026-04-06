# 🕵️‍♂️ Veilbook — The Shielded Dark Pool

**Veilbook** is a cutting-edge, privacy-preserving intent-matching engine built on the **Midnight Network**. It leverages Zero-Knowledge Proofs (ZKP) to allow institutional and retail traders to execute block trades without revealing sensitive order parameters like price, size, or identity to the public ledger.

---

## 📖 Table of Contents
- [Executive Summary](#-executive-summary)
- [Target Audience](#-target-audience)
- [Architecture & ZK Workflow](#-architecture--zk-workflow)
- [Project Structure](#-project-structure)
- [Installation Guide](#-installation-guide)
- [Operational Guide](#-operational-guide)
  - [Phase 1: CLI (Network & Contract Setup)](#phase-1-the-cli-network--contract-setup)
  - [Phase 2: Trading (CLI or Dashboard)](#phase-2-trading-cli-or-dashboard)
- [Standalone (Offline) Development](#-standalone-offline-development)
- [Technical Troubleshooting](#-technical-troubleshooting)

---

## 🚀 Executive Summary

In traditional finance, "Dark Pools" are private exchanges for trading securities that are not accessible to the investing public. However, these still rely on trusted intermediaries. 

**Veilbook** decentralizes the dark pool. By using the **Midnight Network’s** dual-state model (Public + Private), Veilbook ensures that:
- **Intents are Private:** Only the user knows their exact buy/sell price.
- **Matches are Cryptographic:** A match only occurs if a Zero-Knowledge circuit proves that two prices overlap.
- **Settlement is Atomic:** Once matched, the contract state updates on-chain without ever having "leaked" the trade details.

---

## 🎯 Target Audience

| Persona | Use Case |
| :--- | :--- |
| **Institutional Traders** | Execute large block trades without causing "slippage" or alerting front-runners. |
| **Privacy Advocates** | Trade assets on-chain while maintaining the same level of confidentiality as physical cash. |
| **Web3 Developers** | Learn how to implement **Midnight SDK**, **Compact** smart contracts, and **Local Proof Servers**. |

---

## 🧠 Architecture & ZK Workflow

Veilbook is built on a "Local-First" privacy model. The heavy lifting of privacy happens on the user's machine, not the network.

### 1. The "Private State"
Unlike Ethereum where all state is public, Veilbook uses **Private State Transitions**. When you submit an order, your local machine stores the "witness" (the secret price/size) and only sends a **Pedersen Commitment** (a cryptographic hash) to the network.

### 2. The Local Proof Server (Docker)
The **Proof Server** is the heart of the privacy engine. 
- It takes your private data + the `.zkir` (Zero-Knowledge Intermediate Representation) of the contract.
- It generates a **SNARK** (Succinct Non-interactive Argument of Knowledge).
- This proof is what gets sent to the Midnight Network. It says: *"I have a valid order that satisfies the contract logic,"* without saying what the order is.

### 3. Intent Matching
When a counterparty submits an opposing order, the `match_orders` circuit verifies that `Price_A >= Price_B` (for a Buy/Sell pair). If the proof is valid, the contract marks them as matched. The network sees a "Match Found" event, but the prices remain hidden inside the commitment.

---

## 📂 Project Structure

```text
veilbook/
├── 📜 contract/              # Smart contract logic written in Compact
│   └── src/veilbook.compact   # The ZK matching logic
├── 💻 frontend/              # Next.js 15 Web Dashboard with GSAP animations
│   └── lib/veilbook-api.ts    # Midnight SDK integration
└── 🛠 veilbook-cli/          # Node.js CLI for wallet, deployment & testing
    ├── proof-server.yml       # Docker config for Preprod ZK proving
    └── standalone.yml         # Docker config for local, offline Midnight network
```

---

## 🛠 Installation Guide

### Prerequisites
- **Node.js**: v22.15+ (LTS)
- **Docker Desktop**: Required for the local ZK Proof Server.
- **Midnight Compact**: [Install the compiler](https://github.com/midnightntwrk/compact) (v0.30.0 recommended).

### 1. Root Setup
```bash
npm install
```

### 2. Build the ZK Circuits
The smart contract must be compiled into WASM and ZKIR before the app can run.
```bash
cd contract
npm run compact   # Generates TypeScript/WASM from .compact
npm run build     # Compiles the contract wrapper
```

### 3. Launch the Proving Infrastructure
Veilbook requires a local environment to generate proofs for the Preprod network.
```bash
cd veilbook-cli
docker compose -f proof-server.yml up -d
```

---

## 🕹 Operational Guide

### Phase 1: The CLI (Network & Contract Setup)
Before you can trade, you must prepare your wallet and deploy the Veilbook smart contract.

**We recommend running the CLI with the embedded proof server to avoid connection issues:**
```bash
cd veilbook-cli
npm run preprod-ps
```
*(If you prefer to run the proof server separately, run `docker compose -f proof-server.yml up` in another terminal, then run `npm run preprod`.)*

1.  **Create Wallet:** Generate a new seed phrase. The CLI will automatically wait for the wallet to sync and register NIGHT UTXOs for DUST generation.
2.  **Fund:** If your balance is zero, the CLI will pause and display your **Unshielded Address**. Send `tNIGHT` to this address using the [Preprod Faucet](https://faucet.preprod.midnight.network).
3.  **Deploy Contract:** From the Contract Actions menu, select **[1] Deploy a new Veilbook contract**. 
4.  **Save Address:** Copy the generated Contract Address. You will need this to join the pool later.
5.  **Distribute Tokens:** After deployment, select **[5] Distribute Tokens** to mint your initial supply of the contract's custom trading token to your wallet.

### Phase 2: Trading (CLI or Dashboard)
You can interact with the deployed dark pool using either the CLI or the visual Web Dashboard.

#### Option A: Trading via the Web Dashboard
Launch the visual interface:
```bash
cd frontend
npm run dev
```
1.  Navigate to `http://localhost:3000/dashboard`.
2.  **Connect Wallet:** Link your Midnight-compatible browser wallet (e.g., Midnight Lace or Nightly Testnet Extension).
3.  **Join Pool:** Enter the **Contract Address** generated in Phase 1 to connect to the active dark pool.
4.  **Submit Intent:** Fill out the Order Form. Watch the "Sealed Envelope" animation as your ZK proof is generated locally.
5.  **Match:** Once two overlapping orders are in the pool, click the **Match** button to execute the privacy-preserving trade.

#### Option B: Trading via the CLI
If you prefer the terminal, you can test the full flow locally:
1.  In the CLI, select **[2] Join an existing Veilbook contract** and paste your Contract Address.
2.  Select **[1] Submit Order** to create your first order (e.g., Direction: BUY, Price: 50, Size: 100). The CLI will generate a ZK proof and store the commitment locally.
3.  Select **[1] Submit Order** again to create a counterparty order (e.g., Direction: SELL, Price: 45, Size: 100).
4.  Select **[2] Match Orders** and provide the Local IDs of your two orders (e.g., 0 and 1). The local proof server generates a ZK proof verifying the price overlap ($50 >= $45) without revealing the actual prices to the network.
5.  Select **[4] Display Status** to view the updated contract balance and order statuses.

---

## ⚡ Standalone (Offline) Development

If you don't want to wait for Preprod network block times or deal with faucets, you can run a fully local, instant Midnight node with a pre-funded genesis wallet.

**Run the Standalone CLI (all-in-one command):**
```bash
cd veilbook-cli
npm run standalone
```
*Note: This command automatically spins up the `standalone.yml` Docker cluster (Node, Indexer, Proof Server), connects the CLI using the pre-funded genesis seed, and provides instantaneous DUST generation for rapid testing end-to-end.*

---

## 🛠 Technical Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **`ECONNREFUSED 6300`** | Your Proof Server is not running. Run `docker ps` to verify the container state. |
| **"Insufficient DUST"** | You need to register your NIGHT UTXOs. In the CLI, select "Manage DUST" and wait for the transaction to clear. |
| **ZK Proof Timeout** | Generating SNARKs is CPU intensive. Ensure your machine has at least 8GB of RAM allocated to Docker. |
| **Contract Mismatch** | If you change `veilbook.compact`, you **must** re-run `npm run compact` and restart the frontend. |
| **Wallet Connection Fails** | Ensure you have installed the specific Midnight Testnet version of the Lace or Nightly browser extension, not the Cardano mainnet version. |

---

<p align="center">
  Built with ❤️ on the <b>Midnight Network</b>
</p>
