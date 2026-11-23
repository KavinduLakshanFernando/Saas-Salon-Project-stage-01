import React from 'react';
import { Award, Users, Smile, Sparkles } from 'lucide-react';
import { SalonWebsite, SalonTenant } from '@/types';

interface AboutSectionProps {
  website: SalonWebsite;
  salon: SalonTenant;
}

export function AboutSection({ website, salon }: AboutSectionProps) {
  const primaryColor = website.themeColor || '#7c3aed';

  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200/60">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About Us</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Passionate About Bringing Out Your Best Look
            </h2>

            <p className="text-slate-600 leading-relaxed text-base">
              At <strong className="text-slate-900">{website.title || salon.name}</strong>, we believe that great grooming and styling is an art form. Our salon combines modern beauty techniques with personalized care to ensure every guest leaves feeling renewed, confident, and radiant.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Certified Experts</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Continuous training in contemporary styles and techniques.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Personal Touch</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Custom consultations tailored to your skin and hair type.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-3xl p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-2xl"
                style={{ backgroundColor: primaryColor }}
              />

              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-2">
                  <Smile className="w-6 h-6 text-amber-400" />
                  <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                    Customer Promise
                  </span>
                </div>

                <blockquote className="text-lg sm:text-xl font-medium text-slate-200 italic leading-relaxed">
                  &ldquo;We don&apos;t just cut hair or provide treatments — we build genuine confidence and enduring relationships through our work.&rdquo;
                </blockquote>

                <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-sm">{website.title || salon.name}</p>
                    <p className="text-xs text-slate-400">Official Salon Experience</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Trusted Care
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

