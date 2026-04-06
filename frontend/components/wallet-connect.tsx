"use client";

import React from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Wallet, Loader2, LogOut } from "lucide-react";

export default function WalletConnect() {
  const { isConnected, isConnecting, address, error, connect, disconnect } = useWallet();

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    // Format to 0xABCD...1234
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (isConnecting) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 font-mono text-[10px] tracking-widest cursor-not-allowed">
        <Loader2 size={12} className="animate-spin" />
        CONNECTING...
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative group">
        <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-mono text-[10px] tracking-widest hover:bg-white/15 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
          {formatAddress(address)}
        </button>
        
        {/* Dropdown to disconnect */}
        <div className="absolute top-full right-0 mt-2 p-2 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
           <button 
             onClick={disconnect}
             className="w-full flex items-center justify-between gap-4 px-4 py-2 rounded border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-colors font-mono text-[10px] tracking-widest"
           >
             DISCONNECT
             <LogOut size={12} />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <button 
        onClick={connect}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-mono text-[10px] font-bold tracking-widest hover:scale-105 active:scale-95 transition-transform"
      >
        <Wallet size={12} />
        CONNECT_WALLET
      </button>
      
      {error && (
        <div className="absolute top-full right-0 mt-2 p-3 w-64 rounded-lg bg-zinc-900 border border-red-500/30 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <p className="text-[10px] font-mono text-red-400 leading-relaxed uppercase">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
