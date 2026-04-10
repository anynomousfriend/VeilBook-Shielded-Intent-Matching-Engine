import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum State { UNSET = 0, OPEN = 1, MATCHED = 2, CANCELLED = 3 }

export type Order = { direction: bigint; price: bigint; size: bigint };

export type Witnesses<PS> = {
  getOrderNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getOrder(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Order];
  getMatchOrderANonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getMatchOrderA(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Order];
  getMatchOrderBNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getMatchOrderB(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Order];
  getCancelOrderNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getCancelOrder(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Order];
}

export type ImpureCircuits<PS> = {
  submit_order(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  match_orders(context: __compactRuntime.CircuitContext<PS>,
               commit_a_0: Uint8Array,
               commit_b_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  cancel_order(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  get_balance(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  transfer_tokens(context: __compactRuntime.CircuitContext<PS>,
                  amount_0: bigint,
                  recipient_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  submit_order(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  match_orders(context: __compactRuntime.CircuitContext<PS>,
               commit_a_0: Uint8Array,
               commit_b_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  cancel_order(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  get_balance(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  transfer_tokens(context: __compactRuntime.CircuitContext<PS>,
                  amount_0: bigint,
                  recipient_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  submit_order(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  match_orders(context: __compactRuntime.CircuitContext<PS>,
               commit_a_0: Uint8Array,
               commit_b_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  cancel_order(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  get_balance(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  transfer_tokens(context: __compactRuntime.CircuitContext<PS>,
                  amount_0: bigint,
                  recipient_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly match_count: bigint;
  orders_state: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): State;
    [Symbol.iterator](): Iterator<[Uint8Array, State]>
  };
  readonly token_color: Uint8Array;
  readonly owner: { bytes: Uint8Array };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initial_supply_0: bigint,
               initial_owner_0: { bytes: Uint8Array }): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
