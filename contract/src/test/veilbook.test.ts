import { VeilbookSimulator } from "./veilbook-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { State } from "../managed/veilbook/contract/index.js";

setNetworkId("undeployed");

describe("Veilbook smart contract", () => {
  const nonceA = new Uint8Array(32).fill(1);
  const nonceB = new Uint8Array(32).fill(2);
  const userAddr = new Uint8Array(32).fill(3);

  it("generates initial ledger state deterministically", () => {
    const simulator0 = new VeilbookSimulator();
    const simulator1 = new VeilbookSimulator();
    const l0 = simulator0.getLedger();
    const l1 = simulator1.getLedger();
    
    expect(l0.match_count).toEqual(l1.match_count);
    expect(l0.token_color).toEqual(l1.token_color);
    expect(l0.orders_state.size()).toEqual(l1.orders_state.size());
    expect(l0.token_locks.size()).toEqual(l1.token_locks.size());
  });

  it("properly initializes ledger state", () => {
    const simulator = new VeilbookSimulator();
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.match_count).toEqual(0n);
    expect(initialLedgerState.orders_state.size()).toEqual(0n);
  });

  it("submits Order A correctly", () => {
    const simulator = new VeilbookSimulator();
    // BUY 500 @ 42
    const { ledger, commitment } = simulator.submitOrder(0n, 42n, 500n, nonceA); 
    expect(ledger.orders_state.lookup(commitment)).toEqual(State.OPEN);
    expect(ledger.token_locks.lookup(commitment)).toEqual(500n);
  });

  it("submits Order B correctly", () => {
    const simulator = new VeilbookSimulator();
    // SELL 500 @ 40
    const { ledger, commitment } = simulator.submitOrder(1n, 40n, 500n, nonceB); 
    expect(ledger.orders_state.lookup(commitment)).toEqual(State.OPEN);
    expect(ledger.token_locks.lookup(commitment)).toEqual(500n);
  });

  it("matches orders correctly", () => {
    const simulator = new VeilbookSimulator();
    const orderA = { direction: 0n, price: 42n, size: 500n };
    const orderB = { direction: 1n, price: 40n, size: 500n };

    const { commitment: commitA } = simulator.submitOrder(orderA.direction, orderA.price, orderA.size, nonceA);
    const { commitment: commitB } = simulator.submitOrder(orderB.direction, orderB.price, orderB.size, nonceB);

    const finalLedger = simulator.matchOrders(orderA, nonceA, commitA, orderB, nonceB, commitB, userAddr, userAddr);

    expect(finalLedger.match_count).toEqual(1n);
    expect(finalLedger.orders_state.lookup(commitA)).toEqual(State.MATCHED);
    expect(finalLedger.orders_state.lookup(commitB)).toEqual(State.MATCHED);
  });

  it("fails matching non-overlapping prices", () => {
    const simulator = new VeilbookSimulator();
    const orderA = { direction: 0n, price: 39n, size: 500n }; // BUY @ 39
    const orderB = { direction: 1n, price: 40n, size: 500n }; // SELL @ 40

    const { commitment: commitA } = simulator.submitOrder(orderA.direction, orderA.price, orderA.size, nonceA);
    const { commitment: commitB } = simulator.submitOrder(orderB.direction, orderB.price, orderB.size, nonceB);

    expect(() => {
      simulator.matchOrders(orderA, nonceA, commitA, orderB, nonceB, commitB, userAddr, userAddr);
    }).toThrow();
  });

  it("cancels an order correctly", () => {
    const simulator = new VeilbookSimulator();
    const order = { direction: 0n, price: 42n, size: 500n };
    const { commitment } = simulator.submitOrder(order.direction, order.price, order.size, nonceA);
    
    expect(simulator.getLedger().orders_state.lookup(commitment)).toEqual(State.OPEN);
    
    const finalLedger = simulator.cancelOrder(order, nonceA, commitment, userAddr);
    expect(finalLedger.orders_state.lookup(commitment)).toEqual(State.CANCELLED);
    expect(finalLedger.token_locks.member(commitment)).toBe(false);
  });
});
