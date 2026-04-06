"use client";

import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';

export default function NetworkStatus() {
  const [proofServerStatus, setProofServerStatus] = useState<'checking' | 'up' | 'down'>('checking');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/network-status');
        const data = await res.json();
        setProofServerStatus(data.proofServer);
      } catch (error) {
        setProofServerStatus('down');
      }
    };

    checkStatus();
    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    if (proofServerStatus === 'down') {
      navigator.clipboard.writeText('cd veilbook/veilbook-cli && npm run preview-ps');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group">
      <div 
        onClick={handleCopy}
        className={`flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md ${proofServerStatus === 'down' ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2">
          <Server size={14} className="text-white/60" />
          <span className="text-xs font-mono tracking-wider text-white/60">PROOF SERVER:</span>
        </div>
        
        {proofServerStatus === 'checking' && (
          <span className="text-xs font-mono text-yellow-500 animate-pulse">CHECKING...</span>
        )}
        
        {proofServerStatus === 'up' && (
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 size={14} />
            <span className="text-xs font-mono">ONLINE</span>
          </div>
        )}
        
        {proofServerStatus === 'down' && (
          <div className="flex items-center gap-1 text-red-400">
            <XCircle size={14} />
            <span className="text-xs font-mono">OFFLINE</span>
          </div>
        )}
      </div>

      {proofServerStatus === 'down' && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 p-3 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 whitespace-nowrap">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 border-t border-l border-white/10 rotate-45"></div>
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="text-[10px] font-mono text-white/60 uppercase tracking-widest">Start Proof Server</div>
            <div className="text-white/40 flex items-center gap-1 text-[10px] font-mono">
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? <span className="text-emerald-400">COPIED</span> : 'CLICK TO COPY'}
            </div>
          </div>
          <div className="text-xs font-mono text-emerald-400 bg-black/50 p-2 rounded text-left">
            cd veilbook/veilbook-cli && <br/>npm run preview-ps
          </div>
        </div>
      )}
    </div>
  );
}
