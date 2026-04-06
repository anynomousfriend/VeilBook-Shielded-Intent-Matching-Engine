import { Veilbook, type VeilbookPrivateState } from '@midnight-ntwrk/veilbook-contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';

export type VeilbookCircuits = ProvableCircuitId<Veilbook.Contract<VeilbookPrivateState>>;

export const VeilbookPrivateStateId = 'veilbookPrivateState';

export type VeilbookProviders = MidnightProviders<
  VeilbookCircuits,
  typeof VeilbookPrivateStateId,
  VeilbookPrivateState
>;

export type VeilbookContract = Veilbook.Contract<VeilbookPrivateState>;

export type DeployedVeilbookContract = DeployedContract<VeilbookContract> | FoundContract<VeilbookContract>;
