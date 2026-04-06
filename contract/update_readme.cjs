const fs = require('fs');
const path = require('path');

const readmePath = path.resolve('../README.md');
let content = fs.readFileSync(readmePath, 'utf-8');

// Update Phase 1: CLI
const oldPhase1 = `### Phase 1: The CLI (Network & Contract Setup)
Before you can trade, you must prepare your wallet and deploy the Veilbook smart contract.

\`\`\`bash
cd veilbook-cli
npm run start:preprod
\`\`\`
1.  **Create Wallet:** Generate a new seed phrase.
2.  **Fund:** Send \`tNIGHT\` to your **Unshielded Address** using the [Preprod Faucet](https://faucet.preprod.midnight.network).
3.  **Generate DUST:** Use option **[3]** in the CLI. **DUST** is a specialized token on Midnight required to pay for ZK proof verification. Wait for this transaction to clear.
4.  **Deploy Contract:** Select **[1] Deploy a new Veilbook contract**. 
5.  **Save Address:** Copy the generated Contract Address. You will need this to join the pool.`;

const newPhase1 = `### Phase 1: The CLI (Network & Contract Setup)
Before you can trade, you must prepare your wallet and deploy the Veilbook smart contract.

**We recommend running the CLI with the embedded proof server to avoid connection issues:**
\`\`\`bash
cd veilbook-cli
npm run preprod-ps
\`\`\`
*(If you prefer to run the proof server separately, run \`docker compose -f proof-server.yml up\` in another terminal, then run \`npm run preprod\`.)*

1.  **Create Wallet:** Generate a new seed phrase. The CLI will automatically wait for the wallet to sync and register NIGHT UTXOs for DUST generation.
2.  **Fund:** If your balance is zero, the CLI will pause and display your **Unshielded Address**. Send \`tNIGHT\` to this address using the [Preprod Faucet](https://faucet.preprod.midnight.network).
3.  **Deploy Contract:** From the Contract Actions menu, select **[1] Deploy a new Veilbook contract**. 
4.  **Save Address:** Copy the generated Contract Address. You will need this to join the pool later.
5.  **Distribute Tokens:** After deployment, select **[5] Distribute Tokens** to mint your initial supply of the contract's custom trading token to your wallet.`;

content = content.replace(oldPhase1, newPhase1);

// Update Phase 2: Trading
const oldPhase2 = `#### Option B: Trading via the CLI
If you prefer the terminal, you can test the full flow locally:
1.  In the CLI, select **[2] Join an existing Veilbook contract** and paste your Contract Address.
2.  Select **[1] Submit Order A** (e.g., BUY 100 tokens at $50).
3.  Select **[2] Submit Order B** (e.g., SELL 100 tokens at $45).
4.  Select **[3] Match Orders**. The local proof server generates a ZK proof verifying the price overlap ($50 >= $45) without revealing the prices to the network.`;

const newPhase2 = `#### Option B: Trading via the CLI
If you prefer the terminal, you can test the full flow locally:
1.  In the CLI, select **[2] Join an existing Veilbook contract** and paste your Contract Address.
2.  Select **[1] Submit Order** to create your first order (e.g., Direction: BUY, Price: 50, Size: 100). The CLI will generate a ZK proof and store the commitment locally.
3.  Select **[1] Submit Order** again to create a counterparty order (e.g., Direction: SELL, Price: 45, Size: 100).
4.  Select **[2] Match Orders** and provide the Local IDs of your two orders (e.g., 0 and 1). The local proof server generates a ZK proof verifying the price overlap ($50 >= $45) without revealing the actual prices to the network.
5.  Select **[4] Display Status** to view the updated contract balance and order statuses.`;

content = content.replace(oldPhase2, newPhase2);

// Update Standalone Development
const oldStandalone = `## ⚡ Standalone (Offline) Development

If you don't want to wait for Preprod network block times, you can run a fully local, instant Midnight node.

1. **Start Local Network:**
   \`\`\`bash
   cd veilbook-cli
   docker compose -f standalone.yml up -d
   \`\`\`
2. **Run Standalone CLI:**
   \`\`\`bash
   npm run standalone
   \`\`\`
*Note: In standalone mode, your wallet is automatically funded, and DUST generation is instantaneous.*`;

const newStandalone = `## ⚡ Standalone (Offline) Development

If you don't want to wait for Preprod network block times or deal with faucets, you can run a fully local, instant Midnight node with a pre-funded genesis wallet.

**Run the Standalone CLI (all-in-one command):**
\`\`\`bash
cd veilbook-cli
npm run standalone
\`\`\`
*Note: This command automatically spins up the \`standalone.yml\` Docker cluster (Node, Indexer, Proof Server), connects the CLI using the pre-funded genesis seed, and provides instantaneous DUST generation for rapid testing end-to-end.*`;

content = content.replace(oldStandalone, newStandalone);

fs.writeFileSync(readmePath, content);
console.log("README.md updated successfully.");
