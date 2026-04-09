"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Activity } from "lucide-react";

export interface FeedEvent {
  id: string;
  type: "commitment" | "match";
  hash?: string;
  slot?: string;
  matchNumber?: number;
  blockHeight: number;
  timestamp: number;
}

interface PublicFeedProps {
  events: FeedEvent[];
}

export default function PublicFeed({ events }: PublicFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  // We only animate the latest added item
  useGSAP(() => {
    if (events.length > 0) {
      const latestItem = itemsRef.current[events.length - 1];
      if (latestItem) {
        gsap.fromTo(latestItem, 
          { opacity: 0, x: 50, filter: "blur(4px)" },
          { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }
        );
      }
      if (scrollRef.current) {
        gsap.to(scrollRef.current, { scrollLeft: scrollRef.current.scrollWidth, duration: 0.5, ease: "power2.out" });
      }
    }
  }, [events]);

  return (
    <div className="border-t border-white/10 bg-black">
      {/* Header */}
      <div className="px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
        <Activity size={12} className="text-white/40" />
        <span className="font-mono text-[10px] text-white/50 tracking-[0.2em]">
          MIDNIGHT_LEDGER_FEED
        </span>
        <div className="flex-1 h-px bg-white/10" />
        <span className="font-mono text-[10px] text-white/30">
          {events.length === 0
            ? "AWAITING_STATE_TRANSITION..."
            : `TOTAL_EVENTS: ${events.length.toString().padStart(3, '0')}`}
        </span>
      </div>

      {/* Events ticker */}
      <div
        ref={scrollRef}
        className="flex gap-4 px-6 py-5 overflow-x-auto scrollbar-hide items-center"
      >
        {events.length === 0 && (
          <div className="flex items-center gap-3 text-white/30 font-mono text-xs tracking-widest">
            <div className="w-1.5 h-1.5 border border-white/50 animate-ping" />
            [ LISTENING ]
          </div>
        )}

        {events.map((event, index) => (
          <div
            key={event.id}
            ref={(el) => { itemsRef.current[index] = el; }}
            className="flex-shrink-0"
          >
            {event.type === "commitment" && (
              <div className="flex items-center gap-4 px-5 py-3 border border-white/20 bg-black hover:bg-white/[0.05] transition-colors relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20 group-hover:bg-white/50 transition-colors" />
                <span className="font-mono text-white/40 text-xs">[ COMM ]</span>
                <div>
                  <p className="font-mono text-xs text-white/80 tracking-wider">
                    {event.hash}
                  </p>
                  <p className="font-mono text-[9px] text-white/40 mt-1 uppercase tracking-widest">
                    BLK_{event.blockHeight} {`//`} {event.slot === "PEER" ? "COUNTERPARTY" : event.slot}
                  </p>
                </div>
              </div>
            )}

            {event.type === "match" && (
              <div className="flex items-center gap-4 px-5 py-3 border border-white/40 bg-white/5 hover:bg-white/10 transition-colors relative overflow-hidden group shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white group-hover:bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <span className="font-mono text-white text-xs tracking-widest">[ MATCHED ]</span>
                <div>
                  <p className="font-mono text-xs text-white tracking-widest">
                    SEQ_{event.matchNumber?.toString().padStart(4, '0')}
                  </p>
                  <p className="font-mono text-[9px] text-white/50 mt-1 uppercase tracking-widest">
                    BLK_{event.blockHeight} {`//`} STATE_UPDATED
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
