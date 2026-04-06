"use client";

import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { OrderData } from "@/lib/dashboard-types";
import { Lock } from "lucide-react";

interface OrderFormProps {
  onSubmit: (order: OrderData) => void;
}

export default function OrderForm({ onSubmit }: OrderFormProps) {
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  
  const containerRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price);
    const s = parseFloat(size);
    if (!p || p <= 0 || !s || s <= 0) return;
    
    // Quick mechanical snap animation before submit
    gsap.to(containerRef.current, {
      scale: 0.98,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      onComplete: () => onSubmit({ direction, price: p, size: s })
    });
  };

  const isBuy = direction === "BUY";

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="space-y-5 relative">
      <div className="p-6 border border-white/20 bg-white/[0.02] backdrop-blur-sm space-y-6 relative overflow-hidden">
        {/* Corner structural accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/50" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/50" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/50" />

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/40 tracking-[0.3em]">
            NEW_ORDER
          </span>
          <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
            [ TKN_A / TKN_B ]
          </span>
        </div>

        {/* Direction Toggle Mechanical */}
        <div>
          <label className="text-[10px] font-mono text-white/40 tracking-widest block mb-3">
            INTENT
          </label>
          <div className="flex gap-2">
             <button
                type="button"
                onClick={() => setDirection("BUY")}
                className={`flex-1 py-3 font-mono text-sm tracking-widest transition-all duration-300 ${
                  isBuy 
                  ? "bg-white text-black font-bold border border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                  : "bg-transparent text-white/40 border border-white/10 hover:border-white/30"
                }`}
             >
                <span className={isBuy ? "text-emerald-600" : ""}>BUY</span>
             </button>
             <button
                type="button"
                onClick={() => setDirection("SELL")}
                className={`flex-1 py-3 font-mono text-sm tracking-widest transition-all duration-300 ${
                  !isBuy 
                  ? "bg-transparent text-red-400 font-bold border border-white/40 border-dashed" 
                  : "bg-transparent text-white/40 border border-white/10 hover:border-white/30"
                }`}
             >
                SELL
             </button>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="text-[10px] font-mono text-white/40 tracking-widest block mb-2">
            LIMIT_PRICE
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-0 py-2 bg-transparent border-b border-white/20 outline-none focus:border-white transition-colors font-mono text-xl text-white placeholder:text-white/10"
            />
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="text-[10px] font-mono text-white/40 tracking-widest block mb-2">
            ORDER_SIZE
          </label>
          <div className="relative">
            <input
              type="number"
              step="1"
              min="1"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0"
              className="w-full px-0 py-2 bg-transparent border-b border-white/20 outline-none focus:border-white transition-colors font-mono text-xl text-white placeholder:text-white/10"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!price || !size}
        className="w-full py-4 border border-white/20 bg-white/5 text-white hover:bg-white hover:text-black font-mono text-sm tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 group"
      >
        <Lock size={14} className="group-hover:text-black transition-colors" />
        ENCRYPT & SUBMIT
      </button>
    </form>
  );
}
