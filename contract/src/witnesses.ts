import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type {
  Ledger,
  Order,
  Witnesses
} from "./managed/veilbook/contract/index.js";

export type VeilbookPrivateState = {
  // Submit order
  submitOrder?: { order: Order; nonce: Uint8Array };
  // Match orders
  matchOrderA?: { order: Order; nonce: Uint8Array };
  matchOrderB?: { order: Order; nonce: Uint8Array };
  // Cancel order
  cancelOrder?: { order: Order; nonce: Uint8Array };
};

export const witnesses: Witnesses<VeilbookPrivateState> = {
  // --- Order submission ---
  getOrderNonce: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.submitOrder) throw new Error("submitOrder not set");
    return [privateState, privateState.submitOrder.nonce];
  },
  getOrder: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.submitOrder) throw new Error("submitOrder not set");
    return [privateState, privateState.submitOrder.order];
  },

  // --- Match orders ---
  getMatchOrderANonce: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.matchOrderA) throw new Error("matchOrderA not set");
    return [privateState, privateState.matchOrderA.nonce];
  },
  getMatchOrderA: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.matchOrderA) throw new Error("matchOrderA not set");
    return [privateState, privateState.matchOrderA.order];
  },
  getMatchOrderBNonce: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.matchOrderB) throw new Error("matchOrderB not set");
    return [privateState, privateState.matchOrderB.nonce];
  },
  getMatchOrderB: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.matchOrderB) throw new Error("matchOrderB not set");
    return [privateState, privateState.matchOrderB.order];
  },

  // --- Cancel order ---
  getCancelOrderNonce: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.cancelOrder) throw new Error("cancelOrder not set");
    return [privateState, privateState.cancelOrder.nonce];
  },
  getCancelOrder: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.cancelOrder) throw new Error("cancelOrder not set");
    return [privateState, privateState.cancelOrder.order];
  }
};
