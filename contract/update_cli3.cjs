const fs = require('fs');
const path = require('path');

const cliPath = path.resolve('../veilbook-cli/src/cli.ts');
let content = fs.readFileSync(cliPath, 'utf-8');

// Update menu
content = content.replace('[5] Distribute Tokens\n', '');
content = content.replace('[6] Monitor DUST\n  [7] Exit', '[5] Monitor DUST\n  [6] Exit');

// Update deployOrJoin
const oldDeployOrJoin = `const deployOrJoin = async (
  providers: VeilbookProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedVeilbookContract | null> => {
  let contractAddress: string | undefined;

  // Automatically deploy or join in standalone mode
  if (config instanceof StandaloneConfig) {
    if (GENESIS_CONTRACT_ADDRESS) {
      return await api.joinContract(providers, GENESIS_CONTRACT_ADDRESS);
    }
    const contract = await api.withStatus('Deploying Veilbook contract', () => api.deploy(providers, {}));
    console.log(\`  Contract deployed at: \${contract.deployTxData.public.contractAddress}\\n\`);
    return contract;
  }`;

const newDeployOrJoin = `const deployOrJoin = async (
  providers: VeilbookProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedVeilbookContract | null> => {
  let contractAddress: string | undefined;
  
  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');

  // Automatically deploy or join in standalone mode
  if (config instanceof StandaloneConfig) {
    if (GENESIS_CONTRACT_ADDRESS) {
      return await api.joinContract(providers, GENESIS_CONTRACT_ADDRESS);
    }
    const contract = await api.withStatus('Deploying Veilbook contract', () => api.deploy(providers, {}, myAddressBytes));
    console.log(\`  Contract deployed at: \${contract.deployTxData.public.contractAddress}\\n\`);
    return contract;
  }`;

content = content.replace(oldDeployOrJoin, newDeployOrJoin);

const oldDeployInteractive = `      case '1':
        try {
          const contract = await api.withStatus('Deploying Veilbook contract', () =>
            api.deploy(providers, {}),
          );`;

const newDeployInteractive = `      case '1':
        try {
          const contract = await api.withStatus('Deploying Veilbook contract', () =>
            api.deploy(providers, {}, myAddressBytes),
          );`;

content = content.replace(oldDeployInteractive, newDeployInteractive);


// Remove case 5 and re-number 6,7 to 5,6
const case5Regex = /      case '5': \/\/ Distribute Tokens[\s\S]*?break;\n/m;
content = content.replace(case5Regex, '');
content = content.replace(/case '6': \/\/ Monitor DUST/g, "case '5': // Monitor DUST");
content = content.replace(/case '7': \/\/ Exit/g, "case '6': // Exit");

fs.writeFileSync(cliPath, content);
console.log("cli.ts updated.");
