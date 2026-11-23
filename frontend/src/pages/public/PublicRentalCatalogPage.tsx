import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Phone,
  Mail,
  Printer,
  Sparkles,
  Share2,
  AlertCircle,
  Clock,
  Layers,
  MapPin,
  Loader2,
  X,
  Maximize2,
} from 'lucide-react';
import { tenantApi, type RentalCatalogItem } from '@/api/tenant.api';
import { formatMoneyLkr } from '@/lib/money';
import { resolveUploadUrl } from '@/lib/upload-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function cleanPhoneForWhatsApp(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '94' + digits.slice(1);
  }
  return digits;
}

export default function PublicRentalCatalogPage() {
  const { shareToken } = useParams<{ shareToken: string }>();

  // Search & category filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Fetch public catalog data
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-rental-catalog', shareToken],
    queryFn: () => {
      if (!shareToken) throw new Error('Catalog token is missing');
      return tenantApi.publicRentals.getCatalog(shareToken);
    },
    enabled: Boolean(shareToken),
    staleTime: 60_000,
  });

  // Filter items by category & search query
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items;

    if (selectedCategory !== 'all') {
      items = items.filter(
        (i) => i.category?.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          (i.color && i.color.toLowerCase().includes(q)) ||
          (i.size && i.size.toLowerCase().includes(q)) ||
          (i.notes && i.notes.toLowerCase().includes(q)),
      );
    }

    return items;
  }, [data?.items, selectedCategory, searchTerm]);

  // Handle WhatsApp enquiry for a specific item
  const handleItemWhatsAppEnquiry = (item: RentalCatalogItem) => {
    const phone = cleanPhoneForWhatsApp(data?.salon?.phone);
    const salonName = data?.salon?.name || 'Salon';
    const message = `Hi ${salonName}! I am interested in renting *${item.name}* (${item.code}). Is it available for my dates?`;

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle General WhatsApp contact
  const handleGeneralWhatsApp = () => {
    const phone = cleanPhoneForWhatsApp(data?.salon?.phone);
    const catalogTitle = data?.catalog?.title || 'Rental Catalog';
    const message = `Hi! I am browsing your *${catalogTitle}* rental catalog and would like to ask some questions.`;

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Print / Save PDF
  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/10 text-purple-600 flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Loading Rental Catalog...</h3>
          <p className="text-xs text-slate-500">Preparing exclusive collection preview</p>
        </div>
      </div>
    );
  }

  // Revoked / Expired / Error state
  if (isError || !data || data.status === 'REVOKED' || data.status === 'EXPIRED') {
    const isRevoked = data?.status === 'REVOKED';
    const isExpired = data?.status === 'EXPIRED';
    const salonPhone = data?.salon?.phone;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            {isExpired ? (
              <Clock className="w-8 h-8" />
            ) : (
              <AlertCircle className="w-8 h-8" />
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isExpired
                ? 'Catalog Link Expired'
                : isRevoked
                ? 'Catalog No Longer Available'
                : 'Catalog Not Found'}
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {data?.message ||
                'This rental catalog link is no longer active. Please contact the salon directly to receive our latest rental collection.'}
            </p>
          </div>

          {salonPhone && (
            <div className="pt-2">
              <Button
                onClick={() => {
                  const p = cleanPhoneForWhatsApp(salonPhone);
                  window.open(
                    `https://wa.me/${p}?text=${encodeURIComponent(
                      'Hi! Could you please share your latest rental collection catalog?',
                    )}`,
                    '_blank',
                  );
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-sm"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Contact Salon on WhatsApp
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { catalog, salon, categories = [] } = data;
  const showPrices = catalog?.showPrices ?? true;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-purple-100 selection:text-purple-900">
      {/* ── Top Announcement / Brand Bar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs print:static print:border-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Salon Branding */}
          <div className="flex items-center gap-3.5 min-w-0">
            {salon?.logoUrl ? (
              <img
                src={resolveUploadUrl(salon.logoUrl) || salon.logoUrl}
                alt={salon.name}
                className="w-11 h-11 rounded-xl object-contain border border-slate-200/80 bg-white p-1 shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-2xs shrink-0">
                {salon?.name?.slice(0, 2).toUpperCase() || 'DS'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate leading-snug">
                {salon?.name || 'Dart Smart Salon'}
              </h1>
              {salon?.branchName && (
                <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{salon.branchName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </Button>

            {salon?.phone && (
              <Button
                size="sm"
                onClick={handleGeneralWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-3.5 text-xs rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">WhatsApp</span> Us
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <section className="bg-linear-to-b from-purple-50/50 via-white to-slate-50 border-b border-slate-200/60 py-8 px-4 sm:px-6 lg:px-8 print:py-4">
        <div className="max-w-7xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rental Collection</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {catalog?.title || 'Exclusive Rental Collection'}
          </h2>

          {catalog?.notes ? (
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {catalog.notes}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
              Browse our curated rental items. Choose your favorite designs and enquire directly on WhatsApp for date availability and fittings.
            </p>
          )}

          {/* Contact Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 font-medium">
            {salon?.phone && (
              <a
                href={`tel:${salon.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-purple-700 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-purple-600" />
                <span>{salon.phone}</span>
              </a>
            )}
            {salon?.email && (
              <a
                href={`mailto:${salon.email}`}
                className="inline-flex items-center gap-1.5 hover:text-purple-700 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-purple-600" />
                <span>{salon.email}</span>
              </a>
            )}
            {salon?.branchAddress && (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{salon.branchAddress}</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Filters & Search Toolbar ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All ({data.items?.length || 0})
              </button>
              {categories.map((cat) => {
                const count = data.items?.filter((i) => i.category === cat).length || 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Input */}
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items, code, color..."
              className="pl-9 h-9 text-xs bg-white rounded-xl border-slate-200 focus:border-purple-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Catalog Items Grid ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 print:pb-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No matching rental items found</h4>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search query or selecting a different category.
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mt-4 text-xs font-semibold"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
            {filteredItems.map((item) => {
              const imgUrl = resolveUploadUrl(item.imageUrl) || item.imageUrl;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group print:border-slate-300 print:shadow-none"
                >
                  {/* Item Image */}
                  <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.name}
                        onClick={() => setLightboxImage({ url: imgUrl, title: item.name })}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-purple-50 text-purple-600">
                        <Sparkles className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                          {item.category}
                        </span>
                      </div>
                    )}

                    {/* Category Tag Overlay */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-slate-800 backdrop-blur-xs shadow-xs">
                        {item.category}
                      </span>
                    </div>

                    {/* Zoom icon if image */}
                    {imgUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxImage({ url: imgUrl, title: item.name })}
                        className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 print:hidden"
                        title="View photo"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Item Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Name & Code */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {item.name}
                        </h3>
                        <span className="font-mono text-[11px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
                          {item.code}
                        </span>
                      </div>

                      {/* Attribute Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {item.size && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            Size: {item.size}
                          </span>
                        )}
                        {item.color && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            Color: {item.color}
                          </span>
                        )}
                      </div>

                      {/* Notes / Description */}
                      {item.notes && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    {/* Price & Action */}
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      {showPrices && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-slate-400 font-medium">Rental Rate:</span>
                          <span className="text-base font-extrabold text-slate-900">
                            {formatMoneyLkr(item.rentPrice || 0)}
                          </span>
                        </div>
                      )}

                      <Button
                        onClick={() => handleItemWhatsAppEnquiry(item)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs rounded-xl shadow-2xs flex items-center justify-center gap-2 print:hidden"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Enquire on WhatsApp</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 text-center space-y-2 text-xs text-slate-500 print:mt-6 print:py-4">
        <p className="font-semibold text-slate-800">{salon?.name || 'Dart Smart Salon'}</p>
        <p>
          Rental reservations and fittings are subject to customer booking dates, terms, and physical inspection.
        </p>
        <p className="text-[11px] text-slate-400 pt-2">
          Powered by Dart Smart Salon SaaS
        </p>
      </footer>

      {/* ── Lightbox Modal for Photo Zoom ── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-transparent flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-h-[82vh] w-auto object-contain rounded-xl shadow-2xl"
            />
            <p className="text-white text-sm font-semibold mt-3 text-center">
              {lightboxImage.title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
