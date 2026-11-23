import React from 'react';
import Link from 'next/link';
import { Phone, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import { SalonWebsite, SalonTenant } from '@/types';

interface HeaderProps {
  website: SalonWebsite;
  salon: SalonTenant;
}

export function Header({ website, salon }: HeaderProps) {
  const isDraft = website.status === 'DRAFT';
  const primaryColor = website.themeColor || '#7c3aed';

  return (
    <>
      {/* Draft banner notice if in draft mode */}
      {isDraft && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-inner">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>This salon website is currently in DRAFT mode and only visible for preview.</span>
        </div>
      )}

      {/* Top micro bar for phone / address */}
      {(website.contactPhone || website.address) && (
        <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
          <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              {website.contactPhone && (
                <a
                  href={`tel:${website.contactPhone}`}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>{website.contactPhone}</span>
                </a>
              )}
              {website.address && (
                <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span className="truncate max-w-xs">{website.address}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Mon - Sun: 9:00 AM - 7:00 PM</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Logo / Brand Name */}
          <Link href="/" className="flex items-center gap-3 group">
            {website.logoUrl || salon.logoUrl ? (
              <img
                src={website.logoUrl || salon.logoUrl || ''}
                alt={website.title}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs group-hover:scale-105 transition-transform"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform"
                style={{ backgroundColor: primaryColor }}
              >
                {website.title?.charAt(0)?.toUpperCase() || 'S'}
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors">
                {website.title || salon.name}
              </h1>
              {website.tagline && (
                <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
                  {website.tagline}
                </p>
              )}
            </div>
          </Link>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
            <a href="#services" className="hover:text-slate-950 transition-colors">
              Services
            </a>
            <a href="#about" className="hover:text-slate-950 transition-colors">
              About
            </a>
            <a href="#branches" className="hover:text-slate-950 transition-colors">
              Branches
            </a>
            <a href="#contact" className="hover:text-slate-950 transition-colors">
              Contact
            </a>
          </nav>

          {/* Action button */}
          <div className="flex items-center gap-3">
            {website.contactPhone ? (
              <a
                href={`tel:${website.contactPhone}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white shadow-sm hover:opacity-95 transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Call Salon</span>
                <span className="sm:hidden">Call</span>
              </a>
            ) : (
              <a
                href="#services"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white shadow-sm hover:opacity-95 transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                <Calendar className="w-4 h-4" />
                <span>Our Services</span>
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

