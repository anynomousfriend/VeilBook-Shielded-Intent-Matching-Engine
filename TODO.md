# Veilbook Project TODOs

## Architectural Fixes (Judge's Verdict)
- [ ] **Fix 1:** Remove public parameters from `submit_order` circuits (read from witness)
- [ ] **Fix 2:** Implement a scalable Order Book (using Map) instead of static A/B slots
- [ ] **Fix 3:** Update `match_orders` circuit/flow to support two-step matching or relayer logic
- [ ] **Fix 4:** Integrate token locks/transfers for atomic settlement

## Frontend Setup
- [x] Install dependencies for `veilbook/frontend`
- [x] Configure environment variables for `veilbook/frontend`
- [x] Verify frontend builds successfully
- [x] Verify frontend starts in dev mode

## Integration
- [x] Check compatibility between `frontend` and `contract`
- [x] Check compatibility between `frontend` and `veilbook-cli`

## Implementation
- [x] Complete landing page components
- [x] Implement flows for /demo

## Dashboard Implementation
- [x] Create dashboard UI components and micro-interactions
- [x] Implement Wallet Connection (Lace/Nightly) in the frontend
- [x] Remove UI mocks and wire up real Midnight SDK Providers
- [x] Implement submitting real buy and sell orders (ZK proof generation)
- [x] Show actual intent matching in the dashboard via contract calls
- [x] Display actual cryptographic proofs and network transactions in the UI