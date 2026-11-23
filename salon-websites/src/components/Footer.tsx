import React from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';
import { SalonWebsite, SalonTenant } from '@/types';

interface FooterProps {
  website: SalonWebsite;
  salon: SalonTenant;
}

export function Footer({ website, salon }: FooterProps) {
  const primaryColor = website.themeColor || '#7c3aed';
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contact" className="bg-slate-950 text-slate-400 text-sm border-t border-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              {website.logoUrl || salon.logoUrl ? (
                <img
                  src={website.logoUrl || salon.logoUrl || ''}
                  alt={website.title}
                  className="w-10 h-10 rounded-xl object-cover bg-white"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {website.title?.charAt(0) || 'S'}
                </div>
              )}
              <h3 className="text-xl font-bold text-white tracking-tight">
                {website.title || salon.name}
              </h3>
            </div>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              {website.tagline ||
                'Delivering premium hair, beauty, and wellness services designed around your unique style.'}
            </p>
          </div>

          {/* Contact Col */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-white font-bold text-sm uppercase tracking-wider">
              Contact & Location
            </h4>
            <div className="space-y-2 text-sm">
              {website.contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <a
                    href={`tel:${website.contactPhone}`}
                    className="hover:text-white transition-colors"
                  >
                    {website.contactPhone}
                  </a>
                </div>
              )}
              {website.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <a
                    href={`mailto:${website.contactEmail}`}
                    className="hover:text-white transition-colors"
                  >
                    {website.contactEmail}
                  </a>
                </div>
              )}
              {website.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span className="text-slate-400">{website.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick links & hours */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-white font-bold text-sm uppercase tracking-wider">
              Working Hours
            </h4>
            <p className="text-sm text-slate-400">Monday &ndash; Saturday: 9:00 AM &ndash; 7:30 PM</p>
            <p className="text-sm text-slate-400">Sunday: 9:00 AM &ndash; 6:00 PM</p>
            <p className="text-xs text-slate-500 pt-2">Holidays: Advance reservation recommended</p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {currentYear} {website.title || salon.name}. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            <span>Powered by</span>
            <span className="text-slate-300 font-medium">Dart Smart Salon SaaS</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

