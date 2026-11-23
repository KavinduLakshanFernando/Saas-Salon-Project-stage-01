import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Crown,
  Heart,
  Sparkles,
  Camera,
  Star,
  CheckCircle,
  Gem,
  Mail,
} from 'lucide-react';
import { TemplateProps } from '../types';

export function LuxuryBridalTemplate({ data }: TemplateProps) {
  const { website, salon, branches, featuredServices, content } = data;
  const branding = content?.branding || {};
  const hero = content?.hero || {};
  const about = content?.about || {};
  const contact = content?.contact || {};
  const servicesConfig = content?.servicesConfig || { showPricing: true, showDuration: true };
  const gallery = content?.gallery || [];
  const primaryColor = branding.themeColor || website.themeColor || '#D97706';

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-800 font-serif selection:bg-amber-100 selection:text-amber-900">
      {/* Top Haute Couture Ribbon */}
      <div className="bg-[#1C1917] text-[#D6D3D1] text-xs py-2.5 px-4 border-b border-amber-900/30 font-sans tracking-widest uppercase">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Crown className="w-3.5 h-3.5" />
              <span>Haute Couture Bridal Atelier</span>
            </span>
            {(contact.phone || website.contactPhone) && (
              <a
                href={`tel:${contact.phone || website.contactPhone}`}
                className="hover:text-white transition-colors hidden sm:inline"
              >
                Atelier: {contact.phone || website.contactPhone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 text-stone-400">
            <span>Bespoke Bridal Appointments</span>
          </div>
        </div>
      </div>

      {/* Editorial Luxury Header */}
      <header className="sticky top-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding.logoUrl || website.logoUrl || salon.logoUrl ? (
              <img
                src={branding.logoUrl || website.logoUrl || salon.logoUrl || ''}
                alt={branding.title || website.title}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-300/80 p-0.5 shadow-sm"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-md border-2 border-amber-200"
                style={{ backgroundColor: primaryColor }}
              >
                <Crown className="w-7 h-7 text-amber-200" />
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-normal tracking-wider text-stone-900 uppercase">
                {branding.title || website.title}
              </h1>
              <p className="text-xs text-amber-800 tracking-widest uppercase font-sans font-medium">
                {branding.tagline || 'Bespoke Bridal Dressing & Haute Couture Artistry'}
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-xs font-sans font-semibold uppercase tracking-widest text-stone-700">
            <a href="#packages" className="hover:text-amber-800 transition-colors">
              Bridal Packages
            </a>
            <a href="#services" className="hover:text-amber-800 transition-colors">
              Services
            </a>
            <a href="#about" className="hover:text-amber-800 transition-colors">
              The Atelier
            </a>
            {gallery.length > 0 && (
              <a href="#gallery" className="hover:text-amber-800 transition-colors">
                Mood Board
              </a>
            )}
            <a href="#contact" className="hover:text-amber-800 transition-colors">
              Consultation
            </a>
          </nav>

          <a
            href={`tel:${contact.phone || website.contactPhone || ''}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-sans font-bold uppercase tracking-wider text-white shadow-md hover:opacity-90 transition-all border border-amber-400/40"
            style={{ backgroundColor: primaryColor }}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Consultation</span>
          </a>
        </div>
      </header>

      {/* Asymmetrical Editorial Bridal Hero */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32 bg-gradient-to-b from-[#FAF6F0] via-[#FDFBF7] to-[#FAF6F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-sans font-semibold tracking-widest uppercase bg-amber-50 text-amber-900 border border-amber-200">
                <Gem className="w-3.5 h-3.5 text-amber-600" />
                <span>{hero.badgeText || 'Bridal Couture & Dressing Sanctuary'}</span>
              </div>

              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-normal text-stone-900 leading-[1.08] tracking-tight">
                {hero.headline || branding.title || 'Where Your Wedding Dream Begins'}
              </h2>

              <p className="text-lg sm:text-xl text-stone-600 font-light leading-relaxed max-w-xl mx-auto lg:mx-0">
                {hero.subheadline ||
                  'Bespoke bridal styling, traditional Kandyan & Indian sarees, Western bridal gowns, and timeless makeup crafted exclusively for your magical day.'}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-5 font-sans">
                <a
                  href={hero.ctaLink || '#packages'}
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-white font-bold text-sm uppercase tracking-wider shadow-xl hover:shadow-2xl transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Crown className="w-4 h-4 text-amber-200" />
                  <span>{hero.ctaText || 'View Bridal Packages'}</span>
                </a>

                {(contact.phone || website.contactPhone) && (
                  <a
                    href={`tel:${contact.phone || website.contactPhone}`}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-stone-800 font-bold text-sm uppercase tracking-wider border border-stone-300 shadow-xs hover:border-amber-400 transition-all"
                  >
                    <Phone className="w-4 h-4 text-amber-700" />
                    <span>{hero.secondaryCtaText || 'Book Trial'}</span>
                  </a>
                )}
              </div>

              <div className="pt-8 border-t border-amber-900/10 grid grid-cols-3 gap-6 text-center lg:text-left font-sans text-xs uppercase tracking-wider text-stone-600">
                <div>
                  <p className="text-2xl font-serif text-stone-900 font-normal">500+</p>
                  <p className="text-[11px] text-stone-500 mt-1">Weddings Styled</p>
                </div>
                <div>
                  <p className="text-2xl font-serif text-stone-900 font-normal">100%</p>
                  <p className="text-[11px] text-stone-500 mt-1">Bespoke Fit</p>
                </div>
                <div>
                  <p className="text-2xl font-serif text-stone-900 font-normal">Trial</p>
                  <p className="text-[11px] text-stone-500 mt-1">Guaranteed Prep</p>
                </div>
              </div>
            </div>

            {/* Editorial Portrait Frame */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-sm lg:max-w-none">
                <div className="aspect-[3/4] rounded-3xl overflow-hidden border-8 border-white shadow-2xl bg-stone-100 relative group">
                  {hero.heroImageUrl || branding.bannerUrl || website.bannerUrl ? (
                    <img
                      src={hero.heroImageUrl || branding.bannerUrl || website.bannerUrl || ''}
                      alt={branding.title || website.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full p-8 flex flex-col justify-between bg-gradient-to-tr from-[#292524] to-[#44403C] text-amber-100">
                      <div className="text-center pt-8">
                        <Crown className="w-16 h-16 text-amber-300 mx-auto mb-4 stroke-1" />
                        <h3 className="text-2xl font-normal tracking-widest uppercase">
                          {branding.title || website.title}
                        </h3>
                        <p className="text-xs text-amber-200/80 tracking-widest uppercase font-sans mt-2">
                          Haute Couture Bridal Atelier
                        </p>
                      </div>

                      <div className="bg-black/30 backdrop-blur-md p-5 rounded-2xl border border-amber-300/30 text-center font-sans space-y-1">
                        <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold">
                          Bespoke Consultation
                        </p>
                        <p className="text-xs text-stone-300">
                          Personal styling for Bride, Groom & Retinue.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating Gold Seal */}
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-amber-200/80 hidden sm:flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800">
                    <Star className="w-5 h-5 fill-amber-500 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-sans font-bold text-stone-900 uppercase tracking-wider">
                      Master Stylists
                    </p>
                    <p className="text-[11px] font-sans text-stone-500">Traditional & Modern</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bridal Packages Showcase */}
      <section id="packages" className="py-24 bg-white border-t border-stone-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-sans font-semibold tracking-widest uppercase text-amber-900 bg-amber-50 border border-amber-200 mb-3">
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>Signature Experiences</span>
            </div>
            <h3 className="text-3xl sm:text-5xl font-normal text-stone-900 tracking-tight">
              Bridal Couture Collections
            </h3>
            <p className="text-stone-600 font-light mt-3 text-base">
              Complete bridal transformations designed to make your day completely effortless.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Package 1 */}
            <div className="bg-[#FAF8F5] rounded-3xl p-8 border border-amber-200/70 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-sans font-bold tracking-widest uppercase text-amber-800">
                  Pre-Wedding
                </span>
                <h4 className="text-2xl font-normal text-stone-900">Bridal Trial & Skin Prep</h4>
                <p className="text-xs font-sans text-stone-600 leading-relaxed">
                  Hair styling trials, makeup colour matching, skin glow therapies, and complete look alignment.
                </p>
                <div className="pt-4 border-t border-stone-200/60 space-y-2.5 font-sans text-xs text-stone-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Full makeup & hairstyle trial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hydrating facial & glow therapy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Saree / Veil drape testing</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-stone-200/60 font-sans">
                <span className="text-xs uppercase tracking-wider text-stone-500">Consultation Included</span>
              </div>
            </div>

            {/* Package 2 - Highlighted */}
            <div className="bg-stone-900 text-white rounded-3xl p-8 border-2 border-amber-400 shadow-xl relative flex flex-col justify-between">
              <div className="absolute -top-3.5 right-6 bg-amber-400 text-stone-950 px-3.5 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-widest">
                Most Cherished
              </div>
              <div className="space-y-4">
                <span className="text-xs font-sans font-bold tracking-widest uppercase text-amber-400">
                  The Signature
                </span>
                <h4 className="text-2xl font-normal text-white">Royal Wedding Day Dressing</h4>
                <p className="text-xs font-sans text-stone-300 leading-relaxed">
                  Master artist dressing on wedding morning. Traditional Kandyan, Indian or Western bridal elegance with jewellery placement and retinue care.
                </p>
                <div className="pt-4 border-t border-stone-800 space-y-2.5 font-sans text-xs text-stone-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Master Stylist on-site dressing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Luxury jewellery placement & veil setting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Touch-up kit & emergency assistance</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-stone-800 font-sans">
                <span className="text-xs uppercase tracking-wider text-amber-300">VIP Bridal Suite Care</span>
              </div>
            </div>

            {/* Package 3 */}
            <div className="bg-[#FAF8F5] rounded-3xl p-8 border border-amber-200/70 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-sans font-bold tracking-widest uppercase text-amber-800">
                  Complete Retinue
                </span>
                <h4 className="text-2xl font-normal text-stone-900">Bride & Retinue Ensemble</h4>
                <p className="text-xs font-sans text-stone-600 leading-relaxed">
                  Coordinated styling for the bride, maid of honour, bridesmaids, flower girls, and mothers of bride and groom.
                </p>
                <div className="pt-4 border-t border-stone-200/60 space-y-2.5 font-sans text-xs text-stone-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Coordinated retinue hair & makeup</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Flower girl styling & floral accessories</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Timeline orchestration with photographer</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-stone-200/60 font-sans">
                <span className="text-xs uppercase tracking-wider text-stone-500">Group Packages Available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services List */}
      <section id="services" className="py-20 bg-[#FAF8F5] border-t border-stone-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-3xl sm:text-4xl font-normal text-stone-900">
              Atelier Services & Treatments
            </h3>
            <p className="text-stone-600 font-light mt-2 text-sm font-sans">
              Carefully curated bridal hair, dressing, and skin therapies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
            {featuredServices.map((srv) => (
              <div
                key={srv.id}
                className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h5 className="font-serif text-lg font-normal text-stone-900">{srv.name}</h5>
                    {servicesConfig.showPricing !== false && (
                      <span className="font-bold text-amber-800 text-sm shrink-0">
                        {srv.price > 0 ? `LKR ${srv.price.toLocaleString()}` : 'Bespoke'}
                      </span>
                    )}
                  </div>
                  {srv.description && (
                    <p className="text-xs text-stone-500 mt-2 line-clamp-2">{srv.description}</p>
                  )}
                </div>
                {servicesConfig.showDuration !== false && (
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{srv.durationMinutes} mins</span>
                    </div>
                    <span className="font-mono text-[11px]">{srv.code}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mood Board / Photo Gallery */}
      {gallery.length > 0 && (
        <section id="gallery" className="py-24 bg-white border-t border-stone-200/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-sans font-semibold tracking-widest uppercase text-amber-900 bg-amber-50 border border-amber-200 mb-3">
                <Camera className="w-3.5 h-3.5 text-amber-600" />
                <span>Curated Mood Board</span>
              </div>
              <h3 className="text-3xl sm:text-5xl font-normal text-stone-900 tracking-tight">
                Real Brides & Artistry
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery.map((photo, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] rounded-2xl overflow-hidden border border-amber-200/60 group relative bg-stone-100"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Bridal style'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-end">
                      <p className="text-white text-xs font-sans tracking-wider uppercase">
                        {photo.caption}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Romantic Testimonial Quote Ribbon */}
      <section className="py-20 bg-stone-900 text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 space-y-6">
          <Heart className="w-8 h-8 text-amber-300 mx-auto fill-amber-300/20 stroke-1" />
          <blockquote className="text-2xl sm:text-3xl font-light italic leading-relaxed text-stone-200">
            &ldquo;{about.quote || 'A bride’s walk down the aisle begins with complete confidence.'}&rdquo;
          </blockquote>
          <p className="text-xs font-sans tracking-widest uppercase text-amber-300">
            {branding.title || website.title} Atelier
          </p>
        </div>
      </section>

      {/* Consultation & Contact */}
      <footer id="contact" className="py-20 bg-[#1C1917] text-[#D6D3D1] text-xs font-sans border-t border-amber-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-5 space-y-4">
              <h4 className="text-2xl font-serif font-normal text-white uppercase tracking-wider">
                {branding.title || website.title}
              </h4>
              <p className="text-stone-400 font-light leading-relaxed max-w-sm">
                {branding.description ||
                  'Haute couture bridal artistry and wedding dressing studio. Serving discerning brides with bespoke elegance.'}
              </p>
            </div>
            <div className="md:col-span-4 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-widest text-amber-300">Atelier Inquiries</h5>
              {(contact.phone || website.contactPhone) && (
                <p>Phone: {contact.phone || website.contactPhone}</p>
              )}
              {(contact.email || website.contactEmail) && (
                <p>Email: {contact.email || website.contactEmail}</p>
              )}
              {(contact.address || website.address) && (
                <p>Address: {contact.address || website.address}</p>
              )}
            </div>
            <div className="md:col-span-3 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-widest text-amber-300">Atelier Hours</h5>
              <p>{contact.workingHours || 'By Appointment: Tuesday – Sunday'}</p>
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-stone-500">
            <p>&copy; {new Date().getFullYear()} {branding.title || website.title}. All rights reserved.</p>
            <p>Powered by Dart Smart Salon SaaS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

