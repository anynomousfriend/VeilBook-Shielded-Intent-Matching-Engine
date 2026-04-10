import type { Order, Witnesses } from "./managed/veilbook/contract/index.js";
export type VeilbookPrivateState = {
    submitOrder?: {
        order: Order;
        nonce: Uint8Array;
    };
    matchOrderA?: {
        order: Order;
        nonce: Uint8Array;
    };
    matchOrderB?: {
        order: Order;
        nonce: Uint8Array;
    };
    cancelOrder?: {
        order: Order;
        nonce: Uint8Array;
    };
};
export declare const witnesses: Witnesses<VeilbookPrivateState>;
