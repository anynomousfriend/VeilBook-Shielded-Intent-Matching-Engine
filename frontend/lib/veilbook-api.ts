import { Veilbook, type VeilbookPrivateState, witnesses } from '@midnight-ntwrk/veilbook-contract';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { VeilbookProviders, DeployedVeilbookContract } from '../../veilbook-cli/src/common-types';
import { VeilbookPrivateStateId } from '../../veilbook-cli/src/common-types';

const veilbookCompiledContract = CompiledContract.make('veilbook', Veilbook.Contract).pipe(
  CompiledContract.withWitnesses(witnesses)
);

// Either<ContractAddress, UserAddress> helper — `right` wraps a UserAddress
const toUserAddress = (bytes: Uint8Array) => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes },
});

export const deployVeilbook = async (
  providers: VeilbookProviders,
  ownerAddrHex: string,
  initialSupply: bigint = 1_000_000n
): Promise<DeployedVeilbookContract> => {
  const ownerBytes = new Uint8Array(Buffer.from(ownerAddrHex, 'hex'));
  return deployContract(providers as any, {
    compiledContract: veilbookCompiledContract as any,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: {},
    args: [initialSupply, { bytes: ownerBytes }],
  }) as unknown as Promise<DeployedVeilbookContract>;
};

export const joinVeilbook = async (
  providers: VeilbookProviders,
  contractAddress: string,
): Promise<DeployedVeilbookContract> => {
  return findDeployedContract(providers as any, {
    contractAddress,
    compiledContract: veilbookCompiledContract as any,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: {},
  }) as unknown as Promise<DeployedVeilbookContract>;
};

export interface SubmitOrderResult {
  txData: { txId: string; blockHeight: number };
  commitment: Uint8Array;
  nonce: Uint8Array;
  order: Veilbook.Order;
}

export const submitOrder = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  direction: 'BUY' | 'SELL',
  price: number,
  size: number
): Promise<SubmitOrderResult> => {
  const dirBigInt = direction === 'BUY' ? 0n : 1n;
  const priceBigInt = BigInt(Math.floor(price * 100));
  const sizeBigInt = BigInt(Math.floor(size * 100));

  const orderNonce = crypto.getRandomValues(new Uint8Array(32));
  const order: Veilbook.Order = { direction: dirBigInt, price: priceBigInt, size: sizeBigInt };

  const address = contract.deployTxData.public.contractAddress;
  providers.privateStateProvider.setContractAddress(address);
  const currentState = (await providers.privateStateProvider.get(VeilbookPrivateStateId)) ?? {};

  await providers.privateStateProvider.set(VeilbookPrivateStateId, {
    ...currentState,
    submitOrder: { order, nonce: orderNonce },
  });

  const tx = await contract.callTx.submit_order(sizeBigInt);

  return {
    txData: tx.public,
    commitment: tx.private.result as Uint8Array,
    nonce: orderNonce,
    order,
  };
};

export const matchOrders = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  orderA: Veilbook.Order,
  nonceA: Uint8Array,
  commitA: Uint8Array,
  orderB: Veilbook.Order,
  nonceB: Uint8Array,
  commitB: Uint8Array,
  buyerAddr: Uint8Array,
  sellerAddr: Uint8Array
) => {
  const address = contract.deployTxData.public.contractAddress;
  providers.privateStateProvider.setContractAddress(address);
  const currentState = (await providers.privateStateProvider.get(VeilbookPrivateStateId)) ?? {};

  await providers.privateStateProvider.set(VeilbookPrivateStateId, {
    ...currentState,
    matchOrderA: { order: orderA, nonce: nonceA },
    matchOrderB: { order: orderB, nonce: nonceB },
    matchBuyerAddress: toUserAddress(buyerAddr),
    matchSellerAddress: toUserAddress(sellerAddr),
  });

  const tx = await contract.callTx.match_orders(commitA, commitB);
  return tx.public;
};

export const cancelOrder = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  order: Veilbook.Order,
  nonce: Uint8Array,
  commitment: Uint8Array,
  refundAddr: Uint8Array
) => {
  const address = contract.deployTxData.public.contractAddress;
  providers.privateStateProvider.setContractAddress(address);
  const currentState = (await providers.privateStateProvider.get(VeilbookPrivateStateId)) ?? {};

  await providers.privateStateProvider.set(VeilbookPrivateStateId, {
    ...currentState,
    cancelOrder: { order, nonce },
    cancelUserAddress: toUserAddress(refundAddr),
  });

  const tx = await contract.callTx.cancel_order(commitment);
  return tx.public;
};

export const transferTokens = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  amount: bigint,
  recipientAddr: Uint8Array
) => {
  const tx = await contract.callTx.transfer_tokens(amount, { bytes: recipientAddr });
  return tx.public;
};
