"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { TraderState, OrderData } from "@/lib/dashboard-types";
import OrderForm from "./OrderForm";
import SealedEnvelope from "./SealedEnvelope";
import { Lock, Search } from "lucide-react";

interface TraderPanelProps {
  label: string;
  traderState: TraderState;
  order: OrderData | null;
  counterpartyState: TraderState;
  onOpenForm: () => void;
  onSubmitOrder: (order: OrderData) => void;
  onAttemptMatch: () => void;
  canMatch: boolean;
}

export default function TraderPanel({
  label,
  traderState,
  order,
  counterpartyState,
  onOpenForm,
  onSubmitOrder,
  onAttemptMatch,
  canMatch,
}: TraderPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Depth and Luminance mechanics based on counterparty state
  const isFocused = traderState === "FORM_OPEN" || traderState === "PROVING" || traderState === "MATCHING";
  const isCounterpartyFocused = counterpartyState === "FORM_OPEN" || counterpartyState === "PROVING" || counterpartyState === "MATCHING";
  const isRecessed = !isFocused && isCounterpartyFocused;

  useGSAP(() => {
    if (isRecessed) {
      gsap.to(containerRef.current, { scale: 0.98, opacity: 0.4, filter: "blur(2px)", duration: 0.6, ease: "power2.out" });
    } else {
      gsap.to(containerRef.current, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "power2.out" });
    }
  }, [isRecessed]);

  // Entrance animation for content state changes
  useGSAP(() => {
    if (contentRef.current && contentRef.current.children.length > 0) {
      gsap.fromTo(contentRef.current.children[0], 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [traderState]);

  return (
    <div ref={containerRef} className="h-full flex flex-col p-8 md:p-12 relative overflow-hidden bg-black transition-colors duration-700">
      {/* Structural ambient light instead of color */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-64 bg-white/[0.02] rounded-[100%] blur-3xl pointer-events-none transition-opacity duration-1000 ${isFocused ? 'opacity-100' : 'opacity-0'}`} />

      {/* Header */}
      <div className="flex items-center justify-between mb-12 relative z-10 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm tracking-[0.3em] text-white">
            {label}
          </div>
        </div>
        <span className="font-mono text-[10px] text-white/40 tracking-[0.2em] uppercase bg-white/5 px-3 py-1 border border-white/10">
          {traderState === "IDLE" ? "AWAITING_INPUT" : traderState.replace("_", " ")}
        </span>
      </div>

      {/* Content area */}
      <div ref={contentRef} className="flex-1 flex items-center justify-center relative z-10 w-full max-w-md mx-auto">
        
        {traderState === "IDLE" && (
          <div key="idle" className="w-full">
            <button
              onClick={onOpenForm}
              className="w-full py-8 border border-white/20 bg-white/5 hover:bg-white hover:text-black text-white/60 font-mono text-sm tracking-[0.3em] uppercase transition-all duration-500 flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <span className="relative z-10 group-hover:text-black flex items-center gap-3">
                [ INITIALIZE_ORDER ]
              </span>
            </button>
          </div>
        )}

        {traderState === "FORM_OPEN" && (
          <div key="form" className="w-full">
            <OrderForm onSubmit={onSubmitOrder} />
          </div>
        )}

        {traderState === "PROVING" && (
          <div key="proving" className="w-full flex flex-col items-center">
            <SealedEnvelope stage="proving" />
            <div className="mt-8 text-center space-y-4">
              <p className="font-mono text-[10px] text-white/50 tracking-[0.2em] uppercase animate-pulse">
                {`// Generating_ZK_Proof`}
              </p>
              <p className="text-xs text-white/30 max-w-xs mx-auto leading-relaxed font-mono">
                Computing shielded transaction. Terms remain isolated in local enclave.
              </p>
            </div>
          </div>
        )}

        {traderState === "ORDER_COMMITTED" && order && (
          <div key="committed" className="w-full space-y-8">
            <SealedEnvelope stage="sealed" />

            <div className="p-5 border border-white/20 bg-white/[0.02] space-y-4 relative">
              <div className="absolute -top-3 left-4 bg-black px-2">
                <span className="text-[10px] font-mono text-white/50 tracking-widest flex items-center gap-2">
                  <Lock size={10} /> LOCAL_STATE (PLAINTEXT)
                </span>
              </div>
              <p className="font-mono text-xl text-white flex items-center justify-between">
                <span className={order.direction === "BUY" ? "text-emerald-400" : "text-red-400"}>{order.direction}</span>
                <span>{order.size} @ {order.price.toFixed(2)}</span>
              </p>
            </div>

            <div className="p-4 border border-dashed border-white/20 bg-transparent">
              <p className="text-[10px] font-mono text-white/40 tracking-widest mb-2 uppercase">
                Network_Commitment
              </p>
              <p className="font-mono text-[10px] text-white/60 break-all bg-white/5 p-2 border border-white/10">
                {order.commitment}
              </p>
            </div>

            {canMatch && (
              <button
                onClick={onAttemptMatch}
                className="w-full py-4 border border-white bg-white text-black hover:bg-black hover:text-white transition-colors font-mono text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-3"
              >
                <Search size={14} />
                EXECUTE_MATCH_PROTOCOL
              </button>
            )}
          </div>
        )}

        {traderState === "MATCHING" && (
          <div key="matching" className="w-full flex flex-col items-center">
            <SealedEnvelope stage="matching" />
            <div className="mt-8 text-center space-y-4">
              <p className="font-mono text-[10px] text-white/50 tracking-[0.2em] uppercase animate-pulse">
                {`// Evaluating_Constraints`}
              </p>
            </div>
          </div>
        )}

        {traderState === "MATCHED" && order && (
          <div key="matched" className="w-full space-y-8">
            <div className="p-8 border border-white bg-white text-black text-center space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-black to-transparent opacity-50" />
              <p className="font-mono text-2xl tracking-[0.3em] font-bold">
                EXECUTED
              </p>
              <p className="font-mono text-[10px] tracking-widest uppercase opacity-70">
                ZK_Constraints_Satisfied
              </p>
            </div>

            <div className="p-5 border border-white/20 bg-white/[0.02]">
              <p className="font-mono text-xl text-white flex items-center justify-between">
                <span className={order.direction === "BUY" ? "text-emerald-400" : "text-red-400"}>{order.direction}</span>
                <span>{order.size} @ {order.price.toFixed(2)}</span>
              </p>
            </div>

            <div className="p-4 border border-white/10 bg-white/5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/40 tracking-widest">COUNTERPARTY_DATA</span>
              <span className="font-mono text-[10px] text-white/30 tracking-widest flex items-center gap-2">
                <Lock size={10} /> ZERO_KNOWLEDGE
              </span>
            </div>
          </div>
        )}

        {traderState === "MATCH_FAILED" && (
          <div key="failed" className="w-full space-y-8">
            <div className="p-8 border border-white/30 bg-transparent text-center space-y-4">
              <p className="font-mono text-xl tracking-[0.2em] text-white opacity-80">
                CONSTRAINT_FAILURE
              </p>
              <div className="w-full h-px bg-white/20" />
              <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase leading-loose">
                Intent overlap not found.<br/>
                No state change broadcast.<br/>
                Zero data leaked.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
