import React from 'react';
import { MapPin, Phone, Mail, Building2, CheckCircle2 } from 'lucide-react';
import { BranchItem, SalonWebsite } from '@/types';

interface BranchesSectionProps {
  branches: BranchItem[];
  website: SalonWebsite;
}

export function BranchesSection({ branches, website }: BranchesSectionProps) {
  const primaryColor = website.themeColor || '#7c3aed';

  return (
    <section id="branches" className="py-20 bg-slate-50 border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 mb-3">
            <Building2 className="w-3.5 h-3.5" />
            <span>Locations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Our Salon Branches
          </h2>
          <p className="text-slate-600 mt-3 text-base">
            Visit any of our convenient locations for your next styling and pampering session.
          </p>
        </div>

        {branches.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 max-w-md mx-auto">
            <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-800">Main Location</p>
            <p className="text-sm text-slate-500 mt-1">
              {website.address || 'Visit us for appointment bookings and consultations.'}
            </p>
            {website.contactPhone && (
              <p className="text-sm font-semibold text-primary mt-2">
                Tel: {website.contactPhone}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold text-slate-900 text-lg">{branch.name}</h3>
                    {branch.isMain && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-xs"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Main Branch
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5 text-sm text-slate-600 mt-4">
                    {branch.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${branch.phone}`}
                          className="hover:underline font-medium text-slate-800"
                        >
                          {branch.phone}
                        </a>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <a
                          href={`mailto:${branch.email}`}
                          className="hover:underline text-xs text-slate-600"
                        >
                          {branch.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Mon - Sun: 9AM - 7PM</span>
                  {branch.phone && (
                    <a
                      href={`tel:${branch.phone}`}
                      className="font-semibold hover:underline"
                      style={{ color: primaryColor }}
                    >
                      Call Branch &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

