import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  type Order
} from "../managed/veilbook/contract/index.js";
import { type VeilbookPrivateState, witnesses } from "../witnesses.js";

// Either<ContractAddress, UserAddress> helper — `right` wraps a UserAddress
type EitherAddress = {
  is_left: boolean;
  left: { bytes: Uint8Array };
  right: { bytes: Uint8Array };
};

const userAddress = (bytes: Uint8Array): EitherAddress => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes }
});

export class VeilbookSimulator {
  readonly contract: Contract<VeilbookPrivateState>;
  circuitContext: CircuitContext<VeilbookPrivateState>;

  constructor(initialSupply: bigint = 1_000_000n) {
    this.contract = new Contract<VeilbookPrivateState>(witnesses);
    const ownerAddr = new Uint8Array(32).fill(42);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext({}, "0".repeat(64)),
      initialSupply,
      { bytes: ownerAddr }
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): VeilbookPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public submitOrder(
    direction: bigint,
    price: bigint,
    size: bigint,
    nonce: Uint8Array
  ): { ledger: Ledger; commitment: Uint8Array } {
    const order: Order = { direction, price, size };
    this.circuitContext.currentPrivateState.submitOrder = { order, nonce };
    const result = this.contract.impureCircuits.submit_order(
      this.circuitContext,
      size
    );
    this.circuitContext = result.context;
    return {
      ledger: ledger(this.circuitContext.currentQueryContext.state),
      commitment: result.result
    };
  }

  public matchOrders(
    orderA: Order,
    aNonce: Uint8Array,
    commitA: Uint8Array,
    orderB: Order,
    bNonce: Uint8Array,
    commitB: Uint8Array,
    buyerAddr: Uint8Array,
    sellerAddr: Uint8Array
  ): Ledger {
    this.circuitContext.currentPrivateState.matchOrderA = {
      order: orderA,
      nonce: aNonce
    };
    this.circuitContext.currentPrivateState.matchOrderB = {
      order: orderB,
      nonce: bNonce
    };
    this.circuitContext.currentPrivateState.matchBuyerAddress =
      userAddress(buyerAddr);
    this.circuitContext.currentPrivateState.matchSellerAddress =
      userAddress(sellerAddr);

    this.circuitContext = this.contract.impureCircuits.match_orders(
      this.circuitContext,
      commitA,
      commitB
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public cancelOrder(
    order: Order,
    nonce: Uint8Array,
    commitment: Uint8Array,
    userAddr: Uint8Array
  ): Ledger {
    this.circuitContext.currentPrivateState.cancelOrder = { order, nonce };
    this.circuitContext.currentPrivateState.cancelUserAddress =
      userAddress(userAddr);

    this.circuitContext = this.contract.impureCircuits.cancel_order(
      this.circuitContext,
      commitment
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getBalance(): bigint {
    const result = this.contract.impureCircuits.get_balance(
      this.circuitContext
    );
    this.circuitContext = result.context;
    return result.result as bigint;
  }
}
