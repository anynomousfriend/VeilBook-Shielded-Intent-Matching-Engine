"use client";

import React, { useReducer, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TraderPanel from "@/components/dashboard/TraderPanel";
import PublicFeed, { type FeedEvent } from "@/components/dashboard/PublicFeed";
import MatchOverlay from "@/components/dashboard/MatchOverlay";
import WalletConnect from "@/components/wallet-connect";
import type { TraderState, OrderData } from "@/lib/dashboard-types";
import { useWallet } from "@/contexts/WalletContext";
import { createBrowserProviders } from "@/lib/providers";
import { deployVeilbook, joinVeilbook, submitOrder, matchOrders } from "@/lib/veilbook-api";

interface DashboardState {
  traderA: { state: TraderState; order: OrderData | null };
  traderB: { state: TraderState; order: OrderData | null };
  matchCount: number;
  feedEvents: FeedEvent[];
  isMatchAnimating: boolean;
  contractAddress: string | null;
}

type Action =
  | { type: "OPEN_FORM"; trader: "A" | "B" }
  | { type: "START_PROVING"; trader: "A" | "B"; order: OrderData }
  | { type: "ORDER_COMMITTED"; trader: "A" | "B"; commitment: string; blockHeight: number; contractAddress?: string }
  | { type: "ORDER_FAILED"; trader: "A" | "B" }
  | { type: "START_MATCH" }
  | { type: "MATCH_SUCCESS"; blockHeight: number }
  | { type: "MATCH_FAILED" }
  | { type: "RESET" };

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "OPEN_FORM":
      return {
        ...state,
        [action.trader === "A" ? "traderA" : "traderB"]: {
          ...state[action.trader === "A" ? "traderA" : "traderB"],
          state: "FORM_OPEN" as TraderState,
        },
      };
    case "START_PROVING":
      return {
        ...state,
        [action.trader === "A" ? "traderA" : "traderB"]: {
          state: "PROVING" as TraderState,
          order: action.order,
        },
      };
    case "ORDER_COMMITTED": {
      const traderKey = action.trader === "A" ? "traderA" : "traderB";
      const slot = action.trader === "A" ? "Slot A" : "Slot B";
      const newEvent: FeedEvent = {
        id: crypto.randomUUID(),
        type: "commitment",
        hash: action.commitment.slice(0, 10) + "..." + action.commitment.slice(-4),
        blockHeight: action.blockHeight,
        slot,
        timestamp: Date.now(),
      };
      return {
        ...state,
        contractAddress: action.contractAddress || state.contractAddress,
        [traderKey]: {
          state: "ORDER_COMMITTED" as TraderState,
          order: {
            ...state[traderKey].order!,
            commitment: action.commitment,
            blockHeight: action.blockHeight,
          },
        },
        feedEvents: [...state.feedEvents, newEvent],
      };
    }
    case "ORDER_FAILED":
      return {
        ...state,
        [action.trader === "A" ? "traderA" : "traderB"]: {
          ...state[action.trader === "A" ? "traderA" : "traderB"],
          state: "IDLE" as TraderState, // Revert back to idle
        },
      };
    case "START_MATCH":
      return {
        ...state,
        traderA: { ...state.traderA, state: "MATCHING" },
        traderB: { ...state.traderB, state: "MATCHING" },
        isMatchAnimating: true,
      };
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
        traderA: { ...state.traderA, state: "MATCHED" },
        traderB: { ...state.traderB, state: "MATCHED" },
        matchCount: matchNum,
        feedEvents: [...state.feedEvents, matchEvent],
        isMatchAnimating: false,
      };
    }
    case "MATCH_FAILED":
      return {
        ...state,
        traderA: { ...state.traderA, state: "MATCH_FAILED" },
        traderB: { ...state.traderB, state: "MATCH_FAILED" },
        isMatchAnimating: false,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: DashboardState = {
  traderA: { state: "IDLE", order: null },
  traderB: { state: "IDLE", order: null },
  matchCount: 0,
  feedEvents: [],
  isMatchAnimating: false,
  contractAddress: null,
};

export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isConnected, wallet, connect, coinPublicKey, encryptionPublicKey } = useWallet();
  const activeContractRef = useRef<any | null>(null);

  const handleSubmitOrder = useCallback(
    async (trader: "A" | "B", order: OrderData) => {
      if (!isConnected || !wallet) {
        alert("Please connect your Midnight wallet first.");
        return;
      }

      dispatch({ type: "START_PROVING", trader, order });

      try {
        const providers = createBrowserProviders(wallet, coinPublicKey as string, encryptionPublicKey as string, "preview");
        
        // If no contract exists yet, deploy one for this pair
        if (!activeContractRef.current && !state.contractAddress) {
          activeContractRef.current = await deployVeilbook(providers);
        } else if (!activeContractRef.current && state.contractAddress) {
          // Re-join if we have an address but no active instance in memory
          activeContractRef.current = await joinVeilbook(providers, state.contractAddress);
        }

        const contract = activeContractRef.current!;
        const address = contract.deployTxData.public.contractAddress;

        // Trigger real ZK proof and wallet signature
        const txData = await submitOrder(providers, contract, trader, order.direction, order.price, order.size);
        
        dispatch({
          type: "ORDER_COMMITTED",
          trader,
          commitment: txData.txId,
          blockHeight: txData.blockHeight,
          contractAddress: address,
        });

      } catch (err: any) {
        console.error("Order submission failed:", err);
        alert("Failed to submit order: " + (err.message || err));
        dispatch({ type: "ORDER_FAILED", trader });
      }
    },
    [isConnected, wallet, state.contractAddress, coinPublicKey, encryptionPublicKey]
  );

  const handleMatch = useCallback(async () => {
    if (!isConnected || !wallet || !activeContractRef.current) {
      alert("Please connect your Midnight wallet first.");
      return;
    }

    dispatch({ type: "START_MATCH" });

    try {
      const providers = createBrowserProviders(wallet, coinPublicKey as string, encryptionPublicKey as string, "preview");
      const txData = await matchOrders(providers, activeContractRef.current);
      
      dispatch({ type: "MATCH_SUCCESS", blockHeight: txData.blockHeight });
    } catch (err: any) {
      console.error("Match failed:", err);
      // The ZK proof or matching logic rejected the transaction
      dispatch({ type: "MATCH_FAILED" });
    }
  }, [isConnected, wallet, coinPublicKey, encryptionPublicKey]);

  const bothCommitted =
    state.traderA.state === "ORDER_COMMITTED" &&
    state.traderB.state === "ORDER_COMMITTED";

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
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            PREPROD
          </div>
          <div className="text-[10px] font-mono text-white/20 px-3 py-1 rounded-full border border-white/[0.06]">
            MATCHES: {state.matchCount}
          </div>
          {(state.traderA.state !== "IDLE" || state.traderB.state !== "IDLE") && (
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="text-[10px] font-mono text-white/40 hover:text-white px-3 py-1 rounded-full border border-white/[0.06] hover:border-white/20 transition-all"
            >
              RESET
            </button>
          )}
          <WalletConnect />
        </div>
      </nav>

      {/* Main split-screen */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Trader A */}
          <div className="flex-1 border-r border-white/[0.04] relative">
            <TraderPanel
              label="TRADER_A"
              traderState={state.traderA.state}
              order={state.traderA.order}
              counterpartyState={state.traderB.state}
              onOpenForm={() => dispatch({ type: "OPEN_FORM", trader: "A" })}
              onSubmitOrder={(order: OrderData) => handleSubmitOrder("A", order)}
              onAttemptMatch={handleMatch}
              canMatch={bothCommitted}
            />
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Trader B */}
          <div className="flex-1 relative">
            <TraderPanel
              label="TRADER_B"
              traderState={state.traderB.state}
              order={state.traderB.order}
              counterpartyState={state.traderA.state}
              onOpenForm={() => dispatch({ type: "OPEN_FORM", trader: "B" })}
              onSubmitOrder={(order: OrderData) => handleSubmitOrder("B", order)}
              onAttemptMatch={handleMatch}
              canMatch={bothCommitted}
            />
          </div>
        </div>

        {/* Public Feed */}
        <PublicFeed events={state.feedEvents} />
      </main>

      {/* Match overlay animation */}
      {state.isMatchAnimating && <MatchOverlay />}
    </div>
  );
}
