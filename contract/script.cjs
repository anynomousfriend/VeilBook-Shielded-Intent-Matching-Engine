const fs = require('fs');
const path = require('path');

const apiPath = path.resolve('../veilbook-cli/src/api.ts');
let content = fs.readFileSync(apiPath, 'utf-8');

const oldBlock = `    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      // Work around wallet SDK bug: signRecipe uses hardcoded 'pre-proof'
      // marker when cloning intents, but proven (UnboundTransaction) intents
      // have 'proof' data, causing "Failed to clone intent". We sign manually
      // with the correct proof markers.
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return ctx.wallet.finalizeRecipe(recipe);
    },`;

const newBlock = `    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      return ctx.wallet.finalizeRecipe(recipe);
    },`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  console.log("Successfully replaced balanceTx.");
} else {
  console.log("Could not find the old balanceTx block in api.ts.");
}

const signTransactionIntentsRegex = /\/\*\*[\s\S]*?const signTransactionIntents = \([\s\S]*?tx\.intents\.set\(segment, cloned\);\n  }\n};\n/m;
if (signTransactionIntentsRegex.test(content)) {
  content = content.replace(signTransactionIntentsRegex, '');
  console.log("Successfully removed signTransactionIntents function.");
} else {
  console.log("Could not find signTransactionIntents function.");
}

fs.writeFileSync(apiPath, content);
console.log("api.ts updated.");
