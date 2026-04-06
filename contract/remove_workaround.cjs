const fs = require('fs');
const path = require('path');

const apiPath = path.resolve('../veilbook-cli/src/api.ts');
let content = fs.readFileSync(apiPath, 'utf-8');

const signTransactionIntentsRegex = /const signTransactionIntents = \([\s\S]*?tx\.intents\.set\(segment, cloned\);\n  }\n};\n/m;
if (signTransactionIntentsRegex.test(content)) {
  content = content.replace(signTransactionIntentsRegex, '');
  console.log("Removed signTransactionIntents function.");
}

const oldBlock = `      // Work around wallet SDK bug: signRecipe uses hardcoded 'pre-proof'
      // marker when cloning intents, but proven (UnboundTransaction) intents
      // have 'proof' data, causing "Failed to clone intent". We sign manually
      // with the correct proof markers.
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }`;

const newBlock = `      // Standard SDK balancing`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  console.log("Removed workaround from balanceTx.");
} else {
  console.log("Could not find oldBlock in balanceTx.");
}

fs.writeFileSync(apiPath, content);
