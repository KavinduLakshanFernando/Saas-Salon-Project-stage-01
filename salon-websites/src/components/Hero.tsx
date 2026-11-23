import React from 'react';
import { Calendar, Phone, Sparkles, ShieldCheck, HeartHandshake } from 'lucide-react';
import { SalonWebsite, SalonTenant } from '@/types';

interface HeroProps {
  website: SalonWebsite;
  salon: SalonTenant;
}

export function Hero({ website }: HeroProps) {
  const primaryColor = website.themeColor || '#7c3aed';

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Decorative gradient glow background */}
      <div
        className="absolute top-0 right-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />
      <div
        className="absolute bottom-0 left-10 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Main Hero Copy */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200/80 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-slate-700">Premium Hair, Beauty & Grooming</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              {website.title || 'Welcome to Our Salon'}
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto lg:mx-0">
              {website.tagline ||
                'Experience world-class hair care, styling, and rejuvenating beauty treatments personalized for you.'}
            </p>

            {website.description && (
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
                {website.description}
              </p>
            )}

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <a
                href="#services"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-medium text-base shadow-md hover:shadow-lg transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                <Calendar className="w-5 h-5" />
                <span>View All Services</span>
              </a>

              {website.contactPhone && (
                <a
                  href={`tel:${website.contactPhone}`}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-slate-700 bg-white border border-slate-200 hover:border-slate-300 font-medium text-base shadow-xs hover:bg-slate-50 transition-all"
                >
                  <Phone className="w-5 h-5 text-slate-500" />
                  <span>Call Us Now</span>
                </a>
              )}
            </div>

            {/* Key trust indicators */}
            <div className="pt-8 border-t border-slate-200/60 grid grid-cols-3 gap-4 text-center lg:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-slate-700">100% Hygienic</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-slate-700">Expert Stylists</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-purple-600 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-slate-700">Dedicated Care</span>
              </div>
            </div>
          </div>

          {/* Banner / Visual showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100 flex items-center justify-center relative">
                {website.bannerUrl ? (
                  <img
                    src={website.bannerUrl}
                    alt={website.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full p-8 flex flex-col justify-between"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}30 100%)`,
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {website.title?.charAt(0) || 'S'}
                      </div>
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-xs rounded-full text-xs font-semibold text-slate-700 border border-slate-200">
                        Official Site
                      </span>
                    </div>

                    <div className="space-y-2 bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Open Today
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        Walk-ins & Appointments Welcome
                      </p>
                      <p className="text-xs text-slate-500">
                        Discover tailored care for men and women.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

