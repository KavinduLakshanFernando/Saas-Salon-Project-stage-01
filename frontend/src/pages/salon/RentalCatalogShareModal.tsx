import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Share2,
  Copy,
  Check,
  Send,
  Eye,
  Trash2,
  Phone,
  Mail,
  ExternalLink,
  Ban,
  Layers,
  Tag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  tenantApi,
  type RentalItem,
  type RentalCategoryItem,
  type CatalogSelectionType,
  type RentalCatalogItem,
  type RentalCatalogShareRecord,
} from '@/api/tenant.api';
import { useSalonBranch } from '@/contexts/SalonBranchContext';
import { formatMoneyLkr } from '@/lib/money';
import { appAlert } from '@/lib/app-alerts';
import { resolveUploadUrl } from '@/lib/upload-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RentalCatalogShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RentalCategoryItem[];
  initiallySelectedIds?: string[];
  initialCategory?: string;
  allRentalItems?: RentalItem[];
}

function cleanPhoneForWhatsApp(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '94' + digits.slice(1);
  }
  return digits;
}

export default function RentalCatalogShareModal({
  open,
  onOpenChange,
  categories,
  initiallySelectedIds = [],
  initialCategory,
  allRentalItems = [],
}: RentalCatalogShareModalProps) {
  const queryClient = useQueryClient();
  const { branchId: activeBranchId, selectedBranch } = useSalonBranch();

  // Tab: 'create' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form states
  const [selectionType, setSelectionType] = useState<CatalogSelectionType>(() => {
    if (initiallySelectedIds.length > 0) return 'SELECTED_ITEMS';
    if (initialCategory && initialCategory !== 'all') return 'CATEGORY';
    return 'ALL';
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    if (initialCategory && initialCategory !== 'all') {
      const match = categories.find(
        (c) => c.name.toLowerCase() === initialCategory.toLowerCase(),
      );
      return match ? match.id : 'all';
    }
    return 'all';
  });

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(initiallySelectedIds);
  const [title, setTitle] = useState('Exclusive Rental Collection');
  const [showPrices, setShowPrices] = useState(true);
  const [contactPhone, setContactPhone] = useState(selectedBranch?.phone || '');
  const [contactEmail, setContactEmail] = useState(selectedBranch?.email || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [notes, setNotes] = useState('');

  // Generated share result state
  const [activeShare, setActiveShare] = useState<RentalCatalogShareRecord | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Sync initial selection changes when modal opens
  useEffect(() => {
    if (open) {
      if (initiallySelectedIds.length > 0) {
        setSelectionType('SELECTED_ITEMS');
        setSelectedItemIds(initiallySelectedIds);
        setTitle(`Selected Rentals (${initiallySelectedIds.length} items)`);
      } else if (initialCategory && initialCategory !== 'all') {
        setSelectionType('CATEGORY');
        const match = categories.find(
          (c) => c.name.toLowerCase() === initialCategory.toLowerCase(),
        );
        if (match) setSelectedCategoryId(match.id);
        setTitle(`${initialCategory} Collection`);
      } else {
        setSelectionType('ALL');
        setTitle('Exclusive Rental Collection');
      }
      setContactPhone(selectedBranch?.phone || '');
      setContactEmail(selectedBranch?.email || '');
      setActiveShare(null);
    }
  }, [open, initiallySelectedIds, initialCategory, selectedBranch]);

  // Selected category object
  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Query live preview items
  const previewQuery = useQuery({
    queryKey: [
      'rental-catalog-preview',
      activeBranchId,
      selectionType,
      selectedCategoryId,
      activeCategory?.name,
      selectedItemIds,
    ],
    queryFn: () =>
      tenantApi.rentals.catalogs.preview({
        branchId: activeBranchId && activeBranchId !== 'all' ? activeBranchId : undefined,
        selectionType,
        categoryId:
          selectionType === 'CATEGORY' && selectedCategoryId !== 'all'
            ? selectedCategoryId
            : undefined,
        categoryName:
          selectionType === 'CATEGORY' && activeCategory ? activeCategory.name : undefined,
        selectedItemIds: selectionType === 'SELECTED_ITEMS' ? selectedItemIds : undefined,
      }),
    enabled: open && activeTab === 'create',
  });

  // Query shared catalog history
  const historyQuery = useQuery({
    queryKey: ['rental-catalog-history', activeBranchId],
    queryFn: () =>
      tenantApi.rentals.catalogs.list({
        branchId: activeBranchId && activeBranchId !== 'all' ? activeBranchId : undefined,
        limit: 20,
      }),
    enabled: open && activeTab === 'history',
  });

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: async () => {
      return tenantApi.rentals.catalogs.create({
        title: title.trim() || 'Rental Collection',
        branchId: activeBranchId && activeBranchId !== 'all' ? activeBranchId : undefined,
        selectionType,
        categoryId:
          selectionType === 'CATEGORY' && selectedCategoryId !== 'all'
            ? selectedCategoryId
            : undefined,
        categoryName:
          selectionType === 'CATEGORY' && activeCategory ? activeCategory.name : undefined,
        selectedItemIds: selectionType === 'SELECTED_ITEMS' ? selectedItemIds : undefined,
        showPrices,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        notes: notes.trim() || undefined,
        expiresInDays,
      });
    },
    onSuccess: (share) => {
      setActiveShare(share);
      queryClient.invalidateQueries({ queryKey: ['rental-catalog-history'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to generate catalog link');
    },
  });

  // Revoke share mutation
  const revokeShareMutation = useMutation({
    mutationFn: (id: string) => tenantApi.rentals.catalogs.revoke(id),
    onSuccess: () => {
      toast.success('Shared catalog link has been deactivated');
      queryClient.invalidateQueries({ queryKey: ['rental-catalog-history'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to revoke link');
    },
  });

  // Handle Remove single item from selected items list
  const handleRemoveItem = (itemId: string) => {
    if (selectionType === 'SELECTED_ITEMS') {
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    } else {
      // Switch to custom selected items without this item
      const currentList = previewQuery.data?.items || [];
      const remainingIds = currentList.map((i) => i.id).filter((id) => id !== itemId);
      setSelectionType('SELECTED_ITEMS');
      setSelectedItemIds(remainingIds);
    }
  };

  // Helper: Format WhatsApp sharing message
  const buildWhatsAppMessage = (shareUrl: string, shareTitle: string) => {
    const salonName = selectedBranch?.name ? `${selectedBranch.name}` : 'Dart Smart Salon';
    const cleanPhone = contactPhone.trim();

    return `🌟 *${salonName} — Rental Collection* 🌟\n\n👗 *${shareTitle}*\nBrowse our exclusive rental outfits and jewellery online:\n🔗 ${shareUrl}\n\n${
      cleanPhone ? `📞 For enquiries & date availability: ${cleanPhone}\n` : ''
    }✨ *Dart Smart Salon Rentals*`;
  };

  // Action: Share on WhatsApp
  const handleShareWhatsApp = async () => {
    let share = activeShare;
    if (!share) {
      try {
        share = await createShareMutation.mutateAsync();
      } catch {
        return;
      }
    }

    const shareUrl = share.shareUrl || `${window.location.origin}/rentals/catalog/${share.shareToken}`;
    const message = buildWhatsAppMessage(shareUrl, share.title);
    const phoneParam = cleanPhoneForWhatsApp(customerPhone);

    const waUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    toast.success('Opening WhatsApp with catalog link!');
  };

  // Action: Copy Share Link
  const handleCopyLink = async () => {
    let share = activeShare;
    if (!share) {
      try {
        share = await createShareMutation.mutateAsync();
      } catch {
        return;
      }
    }

    const shareUrl = share.shareUrl || `${window.location.origin}/rentals/catalog/${share.shareToken}`;
    await navigator.clipboard.writeText(shareUrl);
    setHasCopied(true);
    toast.success('Catalog share link copied to clipboard!');
    setTimeout(() => setHasCopied(false), 2500);
  };

  // Action: Open in Browser / Native Share
  const handleNativeShare = async () => {
    let share = activeShare;
    if (!share) {
      try {
        share = await createShareMutation.mutateAsync();
      } catch {
        return;
      }
    }

    const shareUrl = share.shareUrl || `${window.location.origin}/rentals/catalog/${share.shareToken}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: share.title,
          text: `Check out our rental catalog: ${share.title}`,
          url: shareUrl,
        });
        toast.success('Catalog shared successfully!');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          window.open(shareUrl, '_blank');
        }
      }
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const previewItems: RentalCatalogItem[] = previewQuery.data?.items || [];
  const previewTotal = previewQuery.data?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-linear-to-r from-purple-50/60 via-white to-purple-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                <Share2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Share Rental Catalog</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                    WhatsApp & Web
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate professional, customer-ready digital catalogs and share directly via WhatsApp
                </p>
              </div>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'create'
                    ? 'bg-white text-purple-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create & Share
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'history'
                    ? 'bg-white text-purple-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shared History
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab 1: Create & Share */}
        {activeTab === 'create' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Selection Mode */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
                1. Select Catalog Scope
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Option 1: All Categories */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('ALL');
                    setActiveShare(null);
                    setTitle('Exclusive Rental Collection');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectionType === 'ALL'
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">All Categories</span>
                    <Layers
                      className={`w-4 h-4 ${
                        selectionType === 'ALL' ? 'text-purple-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Share complete active collection grouped by category
                  </p>
                </button>

                {/* Option 2: Selected Category */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('CATEGORY');
                    setActiveShare(null);
                    if (categories[0]) {
                      setSelectedCategoryId(categories[0].id);
                      setTitle(`${categories[0].name} Collection`);
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectionType === 'CATEGORY'
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Single Category</span>
                    <Tag
                      className={`w-4 h-4 ${
                        selectionType === 'CATEGORY' ? 'text-purple-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Filter by specific category (e.g. Saree, Jewellery)
                  </p>
                </button>

                {/* Option 3: Selected Items */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('SELECTED_ITEMS');
                    setActiveShare(null);
                    if (selectedItemIds.length === 0 && allRentalItems.length > 0) {
                      setSelectedItemIds([allRentalItems[0].id]);
                    }
                    setTitle(`Curated Rentals (${selectedItemIds.length || 1} items)`);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectionType === 'SELECTED_ITEMS'
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Selected Items</span>
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        selectionType === 'SELECTED_ITEMS' ? 'text-purple-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Share custom hand-picked items ({selectedItemIds.length} currently selected)
                  </p>
                </button>
              </div>

              {/* Category dropdown if CATEGORY chosen */}
              {selectionType === 'CATEGORY' && (
                <div className="mt-3 bg-purple-50/30 p-3.5 rounded-xl border border-purple-100 flex items-center gap-3">
                  <Label className="text-xs font-semibold text-purple-900 shrink-0">
                    Category:
                  </Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={(val) => {
                      setSelectedCategoryId(val);
                      setActiveShare(null);
                      const cat = categories.find((c) => c.id === val);
                      if (cat) setTitle(`${cat.name} Collection`);
                    }}
                  >
                    <SelectTrigger className="w-64 bg-white text-xs border-purple-200">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-xs">
                          {cat.name} ({cat.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Section 2: Catalog Details & Customization */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
                2. Catalog Details & Branding
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Catalog Title *</Label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setActiveShare(null);
                    }}
                    placeholder="e.g. Wedding Season 2026 Collection"
                    className="mt-1 h-9 text-xs bg-white"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">Expiry Duration</Label>
                  <Select
                    value={String(expiresInDays)}
                    onValueChange={(v) => {
                      setExpiresInDays(Number(v));
                      setActiveShare(null);
                    }}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7" className="text-xs">7 Days</SelectItem>
                      <SelectItem value="14" className="text-xs">14 Days</SelectItem>
                      <SelectItem value="30" className="text-xs">30 Days (Recommended)</SelectItem>
                      <SelectItem value="90" className="text-xs">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Salon Contact Phone / WhatsApp</span>
                  </Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => {
                      setContactPhone(e.target.value);
                      setActiveShare(null);
                    }}
                    placeholder="e.g. 0771234567"
                    className="mt-1 h-9 text-xs bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Customers will message this number when clicking "Enquire"
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Salon Contact Email</span>
                  </Label>
                  <Input
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      setActiveShare(null);
                    }}
                    placeholder="e.g. info@salon.lk"
                    className="mt-1 h-9 text-xs bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs font-medium text-slate-700">Optional Notes / Subtitle</Label>
                  <Input
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setActiveShare(null);
                    }}
                    placeholder="e.g. Special festive rates valid until month end"
                    className="mt-1 h-9 text-xs bg-white"
                  />
                </div>

                {/* Price Display Switch */}
                <div className="md:col-span-2 pt-2 border-t border-slate-200/70 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Show Rental Prices</p>
                    <p className="text-[11px] text-slate-500">
                      Toggle ON to display rental rates in LKR; toggle OFF to require customers to enquire for rates
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrices}
                      onChange={(e) => {
                        setShowPrices(e.target.checked);
                        setActiveShare(null);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Customer Phone for Direct WhatsApp */}
                <div className="md:col-span-2 pt-2 border-t border-slate-200/70">
                  <Label className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-purple-600" />
                    <span>Direct Send to Customer WhatsApp (Optional)</span>
                  </Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Enter customer phone (e.g. 0771234567) or leave empty to choose contact in WhatsApp"
                    className="mt-1 h-9 text-xs bg-white border-purple-200 focus:border-purple-600"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Live Items Preview */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Catalog Items Preview
                  </Label>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                    {previewTotal} items
                  </span>
                </div>
                {previewQuery.isFetching && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Updating preview...
                  </span>
                )}
              </div>

              {previewQuery.isLoading ? (
                <div className="p-8 text-center text-slate-400 border border-slate-200 rounded-xl bg-slate-50/50">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                  <p className="text-xs font-medium">Loading catalog items...</p>
                </div>
              ) : previewItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                  <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No active rental items found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Please ensure items are marked ACTIVE and belong to an active category.
                  </p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white shadow-2xs">
                  {previewItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={resolveUploadUrl(item.imageUrl) || item.imageUrl}
                            alt={item.name}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-medium">
                              {item.code}
                            </span>
                            <span>• {item.category}</span>
                            {item.size && <span>• Size: {item.size}</span>}
                            {item.color && <span>• {item.color}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {showPrices ? (
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900">
                              {formatMoneyLkr(item.rentPrice || 0)}
                            </p>
                            <span className="text-[10px] text-slate-400">per rental</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Price Hidden
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove from this catalog share"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generated Share URL Banner if available */}
            {activeShare && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-950 truncate">
                      Catalog Link Active & Ready!
                    </p>
                    <p className="text-xs font-mono text-emerald-700 truncate mt-0.5">
                      {activeShare.shareUrl || `${window.location.origin}/rentals/catalog/${activeShare.shareToken}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="h-8 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy Link
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      const url = activeShare.shareUrl || `${window.location.origin}/rentals/catalog/${activeShare.shareToken}`;
                      window.open(url, '_blank');
                    }}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Open Catalog
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Shared Catalogs History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Shared Catalog Links</h4>
                <p className="text-xs text-slate-500">
                  Active links are accessible to customers. Revoking immediately blocks public access.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => historyQuery.refetch()}
                className="h-8 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Refresh
              </Button>
            </div>

            {historyQuery.isLoading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                <p className="text-xs">Loading shared catalog links...</p>
              </div>
            ) : !historyQuery.data?.data?.length ? (
              <div className="p-12 text-center text-slate-400 border border-dashed rounded-xl bg-slate-50/40">
                <Share2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No shared catalogs yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Generate your first catalog from the "Create & Share" tab.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white shadow-2xs">
                {historyQuery.data.data.map((share: RentalCatalogShareRecord) => {
                  const shareUrl = share.shareUrl || `${window.location.origin}/rentals/catalog/${share.shareToken}`;
                  const isRevoked = share.status === 'REVOKED' || Boolean(share.revokedAt);
                  const isExpired = share.status === 'EXPIRED';

                  return (
                    <div
                      key={share.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {share.title}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isRevoked
                                ? 'bg-red-100 text-red-700'
                                : isExpired
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {share.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                          <span>Scope: {share.selectionType}</span>
                          {share.categoryName && <span>• Cat: {share.categoryName}</span>}
                          <span>
                            • Created:{' '}
                            {new Date(share.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          {share.expiresAt && (
                            <span>
                              • Expires:{' '}
                              {new Date(share.expiresAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                          <span>• Prices: {share.showPrices ? 'Visible' : 'Hidden'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isRevoked && !isExpired && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(shareUrl);
                                toast.success('Link copied to clipboard!');
                              }}
                              className="h-8 text-xs"
                              title="Copy public link"
                            >
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const msg = buildWhatsAppMessage(shareUrl, share.title);
                                window.open(
                                  `https://wa.me/?text=${encodeURIComponent(msg)}`,
                                  '_blank',
                                );
                              }}
                              className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              title="Share on WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              WhatsApp
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(shareUrl, '_blank')}
                              className="h-8 text-xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const res = await appAlert({
                                  title: 'Deactivate Catalog Link?',
                                  text: 'Customers using this link will immediately be blocked from viewing this catalog. Are you sure?',
                                  icon: 'warning',
                                  showCancelButton: true,
                                  confirmButtonText: 'Deactivate',
                                });
                                if (res.isConfirmed) {
                                  revokeShareMutation.mutate(share.id);
                                }
                              }}
                              className="h-8 text-xs text-red-600 hover:bg-red-50"
                              title="Deactivate link"
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer (Action Buttons for Create Tab) */}
        {activeTab === 'create' && (
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {previewTotal > 0 ? (
                <span>
                  Ready to share <strong className="text-slate-800">{previewTotal}</strong> items with customers
                </span>
              ) : (
                <span className="text-amber-600">Select at least one active item to share</span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-10 px-4 text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                disabled={previewTotal === 0 || createShareMutation.isPending}
                className="h-10 px-4 text-xs font-semibold rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Copied Link
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy Link
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNativeShare}
                disabled={previewTotal === 0 || createShareMutation.isPending}
                className="h-10 px-3 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100"
                title="Share via device options"
              >
                <Share2 className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                onClick={handleShareWhatsApp}
                disabled={previewTotal === 0 || createShareMutation.isPending}
                className="h-10 px-5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2"
              >
                {createShareMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 stroke-[2.5]" />
                    Share via WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
