export const witnesses = {
    // --- Order submission ---
    getOrderNonce: ({ privateState }) => {
        if (!privateState.submitOrder)
            throw new Error("submitOrder not set");
        return [privateState, privateState.submitOrder.nonce];
    },
    getOrder: ({ privateState }) => {
        if (!privateState.submitOrder)
            throw new Error("submitOrder not set");
        return [privateState, privateState.submitOrder.order];
    },
    // --- Match orders ---
    getMatchOrderANonce: ({ privateState }) => {
        if (!privateState.matchOrderA)
            throw new Error("matchOrderA not set");
        return [privateState, privateState.matchOrderA.nonce];
    },
    getMatchOrderA: ({ privateState }) => {
        if (!privateState.matchOrderA)
            throw new Error("matchOrderA not set");
        return [privateState, privateState.matchOrderA.order];
    },
    getMatchOrderBNonce: ({ privateState }) => {
        if (!privateState.matchOrderB)
            throw new Error("matchOrderB not set");
        return [privateState, privateState.matchOrderB.nonce];
    },
    getMatchOrderB: ({ privateState }) => {
        if (!privateState.matchOrderB)
            throw new Error("matchOrderB not set");
        return [privateState, privateState.matchOrderB.order];
    },
    // --- Cancel order ---
    getCancelOrderNonce: ({ privateState }) => {
        if (!privateState.cancelOrder)
            throw new Error("cancelOrder not set");
        return [privateState, privateState.cancelOrder.nonce];
    },
    getCancelOrder: ({ privateState }) => {
        if (!privateState.cancelOrder)
            throw new Error("cancelOrder not set");
        return [privateState, privateState.cancelOrder.order];
    }
};
//# sourceMappingURL=witnesses.js.map