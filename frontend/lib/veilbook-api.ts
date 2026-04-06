import { Veilbook, type VeilbookPrivateState, witnesses } from '@midnight-ntwrk/veilbook-contract';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { VeilbookProviders, DeployedVeilbookContract } from '../../veilbook-cli/src/common-types';
import { VeilbookPrivateStateId } from '../../veilbook-cli/src/common-types';

const veilbookCompiledContract = CompiledContract.make('veilbook', Veilbook.Contract).pipe(
  CompiledContract.withWitnesses(witnesses)
);

export const deployVeilbook = async (
  providers: VeilbookProviders
): Promise<DeployedVeilbookContract> => {
  return deployContract(providers as any, {
    compiledContract: veilbookCompiledContract as any,
    privateStateId: VeilbookPrivateStateId,
    initialPrivateState: {},
    args: [],
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

export const submitOrder = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract,
  trader: 'A' | 'B',
  direction: 'BUY' | 'SELL',
  price: number,
  size: number
) => {
  const dirBigInt = direction === 'BUY' ? BigInt(1) : BigInt(2);
  const priceBigInt = BigInt(Math.floor(price * 100)); // Fixed precision
  const sizeBigInt = BigInt(Math.floor(size * 100));

  // The actual zero-knowledge proof generation happens here in the SDK via the proof server
  if (trader === 'A') {
    const tx = await contract.callTx.submit_order_a(dirBigInt, priceBigInt, sizeBigInt);
    return tx.public;
  } else {
    const tx = await contract.callTx.submit_order_b(dirBigInt, priceBigInt, sizeBigInt);
    return tx.public;
  }
};

export const matchOrders = async (
  providers: VeilbookProviders,
  contract: DeployedVeilbookContract
) => {
  const tx = await contract.callTx.match_orders();
  return tx.public;
};
