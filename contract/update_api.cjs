const fs = require('fs');
const path = require('path');

const apiPath = path.resolve('../veilbook-cli/src/api.ts');
let content = fs.readFileSync(apiPath, 'utf-8');

// Update deploy signature
const oldDeploy = `export const deploy = async (
  providers: VeilbookProviders,
  privateState: VeilbookPrivateState,
  initialSupply: bigint = 1_000_000n,
): Promise<DeployedVeilbookContract> => {
  logger.info('Deploying veilbook contract...');
  const veilbookContract = await deployContract(providers, {
    compiledContract: veilbookCompiledContract,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: privateState,
    args: [initialSupply],
  });`;

const newDeploy = `export const deploy = async (
  providers: VeilbookProviders,
  privateState: VeilbookPrivateState,
  ownerAddr: Uint8Array,
  initialSupply: bigint = 1_000_000n,
): Promise<DeployedVeilbookContract> => {
  logger.info('Deploying veilbook contract...');
  const veilbookContract = await deployContract(providers, {
    compiledContract: veilbookCompiledContract,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: privateState,
    args: [initialSupply, ownerAddr],
  });`;

content = content.replace(oldDeploy, newDeploy);

// Remove distributeTokens
const distributeTokensRegex = /export const distributeTokens = async \([\s\S]*?return finalizedTxData\.public;\n};\n/m;
content = content.replace(distributeTokensRegex, '');

fs.writeFileSync(apiPath, content);
console.log("api.ts updated.");
