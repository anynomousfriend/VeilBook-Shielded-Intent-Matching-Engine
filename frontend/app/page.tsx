"use client";

import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import dynamic from 'next/dynamic';

import Hero from '@/components/landing/Hero';
import ProblemSection from '@/components/landing/ProblemSection';
import SolutionSection from '@/components/landing/SolutionSection';

import ThreeViewers from '@/components/landing/ThreeViewers';
import TechSection from '@/components/landing/TechSection';
import FinalCTA from '@/components/landing/FinalCTA';

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      // Defaults
      gsap.defaults({ ease: "expo.out", duration: 0.9 });

      // HERO
      const heroTl = gsap.timeline();
      // Shimmer is already running via CSS or just static SVG.
      heroTl.to('.hero-title', { opacity: 1, y: 0, duration: 0.6, delay: 0.3 })
            .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.6 }, "-=0.4")
            .to('.hero-cta', { opacity: 1, duration: 0.6 }, "-=0.2")
            .to('.hero-logo', { opacity: 1, duration: 1 }, "-=0.4");

      // PROBLEM
      const problemTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.problem-section',
          start: 'top 80%',
        }
      });
      problemTl.to('.problem-title', { opacity: 1, y: 0, stagger: 0.2 })
               .to('.problem-text', { opacity: 1, y: 0 }, "-=0.2");

      // SOLUTION
      const solutionTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.solution-section',
          start: 'top 80%',
        }
      });
      solutionTl.to('.solution-title', { opacity: 1, y: 0 })
                .to('.solution-visualizer', { opacity: 1, scale: 1, duration: 0.8 }, "-=0.2")
                .to('.solution-line-mask', { width: "100%", duration: 1, ease: "none" }, "-=0.4")
                .to('.solution-step', { opacity: 1, scale: 1, stagger: { amount: 0.4, from: "start" } }, "-=0.8");

      // ASYMMETRIC VISIBILITY
      const viewersTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.viewers-section',
          start: 'top 80%',
        }
      });
      viewersTl.to('.viewers-title', { opacity: 1, y: 0 })
               .to('.viewers-container', { opacity: 1, y: 0, duration: 0.8 }, "-=0.4")
               .to('.viewers-lens', { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" }, "-=0.4");

      // FINAL CTA
      const ctaTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.cta-section',
          start: 'top 80%',
        }
      });
      ctaTl.to('.cta-block', { opacity: 1, y: 0 })
           .to('.stat-number', {
             textContent: (i: number, el: Element) => el.getAttribute('data-target'),
             duration: 1.5,
             snap: { textContent: 1 },
             ease: "power1.inOut"
           }, "-=0.5");

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="bg-black min-h-screen text-white font-sans selection:bg-white selection:text-black">
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <ThreeViewers />
      <TechSection />
      <FinalCTA />
    </div>
  );
}
