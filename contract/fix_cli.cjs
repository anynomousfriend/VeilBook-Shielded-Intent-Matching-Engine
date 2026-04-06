const fs = require('fs');
const path = require('path');
const cliPath = path.resolve('../veilbook-cli/src/cli.ts');
let cliContent = fs.readFileSync(cliPath, 'utf-8');

const target = `const deployOrJoin = async (
  providers: VeilbookProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedVeilbookContract | null> => {
`;

const insert = `  const myAddressHex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  const myAddressBytes = Buffer.from(myAddressHex, 'hex');\n`;

cliContent = cliContent.replace(target, target + insert);
fs.writeFileSync(cliPath, cliContent);
