'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Play,
  TrendingUp,
  ShieldCheck,
  X,
  Sparkles,
  Clock,
} from 'lucide-react';

import { Magnet } from '@/components/reactbits/Magnet';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { initGSAP } from '@/components/reactbits/gsapConfig';

const KPI_STATS = [
  { value: '100% Conflict-Free', label: 'Automated Rosters & Payroll', Icon: ShieldCheck },
  { value: '+38% Net Profit', label: 'Average Owner Revenue Growth', Icon: TrendingUp },
  { value: '< 5s Checkout', label: 'Zero Front-Desk Queues', Icon: Clock },
];

export function Hero() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const kpi = KPI_STATS[0];
  const KpiIcon = kpi.Icon;

  useEffect(() => {
    const { gsap } = initGSAP();
    if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(
        '.hero-lead-title',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.hero-brand-title',
        { opacity: 0, y: 32, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.85, delay: 0.12, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.hero-sub-text',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.28, ease: 'power3.out' }
      );
    }
  }, []);

  return (
    <>
      {/* ═══════════════════════════════════
          DYNAMIC KEYFRAME & GLASS STYLES
      ═══════════════════════════════════ */}
      <style>{`


        /* ── HERO IMMUNITY: PRESERVE IDENTICAL STYLES IN DARK MODE ── */
        #hero,
        .dark #hero,
        .dark main #hero {
          color-scheme: light !important;
          color: #0f172a !important;
        }
        .dark main #hero .hero-lead-title,
        .dark #hero .hero-lead-title {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .dark main #hero .hero-sub-text,
        .dark #hero .hero-sub-text {
          color: #475569 !important;
        }
        .dark main #hero .hero-tour-btn,
        .dark #hero .hero-tour-btn {
          color: #1e293b !important;
          background-color: rgba(255, 255, 255, 0.92) !important;
          border-color: rgba(226, 232, 240, 0.9) !important;
        }
        .dark main #hero .hero-glass-card,
        .dark #hero .hero-glass-card {
          background-color: rgba(255, 255, 255, 0.92) !important;
          border-color: rgba(255, 255, 255, 0.95) !important;
        }
        .dark main #hero .hero-card-title,
        .dark #hero .hero-card-title {
          color: #1e293b !important;
        }
      `}</style>

      {/* ═══════════════════════════════════
          HERO SECTION CONTAINER
      ═══════════════════════════════════ */}
      <section
        id="hero"
        aria-label="Dart Smart Salon Management Platform"
        className="relative w-full min-h-[85vh] xl:min-h-[92vh] flex flex-col justify-start xl:justify-center items-start overflow-hidden select-none bg-gradient-to-br from-white via-[#FAF8FF] to-[#E9E4FF]"
        style={{ colorScheme: 'light', color: '#0f172a' }}
      >
        {/* ──── 3D LUXURY BACKGROUND ──── */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Base Silk & Tablet Image */}
          <div className="absolute inset-0">
            <Image
              src="/landing/hero.png"
              alt="Dart Smart Salon Luxury 3D Background"
              fill
              priority
              quality={75}
              className="object-cover object-[68%_center] opacity-100 contrast-[1.03] brightness-[1.02]"
            />
          </div>
        </div>

        {/* Keep the mobile copy readable over the full-bleed photo. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] pointer-events-none sm:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 38%, rgba(255,255,255,0.82) 60%, rgba(255,255,255,0.3) 78%, rgba(255,255,255,0) 100%)',
          }}
        />

        {/* Keep tablet hero copy readable while preserving the salon image on the right. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] pointer-events-none hidden sm:block xl:hidden"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.96) 42%, rgba(255,255,255,0.88) 58%, rgba(255,255,255,0.28) 82%, rgba(255,255,255,0.08) 100%)',
          }}
        />

        {/* ──── FLOATING ORBITAL TRAJECTORY ──── */}
        {/* ──── FLOATING 3D IRIDESCENT SPHERES / PEARLS ──── */}
        {/* ═══════════════════════════════════
            MAIN HERO CENTER CONTENT
        ═══════════════════════════════════ */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-14 sm:pt-24 xl:pt-20 pb-12 sm:pb-16 flex flex-col items-start text-left xl:-translate-y-12">

          {/* Main Title */}
          <h1 className="text-[2.35rem] xs:text-5xl sm:text-[3.25rem] md:text-[3.65rem] xl:text-[4.2rem] 2xl:text-[4.8rem] font-black tracking-tight leading-[1.04] sm:leading-[1.08] max-w-3xl sm:max-w-[34rem] xl:max-w-3xl">
            <span className="hero-lead-title inline-block" style={{ color: '#0f172a' }}>
              Welcome to
            </span>
            <br />
            <span
              className="hero-brand-title inline-block mt-1 sm:mt-2"
              style={{
                background: 'linear-gradient(120deg, #6D28D9 0%, #7C3AED 35%, #9333EA 70%, #A855F7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Dart Smart Salon
            </span>
          </h1>

          {/* Subtitle - Beautifully spaced & balanced */}
          <p
            className="hero-sub-text mt-3 sm:mt-5 text-[15px] sm:text-base md:text-lg xl:text-xl font-normal leading-relaxed max-w-xl sm:max-w-md xl:max-w-xl"
            style={{ color: '#475569' }}
          >
            All-in-one salon management software for bookings, POS, staff commissions,
            and multi-branch analytics.
          </p>

          {/* CTAs with React Bits Magnet */}
          <div className="mt-5 sm:mt-9 flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full sm:w-auto">
            {/* Primary Trial Button */}
            <Magnet strength={0.22} className="w-full sm:w-auto">
              <Link
                href="/pricing"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #9333EA 100%)',
                  boxShadow:
                    '0 12px 35px -5px rgba(124, 58, 237, 0.55), 0 4px 12px rgba(124, 58, 237, 0.3)',
                }}
              >
                <span>Start 21-Day Free Trial</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </Magnet>

            {/* Secondary Product Tour Button */}
            <Magnet strength={0.18} className="w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsDemoModalOpen(true)}
                className="hero-tour-btn group w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-full border px-6 sm:px-7 py-3.5 sm:py-4 text-sm sm:text-base font-bold transition-colors duration-200 hover:shadow-md cursor-pointer"
                style={{
                  color: '#1e293b',
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                }}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/30 group-hover:scale-110 transition-transform">
                  <Play className="size-3 fill-current ml-0.5" />
                </span>
                <span style={{ color: '#1e293b' }}>Watch Product Tour</span>
              </button>
            </Magnet>
          </div>

          {/* KPI Badge with React Bits ShinyText */}
          <div className="mt-5 sm:mt-9">
            <div className="inline-flex w-auto items-center gap-2.5 sm:gap-3.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#181433] border border-violet-500/30 shadow-[0_8px_24px_rgba(24,20,51,0.2)]">
              <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/40">
                <KpiIcon className="size-3.5 sm:size-4" />
              </div>
              <div className="text-left min-w-0 sm:min-w-[190px]">
                <span className="text-[11px] sm:text-sm font-bold text-white block leading-tight">
                  <ShinyText text={kpi.value} className="text-white font-bold" />
                </span>
                <span className="text-[9px] sm:text-[11px] text-violet-300 font-medium block">
                  {kpi.label}
                </span>
              </div>
            </div>
          </div>



        </div>

      </section>

      {/* ═══════════════════════════════════
          INTERACTIVE DEMO MODAL
      ═══════════════════════════════════ */}
      {isDemoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Product Tour Video"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDemoModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#7C3AED]/20 text-[#A78BFA]">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">Dart Smart Salon Product Tour</h3>
                  <p className="text-xs text-slate-400">
                    See how salon owners automate front-desk bookings, POS checkout &amp; commissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDemoModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Video frame */}
            <div className="mt-5 relative w-full aspect-video rounded-2xl bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center group">
              <Image
                src="/landing/hero-marketing-analytics.jpg"
                alt="Product preview"
                fill
                className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-slate-950/50" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="flex size-16 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-xl shadow-violet-600/40 group-hover:scale-110 transition-transform">
                  <Play className="size-6 fill-current ml-1" />
                </div>
                <div className="text-sm font-bold text-white">Full Platform Interactive Walkthrough</div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>21-day trial includes full access to all 10 enterprise modules</span>
              </div>
              <Link
                href="/pricing"
                onClick={() => setIsDemoModalOpen(false)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] hover:bg-[#5B21B6] px-5 py-2.5 text-xs font-bold text-white transition-all shadow-xs"
              >
                <span>Start Free Trial Now</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
