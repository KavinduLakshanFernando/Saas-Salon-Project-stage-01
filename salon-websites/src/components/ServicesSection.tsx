import React from 'react';
import { Clock, Tag, Scissors } from 'lucide-react';
import { ServiceItem } from '@/types';

interface ServicesSectionProps {
  services: ServiceItem[];
  themeColor: string;
}

export function ServicesSection({ services, themeColor }: ServicesSectionProps) {
  const primaryColor = themeColor || '#7c3aed';

  // Group services by category
  const grouped = services.reduce<Record<string, ServiceItem[]>>((acc, srv) => {
    const cat = srv.categoryName || 'General Services';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(srv);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  return (
    <section id="services" className="py-20 bg-slate-50 border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 mb-3">
            <Scissors className="w-3.5 h-3.5" />
            <span>Service Menu & Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Our Premium Services
          </h2>
          <p className="text-slate-600 mt-3 text-base">
            Carefully curated treatments crafted to enhance your natural beauty and personal style.
          </p>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-500">Service menu is currently being updated. Please check back soon!</p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => (
              <div key={category} className="space-y-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                    {category}
                  </h3>
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-xs font-medium text-slate-400">
                    {grouped[category].length} {grouped[category].length === 1 ? 'service' : 'services'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {grouped[category].map((service) => (
                    <div
                      key={service.id}
                      className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="font-bold text-slate-900 text-lg leading-snug">
                            {service.name}
                          </h4>
                          <span
                            className="font-extrabold text-base shrink-0"
                            style={{ color: primaryColor }}
                          >
                            {service.price > 0 ? `LKR ${service.price.toLocaleString()}` : 'Free'}
                          </span>
                        </div>

                        {service.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {service.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{service.durationMinutes} mins</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                          <Tag className="w-3 h-3" />
                          <span>{service.code}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

