import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Leaf,
  Flower2,
  Sparkles,
  Droplets,
  Heart,
  Wind,
  Sun,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import { TemplateProps } from '../types';

export function SpaWellnessTemplate({ data }: TemplateProps) {
  const { website, salon, branches, featuredServices, content } = data;
  const branding = content?.branding || {};
  const hero = content?.hero || {};
  const about = content?.about || {};
  const contact = content?.contact || {};
  const servicesConfig = content?.servicesConfig || { showPricing: true, showDuration: true };
  const gallery = content?.gallery || [];
  const primaryColor = branding.themeColor || website.themeColor || '#059669';

  return (
    <div className="min-h-screen bg-[#FBFDFB] text-emerald-950 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Calm Zen Micro Ribbon */}
      <div className="bg-emerald-950 text-emerald-200 text-xs py-2 px-4 border-b border-emerald-900/40">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <Leaf className="w-3.5 h-3.5" />
              <span>Holistic Wellness & Organic Spa Sanctuary</span>
            </span>
            {(contact.phone || website.contactPhone) && (
              <a
                href={`tel:${contact.phone || website.contactPhone}`}
                className="hover:text-white transition-colors hidden sm:inline"
              >
                Tel: {contact.phone || website.contactPhone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 text-emerald-300/80">
            <span>Natural Botanical Ingredients & Rejuvenating Therapies</span>
          </div>
        </div>
      </div>

      {/* Serene Nature Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-emerald-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl || website.logoUrl || salon.logoUrl ? (
              <img
                src={branding.logoUrl || website.logoUrl || salon.logoUrl || ''}
                alt={branding.title || website.title}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-200 shadow-xs"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                <Leaf className="w-6 h-6 text-emerald-100" />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-950">
                {branding.title || website.title}
              </h1>
              <p className="text-xs text-emerald-700 font-medium">
                {branding.tagline || 'Spa, Ayurveda & Restorative Care'}
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-emerald-900">
            <a href="#rituals" className="hover:text-emerald-600 transition-colors">
              The Journey
            </a>
            <a href="#services" className="hover:text-emerald-600 transition-colors">
              Rituals & Menu
            </a>
            <a href="#about" className="hover:text-emerald-600 transition-colors">
              Sanctuary
            </a>
            {gallery.length > 0 && (
              <a href="#gallery" className="hover:text-emerald-600 transition-colors">
                Ambiance
              </a>
            )}
            <a href="#contact" className="hover:text-emerald-600 transition-colors">
              Contact
            </a>
          </nav>

          <a
            href={`tel:${contact.phone || website.contactPhone || ''}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white shadow-md hover:opacity-95 transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            <Flower2 className="w-4 h-4" />
            <span className="hidden sm:inline">Book Serenity</span>
            <span className="sm:hidden">Book</span>
          </a>
        </div>
      </header>

      {/* Centered Serene Hero */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32 bg-gradient-to-b from-emerald-50/70 via-[#FBFDFB] to-emerald-50/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
            <Flower2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{hero.badgeText || 'Restorative Body, Skin & Mind Rejuvenation'}</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-light text-emerald-950 tracking-tight leading-[1.12]">
            {hero.headline || branding.title || 'Restore Harmony. Reclaim Peace.'}
          </h2>

          <p className="text-lg sm:text-xl text-emerald-800/80 font-normal leading-relaxed max-w-2xl mx-auto">
            {hero.subheadline ||
              'Step into an oasis of tranquility designed to release accumulated stress, replenish your skin, and bring total harmony to your mind and senses.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <a
              href={hero.ctaLink || '#services'}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              <Droplets className="w-5 h-5" />
              <span>{hero.ctaText || 'Explore Spa Rituals'}</span>
            </a>

            {(contact.phone || website.contactPhone) && (
              <a
                href={`tel:${contact.phone || website.contactPhone}`}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-emerald-900 border border-emerald-200 font-semibold text-base shadow-xs hover:bg-emerald-50 transition-all"
              >
                <Phone className="w-5 h-5 text-emerald-600" />
                <span>{hero.secondaryCtaText || 'Inquire Now'}</span>
              </a>
            )}
          </div>

          <div className="pt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
            <div className="p-4 rounded-2xl bg-white/80 border border-emerald-100 shadow-xs flex items-start gap-3">
              <Leaf className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-sm text-emerald-950">100% Botanical</h5>
                <p className="text-xs text-emerald-700 mt-0.5">Organic herbal oils and pure plant extracts.</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-emerald-100 shadow-xs flex items-start gap-3">
              <Wind className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-sm text-emerald-950">Aromatherapy</h5>
                <p className="text-xs text-emerald-700 mt-0.5">Custom therapeutic essential oil blends.</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-emerald-100 shadow-xs flex items-start gap-3">
              <Sun className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-sm text-emerald-950">Certified Therapists</h5>
                <p className="text-xs text-emerald-700 mt-0.5">Masters in ancient healing & modern massage.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Stage Treatment Rituals Journey */}
      <section id="rituals" className="py-24 bg-white border-t border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>The Healing Journey</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-light text-emerald-950 tracking-tight">
              The 4-Stage Sanctuary Ritual
            </h3>
            <p className="text-emerald-700 mt-3 text-base">
              Every appointment is designed as a mindful experience from the moment you step through our doors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-emerald-50/60 border border-emerald-100 relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                01
              </div>
              <h4 className="font-bold text-lg text-emerald-950">Arrival & Herbal Tea</h4>
              <p className="text-xs text-emerald-800/80 leading-relaxed">
                Decompress with warm lemongrass infusions and sensory foot bath soak before your treatment begins.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-50/60 border border-emerald-100 relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                02
              </div>
              <h4 className="font-bold text-lg text-emerald-950">Holistic Consultation</h4>
              <p className="text-xs text-emerald-800/80 leading-relaxed">
                A brief lifestyle and tension analysis to customize pressure levels, aromatherapy scents, and target zones.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-50/60 border border-emerald-100 relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                03
              </div>
              <h4 className="font-bold text-lg text-emerald-950">Therapeutic Treatment</h4>
              <p className="text-xs text-emerald-800/80 leading-relaxed">
                Deep tissue, Swedish, hot stone, or Ayurveda massage paired with botanical facials in private suites.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-50/60 border border-emerald-100 relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                04
              </div>
              <h4 className="font-bold text-lg text-emerald-950">Restorative Awakening</h4>
              <p className="text-xs text-emerald-800/80 leading-relaxed">
                Sound therapy gong awakening, warm towel compress, and relaxation lounge time with dried fruits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Spa Services Menu */}
      <section id="services" className="py-20 bg-emerald-50/40 border-t border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-3xl sm:text-4xl font-light text-emerald-950">
              Spa & Wellness Menu
            </h3>
            <p className="text-emerald-700 mt-2 text-sm">
              Therapeutic treatments, holistic facials, and deep relaxation packages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredServices.map((srv) => (
              <div
                key={srv.id}
                className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h5 className="font-bold text-emerald-950 text-lg">{srv.name}</h5>
                    {servicesConfig.showPricing !== false && (
                      <span className="font-bold text-emerald-700 text-base shrink-0">
                        {srv.price > 0 ? `LKR ${srv.price.toLocaleString()}` : 'Free'}
                      </span>
                    )}
                  </div>
                  {srv.description && (
                    <p className="text-xs text-emerald-800/70 mt-2 line-clamp-2">{srv.description}</p>
                  )}
                </div>

                {servicesConfig.showDuration !== false && (
                  <div className="mt-6 pt-4 border-t border-emerald-50 flex items-center justify-between text-xs text-emerald-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{srv.durationMinutes} mins ritual</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400">{srv.code}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ambiance Gallery if present */}
      {gallery.length > 0 && (
        <section id="gallery" className="py-24 bg-white border-t border-emerald-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 mb-3">
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sanctuary Ambiance</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-emerald-950">
                A Glimpse Into Serenity
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.map((photo, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-3xl overflow-hidden border border-emerald-100 shadow-xs relative group"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Spa atmosphere'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-end">
                      <p className="text-white text-xs">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ethos & Philosophy */}
      <section id="about" className="py-20 bg-emerald-900 text-white text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6 relative z-10">
          <Leaf className="w-8 h-8 text-emerald-300 mx-auto" />
          <h4 className="text-2xl sm:text-3xl font-light">
            &ldquo;{about.quote || 'True wellness begins when mind, body, and spirit align in restorative silence.'}&rdquo;
          </h4>
          <p className="text-xs tracking-widest uppercase text-emerald-300">
            {branding.title || website.title} Sanctuary
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-16 bg-emerald-950 text-emerald-200 text-xs border-t border-emerald-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-3">
              <h5 className="text-xl font-semibold text-white">{branding.title || website.title}</h5>
              <p className="text-emerald-300/80 max-w-sm leading-relaxed">
                {branding.description ||
                  'Your haven of natural healing, organic therapies, and holistic well-being.'}
              </p>
            </div>
            <div className="md:col-span-4 space-y-2">
              <h6 className="font-bold text-white uppercase tracking-wider text-[11px]">Sanctuary Contact</h6>
              {(contact.phone || website.contactPhone) && (
                <p>Tel: {contact.phone || website.contactPhone}</p>
              )}
              {(contact.email || website.contactEmail) && (
                <p>Email: {contact.email || website.contactEmail}</p>
              )}
              {(contact.address || website.address) && (
                <p>Location: {contact.address || website.address}</p>
              )}
            </div>
            <div className="md:col-span-3 space-y-2">
              <h6 className="font-bold text-white uppercase tracking-wider text-[11px]">Visiting Hours</h6>
              <p>{contact.workingHours || 'Monday – Sunday: 9:00 AM – 8:00 PM'}</p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-emerald-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-emerald-400 text-[11px]">
            <p>&copy; {new Date().getFullYear()} {branding.title || website.title}. All rights reserved.</p>
            <p>Powered by Dart Smart Salon SaaS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

