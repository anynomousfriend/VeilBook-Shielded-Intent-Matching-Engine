"use client";

import React, { Suspense, useReducer, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Wifi, WifiOff, Users } from "lucide-react";
import TraderPanel from "@/components/dashboard/TraderPanel";
import PublicFeed, { type FeedEvent } from "@/components/dashboard/PublicFeed";
import MatchOverlay from "@/components/dashboard/MatchOverlay";
import WalletConnect from "@/components/wallet-connect";
import type { TraderState, OrderData, CounterpartyStatus } from "@/lib/dashboard-types";
import type { RelayOrderData, RelayMessage } from "@/lib/relay-client";
import { useWallet } from "@/contexts/WalletContext";
import { useRelay } from "@/hooks/use-relay";
import { createBrowserProviders } from "@/lib/providers";
import { joinVeilbook, submitOrder, matchOrders, type SubmitOrderResult } from "@/lib/veilbook-api";
import type { Veilbook } from "@midnight-ntwrk/veilbook-contract";

// Per-trader ZK data (stored in refs — Uint8Arrays aren't serializable in React state)
interface TraderZkData {
  order: Veilbook.Order;
  nonce: Uint8Array;
  commitment: Uint8Array;
}

interface DashboardState {
  myState: TraderState;
  myOrder: OrderData | null;
  counterpartyStatus: CounterpartyStatus;
  counterpartyDirection: "BUY" | "SELL" | null;
  matchCount: number;
  feedEvents: FeedEvent[];
  isMatchAnimating: boolean;
  contractAddress: string | null;
  peerCount: number;
}

type Action =
  | { type: "SET_CONTRACT_ADDRESS"; address: string }
  | { type: "OPEN_FORM" }
  | { type: "START_PROVING"; order: OrderData }
  | { type: "ORDER_COMMITTED"; commitment: string; blockHeight: number; contractAddress?: string }
  | { type: "ORDER_FAILED" }
  | { type: "COUNTERPARTY_ORDER_RECEIVED"; commitment: string; direction: "BUY" | "SELL"; blockHeight: number }
  | { type: "PEER_JOINED"; peerCount: number }
  | { type: "PEER_LEFT"; peerCount: number }
  | { type: "START_MATCH" }
  | { type: "MATCH_SUCCESS"; blockHeight: number }
  | { type: "MATCH_FAILED" }
  | { type: "REMOTE_MATCH_CONFIRMED"; blockHeight: number }
  | { type: "RESET" };

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "SET_CONTRACT_ADDRESS":
      return { ...state, contractAddress: action.address };

    case "OPEN_FORM":
      return { ...state, myState: "FORM_OPEN" };

    case "START_PROVING":
      return { ...state, myState: "PROVING", myOrder: action.order };

    case "ORDER_COMMITTED": {
      const commitEvent: FeedEvent = {
        id: crypto.randomUUID(),
        type: "commitment",
        hash: action.commitment.slice(0, 10) + "..." + action.commitment.slice(-4),
        blockHeight: action.blockHeight,
        slot: "YOU",
        timestamp: Date.now(),
      };
      return {
        ...state,
        myState: "ORDER_COMMITTED",
        contractAddress: action.contractAddress || state.contractAddress,
        myOrder: state.myOrder ? { ...state.myOrder, commitment: action.commitment, blockHeight: action.blockHeight } : null,
        feedEvents: [...state.feedEvents, commitEvent],
      };
    }

    case "ORDER_FAILED":
      return { ...state, myState: "IDLE" };

    case "COUNTERPARTY_ORDER_RECEIVED": {
      const cpEvent: FeedEvent = {
        id: crypto.randomUUID(),
        type: "commitment",
        hash: action.commitment.slice(0, 10) + "..." + action.commitment.slice(-4),
        blockHeight: action.blockHeight,
        slot: "PEER",
        timestamp: Date.now(),
      };
      return {
        ...state,
        counterpartyStatus: "ORDER_RECEIVED",
        counterpartyDirection: action.direction,
        feedEvents: [...state.feedEvents, cpEvent],
      };
    }

    case "PEER_JOINED":
      return {
        ...state,
        peerCount: action.peerCount,
        counterpartyStatus: state.counterpartyStatus === "DISCONNECTED" ? "CONNECTED" : state.counterpartyStatus,
      };

    case "PEER_LEFT":
      return {
        ...state,
        peerCount: action.peerCount,
        counterpartyStatus: action.peerCount <= 1 ? "DISCONNECTED" : state.counterpartyStatus,
      };

    case "START_MATCH":
      return { ...state, myState: "MATCHING", isMatchAnimating: true };

    case "MATCH_SUCCESS": {
      const matchNum = state.matchCount + 1;
      const matchEvent: FeedEvent = {
        id: crypto.randomUUID(),
        type: "match",
        matchNumber: matchNum,
        blockHeight: action.blockHeight,
        timestamp: Date.now(),
      };
      return {
        ...state,
        myState: "MATCHED",
        matchCount: matchNum,
        feedEvents: [...state.feedEvents, matchEvent],
        isMatchAnimating: false,
      };
    }

    case "REMOTE_MATCH_CONFIRMED": {
      // Match was executed by the counterparty
      if (state.myState === "MATCHED" || state.myState === "MATCHING") return state;
      const matchNum = state.matchCount + 1;
      const matchEvent: FeedEvent = {
        id: crypto.randomUUID(),
        type: "match",
        matchNumber: matchNum,
        blockHeight: action.blockHeight,
        timestamp: Date.now(),
      };
      return {
        ...state,
        myState: "MATCHED",
        matchCount: matchNum,
        feedEvents: [...state.feedEvents, matchEvent],
        isMatchAnimating: false,
      };
    }

    case "MATCH_FAILED":
      return { ...state, myState: "MATCH_FAILED", isMatchAnimating: false };

    case "RESET":
      return { ...initialState, contractAddress: state.contractAddress };

    default:
      return state;
  }
}

const initialState: DashboardState = {
  myState: "IDLE",
  myOrder: null,
  counterpartyStatus: "DISCONNECTED",
  counterpartyDirection: null,
  matchCount: 0,
  feedEvents: [],
  isMatchAnimating: false,
  contractAddress: null,
  peerCount: 0,
};

// Helpers
const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex: string): Uint8Array =>
  new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030306] flex items-center justify-center"><span className="font-mono text-white/30 text-sm animate-pulse">INITIALIZING...</span></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    contractAddress: searchParams.get('contract') || process.env.NEXT_PUBLIC_VEILBOOK_ADDRESS || null,
  });

  const { isConnected: walletConnected, wallet, address, connect, coinPublicKey, encryptionPublicKey } = useWallet();
  const providersRef = useRef<any | null>(null);
  const activeContractRef = useRef<any | null>(null);
  const myZkRef = useRef<TraderZkData | null>(null);
  const counterpartyZkRef = useRef<RelayOrderData | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  // Relay connection
  const handleRelayMessage = useCallback((msg: RelayMessage) => {
    switch (msg.type) {
      case 'PEER_JOINED':
        dispatch({ type: 'PEER_JOINED', peerCount: msg.peerCount });
        break;
      case 'PEER_LEFT':
        dispatch({ type: 'PEER_LEFT', peerCount: msg.peerCount });
        break;
      case 'ORDER_SUBMITTED':
        counterpartyZkRef.current = msg.data;
        dispatch({
          type: 'COUNTERPARTY_ORDER_RECEIVED',
          commitment: msg.data.commitment,
          direction: msg.data.direction,
          blockHeight: msg.data.blockHeight,
        });
        break;
      case 'MATCH_CONFIRMED':
        dispatch({ type: 'REMOTE_MATCH_CONFIRMED', blockHeight: msg.blockHeight });
        break;
    }
  }, []);

  const relay = useRelay(state.contractAddress, address, handleRelayMessage);

  // Set origin after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Update URL when contract address changes
  useEffect(() => {
    if (state.contractAddress && !searchParams.get('contract')) {
      router.replace(`/dashboard?contract=${state.contractAddress}`, { scroll: false });
    }
  }, [state.contractAddress, searchParams, router]);

  const handleSubmitOrder = useCallback(
    async (order: OrderData) => {
      if (!walletConnected || !wallet || !address) {
        alert("Please connect your Midnight wallet first.");
        return;
      }

      dispatch({ type: "START_PROVING", order });

      try {
        if (!providersRef.current) {
          providersRef.current = createBrowserProviders(wallet, coinPublicKey as string, encryptionPublicKey as string, "preprod");
        }
        const providers = providersRef.current;

        // Always join the pre-deployed contract — any wallet can submit orders regardless of ownership
        if (!activeContractRef.current) {
          const addr = state.contractAddress;
          if (!addr) {
            throw new Error("No contract address set. Deploy a contract via the CLI and set NEXT_PUBLIC_VEILBOOK_ADDRESS.");
          }
          activeContractRef.current = await joinVeilbook(providers, addr);
        }

        const contract = activeContractRef.current!;
        const contractAddr = contract.deployTxData.public.contractAddress;

        const result: SubmitOrderResult = await submitOrder(
          providers,
          contract,
          order.direction,
          order.price,
          order.size
        );

        // Store own ZK data
        myZkRef.current = {
          order: result.order,
          nonce: result.nonce,
          commitment: result.commitment,
        };

        const commitHex = toHex(result.commitment);

        dispatch({
          type: "ORDER_COMMITTED",
          commitment: commitHex,
          blockHeight: result.txData.blockHeight,
          contractAddress: contractAddr,
        });

        // Publish order to relay so counterparty can discover it
        relay.publishOrder({
          direction: order.direction,
          price: String(result.order.price),
          size: String(result.order.size),
          nonce: toHex(result.nonce),
          commitment: commitHex,
          walletAddress: address,
          blockHeight: result.txData.blockHeight,
          order: {
            direction: String(result.order.direction),
            price: String(result.order.price),
            size: String(result.order.size),
          },
        });
      } catch (err: any) {
        console.error("Order submission failed:", err);
        alert("Failed to submit order: " + (err.message || err));
        dispatch({ type: "ORDER_FAILED" });
      }
    },
    [walletConnected, wallet, address, state.contractAddress, coinPublicKey, encryptionPublicKey, relay]
  );

  const handleMatch = useCallback(async () => {
    if (!walletConnected || !wallet || !activeContractRef.current || !address) {
      alert("Please connect your Midnight wallet first.");
      return;
    }

    const myZk = myZkRef.current;
    const cpData = counterpartyZkRef.current;
    if (!myZk || !cpData) {
      alert("Both orders must be submitted before matching.");
      return;
    }

    dispatch({ type: "START_MATCH" });
    relay.publishMatchAttempt(address);

    try {
      if (!providersRef.current) {
        providersRef.current = createBrowserProviders(wallet, coinPublicKey as string, encryptionPublicKey as string, "preprod");
      }
      const providers = providersRef.current;

      // Reconstruct counterparty's Veilbook.Order from relay data
      const cpOrder: Veilbook.Order = {
        direction: BigInt(cpData.order.direction),
        price: BigInt(cpData.order.price),
        size: BigInt(cpData.order.size),
      };
      const cpNonce = hexToBytes(cpData.nonce);
      const cpCommit = hexToBytes(cpData.commitment);

      // Order A must be the BUY side, Order B the SELL side (contract assertion)
      const iAmBuyer = myZk.order.direction === 0n;
      const orderA = iAmBuyer ? myZk.order : cpOrder;
      const nonceA = iAmBuyer ? myZk.nonce : cpNonce;
      const commitA = iAmBuyer ? myZk.commitment : cpCommit;
      const orderB = iAmBuyer ? cpOrder : myZk.order;
      const nonceB = iAmBuyer ? cpNonce : myZk.nonce;
      const commitB = iAmBuyer ? cpCommit : myZk.commitment;

      const txData = await matchOrders(
        providers,
        activeContractRef.current,
        orderA, nonceA, commitA,
        orderB, nonceB, commitB,
      );

      dispatch({ type: "MATCH_SUCCESS", blockHeight: txData.blockHeight });
      relay.publishMatchConfirmed(txData.blockHeight, address);
    } catch (err: any) {
      console.error("Match failed:", err);
      const errMsg = err.message || String(err);
      // If the order is already matched (race condition), treat as success
      if (errMsg.includes('not open') || errMsg.includes('MATCHED')) {
        dispatch({ type: "MATCH_SUCCESS", blockHeight: 0 });
      } else {
        dispatch({ type: "MATCH_FAILED" });
        relay.publishMatchFailed(errMsg, address);
      }
    }
  }, [walletConnected, wallet, address, coinPublicKey, encryptionPublicKey, relay]);

  const canMatch =
    state.myState === "ORDER_COMMITTED" &&
    state.counterpartyStatus === "ORDER_RECEIVED";

  const shareUrl = state.contractAddress && origin
    ? `${origin}/dashboard?contract=${state.contractAddress}`
    : null;

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#030306] text-white font-sans flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center backdrop-blur-xl bg-black/60 sticky top-0 z-50">
        <Link
          href="/"
          className="flex items-center gap-3 group text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <div className="w-7 h-7 bg-white text-black flex items-center justify-center font-bold rounded-md text-sm">
            V
          </div>
          <span className="font-mono tracking-tight text-sm">
            VEILBOOK{" "}
            <span className="text-white/30">{`// DASHBOARD`}</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Relay status */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 tracking-widest">
            {relay.isConnected ? (
              <>
                <Wifi size={12} className="text-emerald-400" />
                <span className="text-emerald-400/70">RELAY</span>
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-red-400" />
                <span className="text-red-400/70">RELAY</span>
              </>
            )}
          </div>

          {/* Peer count */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 tracking-widest">
            <Users size={12} />
            PEERS: {state.peerCount}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            PREPROD
          </div>

          <div className="text-[10px] font-mono text-white/20 px-3 py-1 rounded-full border border-white/[0.06]">
            MATCHES: {state.matchCount}
          </div>

          {state.myState !== "IDLE" && (
            <button
              onClick={() => {
                dispatch({ type: "RESET" });
                myZkRef.current = null;
                counterpartyZkRef.current = null;
              }}
              className="text-[10px] font-mono text-white/40 hover:text-white px-3 py-1 rounded-full border border-white/[0.06] hover:border-white/20 transition-all"
            >
              RESET
            </button>
          )}
          <WalletConnect />
        </div>
      </nav>

      {/* Share URL bar */}
      {shareUrl && (
        <div className="px-6 py-2 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-4">
          <span className="text-[10px] font-mono text-white/40 tracking-widest shrink-0">
            SHARE_WITH_COUNTERPARTY:
          </span>
          <code className="text-[10px] font-mono text-white/60 truncate flex-1">
            {shareUrl}
          </code>
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-white/40 hover:text-white px-3 py-1 border border-white/[0.06] hover:border-white/20 transition-all flex items-center gap-2 shrink-0"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      )}

      {/* Main content — single trader panel */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Your trader panel */}
          <div className="flex-1 relative">
            <TraderPanel
              label={address ? `YOU (${address.slice(0, 6)}...${address.slice(-4)})` : "YOU"}
              traderState={state.myState}
              order={state.myOrder}
              counterpartyStatus={state.counterpartyStatus}
              counterpartyDirection={state.counterpartyDirection}
              peerCount={state.peerCount}
              onOpenForm={() => dispatch({ type: "OPEN_FORM" })}
              onSubmitOrder={handleSubmitOrder}
              onAttemptMatch={handleMatch}
              canMatch={canMatch}
            />
          </div>

          {/* Counterparty status panel */}
          <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="flex-1 relative">
            <CounterpartyPanel
              status={state.counterpartyStatus}
              direction={state.counterpartyDirection}
              peerCount={state.peerCount}
              myState={state.myState}
              counterpartyCommitment={counterpartyZkRef.current?.commitment}
              counterpartyWallet={counterpartyZkRef.current?.walletAddress}
            />
          </div>
        </div>

        {/* Public Feed */}
        <PublicFeed events={state.feedEvents} />
      </main>

      {/* Match overlay animation */}
      {state.isMatchAnimating && (
        <MatchOverlay
          labelA={address ? `${address.slice(0, 6)}...` : "YOU"}
          labelB={counterpartyZkRef.current?.walletAddress ? `${counterpartyZkRef.current.walletAddress.slice(0, 6)}...` : "PEER"}
        />
      )}
    </div>
  );
}

// --- Counterparty Panel ---

function CounterpartyPanel({
  status,
  direction,
  peerCount,
  myState,
  counterpartyCommitment,
  counterpartyWallet,
}: {
  status: CounterpartyStatus;
  direction: "BUY" | "SELL" | null;
  peerCount: number;
  myState: TraderState;
  counterpartyCommitment?: string;
  counterpartyWallet?: string;
}) {
  return (
    <div className="h-full flex flex-col p-8 md:p-12 relative overflow-hidden bg-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-12 relative z-10 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm tracking-[0.3em] text-white/60">
            {counterpartyWallet ? `PEER (${counterpartyWallet.slice(0, 6)}...${counterpartyWallet.slice(-4)})` : "COUNTERPARTY"}
          </div>
        </div>
        <span className="font-mono text-[10px] text-white/40 tracking-[0.2em] uppercase bg-white/5 px-3 py-1 border border-white/10">
          {status === "DISCONNECTED" ? "AWAITING_PEER" : status.replace("_", " ")}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative z-10 w-full max-w-md mx-auto">
        {status === "DISCONNECTED" && peerCount <= 1 && (
          <div className="w-full text-center space-y-6">
            <div className="w-16 h-16 border border-dashed border-white/20 mx-auto flex items-center justify-center">
              <Users size={24} className="text-white/20" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-white/40 tracking-[0.2em] uppercase">
                WAITING_FOR_COUNTERPARTY
              </p>
              <p className="text-xs text-white/25 max-w-xs mx-auto leading-relaxed font-mono">
                Share the URL above with your trading counterparty. They will connect with their own Lace wallet.
              </p>
            </div>
          </div>
        )}

        {status === "CONNECTED" && (
          <div className="w-full text-center space-y-6">
            <div className="w-16 h-16 border border-white/30 mx-auto flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-emerald-400/70 tracking-[0.2em] uppercase">
                PEER_CONNECTED
              </p>
              <p className="text-xs text-white/25 max-w-xs mx-auto leading-relaxed font-mono">
                Counterparty is online. Waiting for their order submission.
              </p>
            </div>
          </div>
        )}

        {status === "ORDER_RECEIVED" && (
          <div className="w-full space-y-8">
            <div className="p-5 border border-white/20 bg-white/[0.02] space-y-4 relative">
              <div className="absolute -top-3 left-4 bg-black px-2">
                <span className="text-[10px] font-mono text-white/50 tracking-widest flex items-center gap-2">
                  COUNTERPARTY_ORDER
                </span>
              </div>
              <p className="font-mono text-xl text-white flex items-center justify-between">
                <span className={direction === "BUY" ? "text-emerald-400" : "text-red-400"}>
                  {direction}
                </span>
                <span className="text-white/30 text-sm">
                  [SIZE_AND_PRICE_HIDDEN]
                </span>
              </p>
            </div>

            {counterpartyCommitment && (
              <div className="p-4 border border-dashed border-white/20 bg-transparent">
                <p className="text-[10px] font-mono text-white/40 tracking-widest mb-2 uppercase">
                  Network_Commitment
                </p>
                <p className="font-mono text-[10px] text-white/60 break-all bg-white/5 p-2 border border-white/10">
                  {counterpartyCommitment.slice(0, 10)}...{counterpartyCommitment.slice(-4)}
                </p>
              </div>
            )}

            {myState === "MATCHED" && (
              <div className="p-8 border border-white bg-white text-black text-center space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-black to-transparent opacity-50" />
                <p className="font-mono text-2xl tracking-[0.3em] font-bold">
                  EXECUTED
                </p>
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-70">
                  ZK_Constraints_Satisfied
                </p>
              </div>
            )}

            {myState === "MATCH_FAILED" && (
              <div className="p-8 border border-white/30 bg-transparent text-center space-y-4">
                <p className="font-mono text-xl tracking-[0.2em] text-white opacity-80">
                  CONSTRAINT_FAILURE
                </p>
                <div className="w-full h-px bg-white/20" />
                <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase leading-loose">
                  Intent overlap not found.<br />
                  No state change broadcast.<br />
                  Zero data leaked.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
