# Midnight Preprod Migration - Example Counter App

## Status: Complete

The veilbook app has been successfully migrated to the Preprod network. Contracts can be deployed and interacted with on Preprod.

## What Was Done

### Dependencies
- midnight-js packages upgraded from `2.0.x` to `3.0.0`
- Old monolithic wallet (`@midnight-ntwrk/wallet` + `wallet-api` + `zswap`) replaced with modular wallet SDK (`wallet-sdk-facade`, `wallet-sdk-shielded`, `wallet-sdk-unshielded-wallet`, `wallet-sdk-dust-wallet`, `wallet-sdk-hd`, `wallet-sdk-address-format`)
- Compact compiler updated to `0.28.0`

### Contract
- Compact pragma updated to `>= 0.20` for compiler `0.28.0`
- `CompiledContract` pattern adopted from `@midnight-ntwrk/compact-js`
- Tests updated to use `Simulator.make()` pattern

### Wallet
- Full HD wallet key derivation (Zswap, NightExternal, Dust roles)
- Three sub-wallet architecture (ShieldedWallet, UnshieldedWallet, DustWallet) via WalletFacade
- Automatic NIGHT UTXO registration for dust generation on Preprod
- Token type migrated from `nativeToken()` to `unshieldedToken().raw`

### Network Config
- PreprodConfig class targeting remote Preprod indexer and RPC node
- Local proof server via `proof-server.yml`
- GraphQL v3 API paths

### Bug Workaround: wallet-sdk-unshielded-wallet signRecipe
- **Bug**: `TransactionOps.addSignature()` in `@midnight-ntwrk/wallet-sdk-unshielded-wallet@1.0.0` hardcodes `'pre-proof'` type marker when cloning intents via `Intent.deserialize()`. After `proveTx()`, intents contain `Proof` data, not `PreProof`. The WASM deserializer fails with "Failed to clone intent".
- **Impact**: All contract deployments and calls fail. DUST coins become locked as "pending" due to a separate known issue (pending coins not released on failure).
- **Workaround**: Custom `signTransactionIntents()` in `veilbook-cli/src/api.ts` bypasses `signRecipe()` and signs intents manually with the correct proof marker (`'proof'` for base transaction, `'pre-proof'` for balancing transaction).
- **Upstream fix needed**: `TransactionOps.addSignature()` should read the proof marker from the intent (e.g. `originalIntent.proof.instance`) instead of hardcoding `'pre-proof'`.

## Key Files Changed

| File | Purpose |
|------|---------|
| `package.json` | Updated all midnight-js and wallet SDK dependencies |
| `contract/src/veilbook.compact` | Updated pragma to `>= 0.20` |
| `veilbook-cli/src/api.ts` | Wallet SDK integration, signRecipe workaround, dust registration |
| `veilbook-cli/src/cli.ts` | Interactive CLI menus, deploy/join/increment flow, error logging |
| `veilbook-cli/src/config.ts` | PreprodConfig with endpoints |
| `veilbook-cli/src/common-types.ts` | Updated type definitions for midnight-js 3.0.0 |
| `veilbook-cli/src/preprod.ts` | Preprod entry point |
| `veilbook-cli/proof-server.yml` | Docker compose for local proof server |

## Reference Materials

- Previous Preview migration PR: https://github.com/midnightntwrk/veilbook/pull/1312
- Local copies of upstream libraries for reference: `midnight-js/`, `midnight-wallet/`
- Migration details: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
