import React from 'react';
import Link from 'next/link';

export default function FinalCTA() {
  return (
    <section className="relative w-full py-40 flex flex-col items-center justify-center bg-black cta-section">
      <div className="max-w-4xl w-full px-6 text-center cta-block opacity-0 translate-y-5">
        
        <div className="flex flex-col md:flex-row justify-center items-center space-y-8 md:space-y-0 md:space-x-16 mb-20 font-mono text-sm text-white/60">
          <div className="flex flex-col items-center">
            <span className="text-4xl text-white mb-2"><span className="stat-number" data-target="3">0</span></span>
            <span>ZK Proofs Generated</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl text-white mb-2"><span className="stat-zero">0</span></span>
            <span>Data Leaked</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl text-white mb-2">&lt;<span className="stat-number" data-target="10">0</span>s</span>
            <span>Execution Time</span>
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl text-white font-medium mb-10">
          Execute with Certainty.
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard" prefetch={false} className="px-10 py-5 bg-white text-black font-medium text-sm tracking-widest uppercase hover:bg-white/90 transition-colors">
            Launch Dashboard
          </Link>
          <Link href="/demo" prefetch={false} className="px-10 py-5 border border-white/20 text-white/70 font-medium text-sm tracking-widest uppercase hover:border-white/40 hover:text-white transition-all">
            View Architecture
          </Link>
        </div>
      </div>
    </section>
  );
}
