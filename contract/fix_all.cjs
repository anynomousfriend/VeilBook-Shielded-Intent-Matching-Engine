const fs = require('fs');
const path = require('path');

// 1. Fix api.ts
const apiPath = path.resolve('../veilbook-cli/src/api.ts');
let apiContent = fs.readFileSync(apiPath, 'utf-8');

apiContent = apiContent.replace(
  `    args: [initialSupply, ownerAddr],`,
  `    args: [initialSupply, { bytes: ownerAddr }],`
);
fs.writeFileSync(apiPath, apiContent);
console.log("api.ts fixed.");

// 2. Fix cli.ts
const cliPath = path.resolve('../veilbook-cli/src/cli.ts');
let cliContent = fs.readFileSync(cliPath, 'utf-8');

// Ensure myAddressBytes is available where deploy is called in cli.ts
// We'll just define it at the top of deployOrJoin if not there.
cliContent = cliContent.replace(
  `const deployOrJoin = async (
  providers: VeilbookProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedVeilbookContract | null> => {
  let contractAddress: string | undefined;

  // Automatically deploy or join in standalone mode`,
  `const deployOrJoin = async (
  providers: VeilbookProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedVeilbookContract | null> => {
  let contractAddress: string | undefined;
  
  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');

  // Automatically deploy or join in standalone mode`
);

// Ensure we pass myAddressBytes in case 1
cliContent = cliContent.replace(
  `        try {
          const contract = await api.withStatus('Deploying Veilbook contract', () =>
            api.deploy(providers, {}),
          );`,
  `        try {
          const contract = await api.withStatus('Deploying Veilbook contract', () =>
            api.deploy(providers, {}, myAddressBytes),
          );`
);

// Remove case 5 distribute tokens if it exists
cliContent = cliContent.replace(/      case '5':[\s\S]*?break;/g, "");
cliContent = cliContent.replace(/case '6': \/\/ Monitor DUST/g, "case '5': // Monitor DUST");
cliContent = cliContent.replace(/case '7': \/\/ Exit/g, "case '6': // Exit");

// Remove distribute tokens from menu
cliContent = cliContent.replace('  [5] Distribute Tokens\n', '');
cliContent = cliContent.replace('  [6] Monitor DUST\n  [7] Exit', '  [5] Monitor DUST\n  [6] Exit');

fs.writeFileSync(cliPath, cliContent);
console.log("cli.ts fixed.");

// 3. Fix deploy-preprod.ts
const deployPreprodPath = path.resolve('../veilbook-cli/src/deploy-preprod.ts');
let dpContent = fs.readFileSync(deployPreprodPath, 'utf-8');
dpContent = dpContent.replace(
  `  const deployedContract = await deploy(providers, {});`,
  `  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');
  const deployedContract = await deploy(providers, {}, myAddressBytes);`
);
fs.writeFileSync(deployPreprodPath, dpContent);
console.log("deploy-preprod.ts fixed.");

// 4. Fix run-e2e.ts
const e2ePath = path.resolve('../veilbook-cli/src/run-e2e.ts');
let e2eContent = fs.readFileSync(e2ePath, 'utf-8');
e2eContent = e2eContent.replace(
  `const contract = await api.deploy(providers, {});`,
  `const contract = await api.deploy(providers, {}, myAddressBytes);`
);
e2eContent = e2eContent.replace(/console\.log\("Distributing tokens\.\.\."\);\n    await api\.distributeTokens\(providers, contract, 1000n, myAddressBytes\);\n/g, '');
fs.writeFileSync(e2ePath, e2eContent);
console.log("run-e2e.ts fixed.");

// 5. Fix e2e.ts
const e2e2Path = path.resolve('../veilbook-cli/src/e2e.ts');
let e2e2Content = fs.readFileSync(e2e2Path, 'utf-8');
e2e2Content = e2e2Content.replace(
  `const contract = await api.deploy(providers, {});`,
  `const contract = await api.deploy(providers, {}, myAddressBytes);`
);
e2e2Content = e2e2Content.replace(/console\.log\("Distributing tokens\.\.\."\);\n    await api\.distributeTokens\(providers, contract, 1000n, myAddressBytes\);\n/g, '');
fs.writeFileSync(e2e2Path, e2e2Content);
console.log("e2e.ts fixed.");
