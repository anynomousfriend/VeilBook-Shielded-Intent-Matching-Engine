import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
console.log(Buffer.from(unshieldedToken().raw).toString('hex'));
