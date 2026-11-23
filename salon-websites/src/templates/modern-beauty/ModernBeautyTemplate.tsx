import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Award,
  ChevronRight,
  ExternalLink,
  Tag,
  Camera,
} from 'lucide-react';
import { TemplateProps } from '../types';

export function ModernBeautyTemplate({ data }: TemplateProps) {
  const { website, salon, branches, featuredServices, content } = data;
  const branding = content?.branding || {};
  const hero = content?.hero || {};
  const about = content?.about || {};
  const contact = content?.contact || {};
  const servicesConfig = content?.servicesConfig || { showPricing: true, showDuration: true };
  const gallery = content?.gallery || [];
  const primaryColor = branding.themeColor || website.themeColor || '#7C3AED';

  // Group services by category
  const groupedServices = (featuredServices || []).reduce<Record<string, typeof featuredServices>>(
    (acc, srv) => {
      const cat = srv.categoryName || 'General Services';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(srv);
      return acc;
    },
    {},
  );

  const categories = Object.keys(groupedServices);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Top micro bar */}
      {(contact.phone || contact.address || website.contactPhone) && (
        <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
          <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              {(contact.phone || website.contactPhone) && (
                <a
                  href={`tel:${contact.phone || website.contactPhone}`}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-purple-400" />
                  <span>{contact.phone || website.contactPhone}</span>
                </a>
              )}
              {(contact.address || website.address) && (
                <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span className="truncate max-w-sm">{contact.address || website.address}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>{contact.workingHours || 'Mon - Sun: 9:00 AM - 7:30 PM'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modern Chic Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl || website.logoUrl || salon.logoUrl ? (
              <img
                src={branding.logoUrl || website.logoUrl || salon.logoUrl || ''}
                alt={branding.title || website.title}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {(branding.title || website.title)?.charAt(0) || 'M'}
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                {branding.title || website.title}
              </h1>
              {(branding.tagline || website.tagline) && (
                <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
                  {branding.tagline || website.tagline}
                </p>
              )}
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-700">
            <a href="#services" className="hover:text-purple-600 transition-colors">
              Services
            </a>
            <a href="#about" className="hover:text-purple-600 transition-colors">
              About
            </a>
            {gallery.length > 0 && (
              <a href="#gallery" className="hover:text-purple-600 transition-colors">
                Gallery
              </a>
            )}
            <a href="#branches" className="hover:text-purple-600 transition-colors">
              Branches
            </a>
            <a href="#contact" className="hover:text-purple-600 transition-colors">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={`tel:${contact.phone || website.contactPhone || ''}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-md hover:opacity-95 transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Book Appointment</span>
              <span className="sm:hidden">Book</span>
            </a>
          </div>
        </div>
      </header>

      {/* Bold Energetic Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-purple-50/50 via-white to-slate-50">
        <div
          className="absolute -top-24 right-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ backgroundColor: primaryColor }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-purple-200 shadow-xs">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-slate-800">
                  {hero.badgeText || 'Modern Hair & Beauty Studio'}
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                {hero.headline || branding.title || website.title}
              </h2>

              <p className="text-lg sm:text-xl text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
                {hero.subheadline || branding.tagline || website.tagline}
              </p>

              {branding.description && (
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {branding.description}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <a
                  href={hero.ctaLink || '#services'}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Calendar className="w-5 h-5" />
                  <span>{hero.ctaText || 'View Service Menu'}</span>
                </a>

                {(contact.phone || website.contactPhone) && (
                  <a
                    href={`tel:${contact.phone || website.contactPhone}`}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-slate-800 bg-white border border-slate-200 hover:border-slate-300 font-bold text-base shadow-xs hover:bg-slate-50 transition-all"
                  >
                    <Phone className="w-5 h-5 text-slate-500" />
                    <span>{hero.secondaryCtaText || 'Call Us'}</span>
                  </a>
                )}
              </div>

              <div className="pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-center lg:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-800">100% Sterile</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-800">Top Stylists</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <Scissors className="w-5 h-5 text-purple-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-800">Custom Cuts</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden border border-slate-200/80 shadow-2xl bg-slate-100 relative group">
                {hero.heroImageUrl || branding.bannerUrl || website.bannerUrl ? (
                  <img
                    src={hero.heroImageUrl || branding.bannerUrl || website.bannerUrl || ''}
                    alt={branding.title || website.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div
                    className="w-full h-full p-8 flex flex-col justify-between"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}35 100%)`,
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(branding.title || website.title)?.charAt(0) || 'M'}
                      </div>
                      <span className="px-3 py-1 bg-white/95 rounded-full text-xs font-bold text-purple-700 border border-purple-200 shadow-xs">
                        Modern Chic Studio
                      </span>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Open Today
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Appointments & Walk-ins welcome for hair, styling, and color treatments.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Menu Section */}
      <section id="services" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 mb-3">
              <Scissors className="w-3.5 h-3.5" />
              <span>Service Menu & Pricing</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Signature Treatments & Styling
            </h3>
            <p className="text-slate-600 mt-3 text-base">
              Crafted with high-performance formulas and personalized technique.
            </p>
          </div>

          {featuredServices.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-slate-500">Service menu is currently being updated. Contact salon for details.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {categories.map((category) => (
                <div key={category} className="space-y-6">
                  <div className="flex items-center gap-3">
                    <h4 className="text-xl font-bold text-slate-900 tracking-tight">{category}</h4>
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-xs font-semibold text-slate-400">
                      {groupedServices[category].length} services
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupedServices[category].map((service) => (
                      <div
                        key={service.id}
                        className="bg-slate-50/70 hover:bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-purple-200 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <h5 className="font-bold text-slate-900 text-lg leading-snug">
                              {service.name}
                            </h5>
                            {servicesConfig.showPricing !== false && (
                              <span
                                className="font-black text-base shrink-0"
                                style={{ color: primaryColor }}
                              >
                                {service.price > 0 ? `LKR ${service.price.toLocaleString()}` : 'Free'}
                              </span>
                            )}
                          </div>
                          {service.description && (
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {service.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                          {servicesConfig.showDuration !== false && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{service.durationMinutes} mins</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
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

      {/* About & Trust Section */}
      <section id="about" className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-purple-700 bg-purple-100/70 border border-purple-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Our Story</span>
              </div>

              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {about.heading || 'Dedicated to Your Style and Beauty'}
              </h3>

              <p className="text-slate-600 leading-relaxed text-base">
                {about.story ||
                  `At ${branding.title || website.title}, great hair and styling is an empowering experience. We bring together modern beauty trends with personalized consultation so you look and feel your absolute best.`}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {(about.highlights || [
                  { title: 'Certified Stylists', description: 'Continuous advanced education.' },
                  { title: 'Personal Consultation', description: 'Customized advice for every hair type.' },
                ]).map((hl, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                    <h5 className="font-bold text-slate-900 text-sm">{hl.title}</h5>
                    <p className="text-xs text-slate-500 mt-1">{hl.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-xl relative overflow-hidden space-y-6">
                <div
                  className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: primaryColor }}
                />
                <h4 className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                  Our Philosophy
                </h4>
                <blockquote className="text-lg sm:text-xl font-medium text-slate-200 italic leading-relaxed">
                  &ldquo;{about.quote || 'We dont just cut hair — we craft confidence and genuine smiles.'}&rdquo;
                </blockquote>
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>{branding.title || website.title}</span>
                  <span className="text-purple-400 font-semibold">Excellence in Styling</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Gallery if present */}
      {gallery.length > 0 && (
        <section id="gallery" className="py-20 bg-white border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 mb-3">
                <Camera className="w-3.5 h-3.5" />
                <span>Our Work</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Styles & Transformations
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery.map((photo, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl overflow-hidden border border-slate-200 group relative bg-slate-100"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Salon transformation'}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex items-end">
                      <p className="text-white text-xs font-medium">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Branches Section */}
      <section id="branches" className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Salon Locations
            </h3>
            <p className="text-slate-600 mt-2 text-sm">
              Visit us at our conveniently located branches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-bold text-slate-900 text-lg">{b.name}</h5>
                    {b.isMain && (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Main Branch
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-slate-600 mt-4">
                    {b.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{b.address}</span>
                      </div>
                    )}
                    {b.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <a href={`tel:${b.phone}`} className="font-semibold text-slate-900 hover:underline">
                          {b.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{contact.workingHours || 'Mon - Sun: 9AM - 7:30PM'}</span>
                  {b.phone && (
                    <a
                      href={`tel:${b.phone}`}
                      className="font-bold hover:underline"
                      style={{ color: primaryColor }}
                    >
                      Call Now &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-950 text-slate-400 text-sm border-t border-slate-900 py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-4">
              <h4 className="text-xl font-black text-white">{branding.title || website.title}</h4>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                {branding.tagline || website.tagline || 'Modern hair styling and exceptional beauty care.'}
              </p>
            </div>
            <div className="md:col-span-4 space-y-2 text-sm">
              <h5 className="font-bold text-white uppercase tracking-wider text-xs">Contact Us</h5>
              {(contact.phone || website.contactPhone) && (
                <p>Tel: {contact.phone || website.contactPhone}</p>
              )}
              {(contact.email || website.contactEmail) && (
                <p>Email: {contact.email || website.contactEmail}</p>
              )}
              {(contact.address || website.address) && (
                <p>Address: {contact.address || website.address}</p>
              )}
            </div>
            <div className="md:col-span-3 space-y-2 text-sm">
              <h5 className="font-bold text-white uppercase tracking-wider text-xs">Hours</h5>
              <p>{contact.workingHours || 'Monday – Sunday: 9:00 AM – 7:30 PM'}</p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} {branding.title || website.title}. All rights reserved.</p>
            <p className="text-slate-400">Powered by Dart Smart Salon SaaS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

