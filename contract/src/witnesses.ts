import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type {
  Ledger,
  Order,
  Witnesses
} from "./managed/veilbook/contract/index.js";

// Either<ContractAddress, UserAddress> shape from generated types
type EitherAddress = {
  is_left: boolean;
  left: { bytes: Uint8Array };
  right: { bytes: Uint8Array };
};

export type VeilbookPrivateState = {
  // Submit order
  submitOrder?: { order: Order; nonce: Uint8Array };
  // Match orders
  matchOrderA?: { order: Order; nonce: Uint8Array };
  matchOrderB?: { order: Order; nonce: Uint8Array };
  matchBuyerAddress?: EitherAddress;
  matchSellerAddress?: EitherAddress;
  // Cancel order
  cancelOrder?: { order: Order; nonce: Uint8Array };
  cancelUserAddress?: EitherAddress;
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
  getMatchBuyerAddress: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.matchBuyerAddress)
      throw new Error("matchBuyerAddress not set");
    return [privateState, privateState.matchBuyerAddress];
  },
  getMatchSellerAddress: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.matchSellerAddress)
      throw new Error("matchSellerAddress not set");
    return [privateState, privateState.matchSellerAddress];
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
  },
  getCancelUserAddress: ({
    privateState
  }: WitnessContext<Ledger, VeilbookPrivateState>) => {
    if (!privateState.cancelUserAddress)
      throw new Error("cancelUserAddress not set");
    return [privateState, privateState.cancelUserAddress];
  }
};
