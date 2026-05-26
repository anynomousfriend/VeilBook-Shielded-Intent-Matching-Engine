"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import { ChevronRight, ChevronLeft, Shield, Cpu, Network, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

const DidVerification = dynamic(() => import('@/components/did-verification'), { ssr: false });
const SmartContractFactory = dynamic(() => import('@/components/smart-contract-factory'), { ssr: false });
const PosConsensus = dynamic(() => import('@/components/pos-consensus'), { ssr: false });

import NetworkStatus from '@/components/network-status';

const DEMO_STEPS = [
  {
    id: 'did',
    title: 'Identity Verification',
    subtitle: 'Zero-Knowledge Proof of Identity',
    description: 'Veilbook uses decentralized identifiers (DIDs) to verify traders without exposing their real-world identities on the public ledger.',
    component: DidVerification,
    icon: Shield,
    color: 'blue'
  },
  {
    id: 'factory',
    title: 'Smart Contract Factory',
    subtitle: 'On-Demand Shielded Logic',
    description: 'Every trade pair is backed by a dedicated shielded smart contract, ensuring isolated state and absolute privacy for your orders.',
    component: SmartContractFactory,
    icon: Cpu,
    color: 'purple'
  },
  {
    id: 'consensus',
    title: 'PoS Consensus',
    subtitle: 'Midnight Network Validation',
    description: 'Finality is reached through Midnight\'s Proof-of-Stake consensus, securing the network while maintaining data protection guarantees.',
    component: PosConsensus,
    icon: Network,
    color: 'emerald'
  }
];

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => setCurrentStep((prev) => (prev + 1) % DEMO_STEPS.length);
  const prevStep = () => setCurrentStep((prev) => (prev - 1 + DEMO_STEPS.length) % DEMO_STEPS.length);

  const activeStep = DEMO_STEPS[currentStep];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
      {/* Navigation Header */}
      <nav className="p-6 border-b border-white/10 flex justify-between items-center backdrop-blur-md bg-black/50 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
          <span className="font-mono tracking-tighter text-xl font-medium">VEILBOOK <span className="text-white/40">{`// DEMO`}</span></span>
        </Link>
        
        <div className="hidden md:block">
          <NetworkStatus />
        </div>

        <div className="flex gap-4">
          {DEMO_STEPS.map((step, idx) => (
            <button 
              key={step.id}
              onClick={() => setCurrentStep(idx)}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${currentStep === idx ? 'bg-white w-8' : 'bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>

        <Link href="/" prefetch={false} className="text-sm font-mono text-white/60 hover:text-white transition-colors flex items-center gap-2">
          EXIT TO SITE <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Left: Interactive Visualization */}
        <div className="flex-1 relative bg-[#070709] border-r border-white/5 flex items-center justify-center min-h-[50vh] lg:min-h-0">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeStep.id}
              initial={{ opacity: 0, scale: 0.9, rotateY: 5 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 1.1, rotateY: -5 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full flex items-center justify-center"
            >
              <activeStep.component />
            </motion.div>
          </AnimatePresence>
          
          {/* Visual Overlay elements */}
          <div className="absolute bottom-8 left-8 flex flex-col gap-2 pointer-events-none">
            <div className="flex items-center gap-3 text-[10px] font-mono text-white/40 tracking-[0.2em]">
               <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
               SYSTEM_ACTIVE
            </div>
            <div className="text-[10px] font-mono text-white/20 tracking-[0.2em]">
               ENCLAVE_ADDR: 0x{activeStep.id.toUpperCase()}_NODE_v2.0.2
            </div>
          </div>
        </div>

        {/* Right: Info Panel */}
        <div className="w-full lg:w-[450px] p-8 md:p-12 flex flex-col justify-between bg-black z-10 border-t lg:border-t-0 border-white/10">
          
          <div className="space-y-12">
            <motion.div
              key={`title-${activeStep.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-white`}>
                  <activeStep.icon size={24} />
                </div>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
              </div>
              
              <span className="font-mono text-xs text-white/40 uppercase tracking-[0.3em] mb-4 block">
                Module 0{currentStep + 1}
              </span>
              <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
                {activeStep.title}
              </h1>
              <h2 className="text-lg md:text-xl font-mono text-white/80 mb-8 italic opacity-60">
                {activeStep.subtitle}
              </h2>
              <p className="text-white/50 text-lg leading-relaxed font-light">
                {activeStep.description}
              </p>
            </motion.div>

            <div className="space-y-4 pt-8">
              <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] group hover:border-white/20 transition-all cursor-default">
                <span className="text-xs font-mono text-white/40">ENCRYPTION</span>
                <span className="text-xs font-mono text-white/80 group-hover:text-white">AES-256-GCM / Poseidon</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] group hover:border-white/20 transition-all cursor-default">
                <span className="text-xs font-mono text-white/40">NETWORK_ID</span>
                <span className="text-xs font-mono text-white/80 group-hover:text-white">Midnight Preprod</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-12">
            <div className="flex gap-4">
              <button 
                onClick={prevStep}
                className="p-4 rounded-full border border-white/10 hover:bg-white/5 hover:border-white/30 transition-all text-white/60 hover:text-white"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={nextStep}
                className="p-4 rounded-full border border-white/10 hover:bg-white/5 hover:border-white/30 transition-all text-white/60 hover:text-white"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {currentStep === DEMO_STEPS.length - 1 ? (
              <Link 
                href="/dashboard"
                prefetch={false}
                className="px-8 py-4 bg-white text-black font-medium text-sm tracking-widest uppercase hover:invert transition-all inline-block"
              >
                ENTER DASHBOARD
              </Link>
            ) : (
              <button 
                onClick={nextStep}
                className="px-8 py-4 bg-white text-black font-medium text-sm tracking-widest uppercase hover:invert transition-all"
              >
                NEXT MODULE
              </button>
            )}
          </div>

        </div>
      </main>

      {/* Footer background glow */}
      <div className="fixed bottom-0 left-0 w-full h-[30vh] bg-gradient-to-t from-white/[0.05] to-transparent pointer-events-none -z-10" />
    </div>
  );
}
