import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Shirt,
  Wrench,
  CheckCircle2,
  Clock,
  Pencil,
  PowerOff,
  Power,
  RefreshCw,
  X,
  Eye,
  Building2,
  Layers,
  Info,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import RentalCatalogShareModal from './RentalCatalogShareModal';
import {
  tenantApi,
  type RentalItem,
  type RentalUnit,
  type UpdateRentalItemPayload,
  type RentalCategory,
} from '@/api/tenant.api';
import { useSalonBranch } from '@/contexts/SalonBranchContext';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { formatMoneyLkr, formatMoneyAmount } from '@/lib/money';
import { appAlert } from '@/lib/app-alerts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OpsLoading, OpsPagination, getErrorMessage } from './salon-ops-ui';

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const DEFAULT_CATEGORIES: string[] = [
  'Saree',
  'Frock',
  'Jewellery',
  'Veil',
  'Crown',
  'Jacket',
  'Accessory',
  'Other',
];

interface ItemFormData {
  name: string;
  category: RentalCategory;
  branchId: string;
  rentPrice: string;
  deposit: string;
  quantity: string;
  size: string;
  color: string;
  code: string;
  useCustomCode: boolean;
  notes: string;
  imageUrl: string;
}

const initialFormData: ItemFormData = {
  name: '',
  category: 'Saree',
  branchId: '',
  rentPrice: '',
  deposit: '',
  quantity: '1',
  size: '',
  color: '',
  code: '',
  useCustomCode: false,
  notes: '',
  imageUrl: '',
};

export default function RentalItemsPage() {
  const queryClient = useQueryClient();
  const { branchId: activeBranchId, branches, activeBranches, isAllBranches } = useSalonBranch();

  // Dynamic categories from database
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['rental-categories-active'],
    queryFn: () => tenantApi.rentals.listCategories({ status: 'ACTIVE' }),
  });

  const categoryOptions = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.map((c) => c.name);
    }
    return DEFAULT_CATEGORIES;
  }, [dbCategories]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search, 350, 1);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RentalItem | null>(null);
  const [formData, setFormData] = useState<ItemFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Review details modal state
  const [reviewingItem, setReviewingItem] = useState<RentalItem | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Physical units modal
  const [inspectingItem, setInspectingItem] = useState<RentalItem | null>(null);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [isAddUnitsOpen, setIsAddUnitsOpen] = useState(false);
  const [addUnitsCount, setAddUnitsCount] = useState('1');
  const [addUnitsNotes, setAddUnitsNotes] = useState('');

  // Editing individual unit note
  const [editingUnitNote, setEditingUnitNote] = useState<RentalUnit | null>(null);

  // Rental catalog sharing & item selection state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCatalogShareOpen, setIsCatalogShareOpen] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };
  const [unitNoteText, setUnitNoteText] = useState('');

  // Resolved branch filter (context branch takes precedence if single branch selected)
  const effectiveBranchFilter = !isAllBranches ? activeBranchId : filterBranchId;

  // Reset pagination when branch or filters change
  useEffect(() => {
    setPage(1);
  }, [effectiveBranchFilter, selectedCategory, selectedStatus, debouncedSearch]);

  // Query: Rental Items list
  const {
    data: itemsResponse,
    isLoading,
  } = useQuery({
    queryKey: ['rental-items', page, debouncedSearch, selectedCategory, selectedStatus, effectiveBranchFilter],
    queryFn: () =>
      tenantApi.rentals.listItems({
        page,
        limit,
        search: debouncedSearch.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        branchId: effectiveBranchFilter !== 'all' ? effectiveBranchFilter : undefined,
      }),
  });

  const items = itemsResponse?.data || [];
  const meta = itemsResponse?.meta;

  // Query: Code suggestion for new items
  const { data: codeSuggestion, refetch: refetchCode } = useQuery({
    queryKey: ['suggested-rental-code'],
    queryFn: tenantApi.rentals.suggestCode,
    enabled: isFormOpen && !editingItem,
  });

  // Query: Full details of inspecting item (with units)
  const {
    data: fullInspectingItem,
    isLoading: isLoadingUnits,
  } = useQuery({
    queryKey: ['rental-item-detail', inspectingItem?.id],
    queryFn: () => tenantApi.rentals.getItem(inspectingItem!.id),
    enabled: Boolean(inspectingItem?.id && isUnitsModalOpen),
  });

  // Query: Full details of reviewing item (with units)
  const {
    data: fullReviewItem,
    isLoading: isLoadingReview,
  } = useQuery({
    queryKey: ['rental-item-detail', reviewingItem?.id],
    queryFn: () => tenantApi.rentals.getItem(reviewingItem!.id),
    enabled: Boolean(reviewingItem?.id && isReviewOpen),
  });

  // Calculate quick summary metrics
  const summaryMetrics = useMemo(() => {
    let totalItems = meta?.total ?? items.length;
    let totalCopies = 0;
    let availableCopies = 0;
    let attentionCopies = 0; // maintenance

    items.forEach((item) => {
      totalCopies += item.totalUnits || 0;
      // Only count available units for active items to avoid misleading staff
      if (item.status === 'ACTIVE') {
        availableCopies += item.availableUnits || 0;
      }
      attentionCopies += item.maintenanceUnits || 0;
    });

    return { totalItems, totalCopies, availableCopies, attentionCopies };
  }, [items, meta]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: tenantApi.rentals.createItem,
    onSuccess: (res) => {
      toast.success('Rental item created successfully', {
        description: `Created item ${res.code} with ${res.unitsCount} physical copies ready to rent.`,
      });
      queryClient.invalidateQueries({ queryKey: ['rental-items'] });
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error('Failed to create rental item', {
        description: getErrorMessage(err),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRentalItemPayload }) =>
      tenantApi.rentals.updateItem(id, data),
    onSuccess: () => {
      toast.success('Rental item updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rental-items'] });
      if (inspectingItem) {
        queryClient.invalidateQueries({ queryKey: ['rental-item-detail', inspectingItem.id] });
      }
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error('Failed to update rental item', {
        description: getErrorMessage(err),
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      tenantApi.rentals.updateItemStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === 'ACTIVE'
          ? 'Rental item activated'
          : 'Rental item deactivated',
      );
      queryClient.invalidateQueries({ queryKey: ['rental-items'] });
    },
    onError: (err) => {
      toast.error('Failed to change status', {
        description: getErrorMessage(err),
      });
    },
  });

  const addUnitsMutation = useMutation({
    mutationFn: ({ itemId, quantity, notes }: { itemId: string; quantity: number; notes?: string }) =>
      tenantApi.rentals.addUnits(itemId, { quantity, notes }),
    onSuccess: (res) => {
      toast.success('Added new physical copies', {
        description: `Added ${res.addedCount} new unit(s) to this item.`,
      });
      queryClient.invalidateQueries({ queryKey: ['rental-items'] });
      queryClient.invalidateQueries({ queryKey: ['rental-item-detail', inspectingItem?.id] });
      setIsAddUnitsOpen(false);
      setAddUnitsCount('1');
      setAddUnitsNotes('');
    },
    onError: (err) => {
      toast.error('Failed to add copies', {
        description: getErrorMessage(err),
      });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({
      unitId,
      status,
      notes,
    }: {
      unitId: string;
      status?: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE' | 'INACTIVE';
      notes?: string;
    }) => tenantApi.rentals.updateUnit(unitId, { status, notes }),
    onSuccess: (res) => {
      toast.success(`Unit ${res.unitCode} updated`, {
        description: `Status is now ${formatUnitStatus(res.status)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['rental-items'] });
      queryClient.invalidateQueries({ queryKey: ['rental-item-detail', inspectingItem?.id] });
      setEditingUnitNote(null);
    },
    onError: (err) => {
      toast.error('Status update failed', {
        description: getErrorMessage(err),
      });
    },
  });

  // Reset form
  const resetForm = () => {
    setEditingItem(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  // Open Create Dialog
  const handleOpenCreate = () => {
    resetForm();
    const defaultBranch =
      !isAllBranches && activeBranchId
        ? activeBranchId
        : activeBranches[0]?.id || branches[0]?.id || '';

    setFormData({
      ...initialFormData,
      branchId: defaultBranch,
      code: codeSuggestion?.code || '',
    });
    refetchCode();
    setIsFormOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (item: RentalItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      branchId: item.branchId,
      rentPrice: String(item.rentPrice),
      deposit: item.deposit ? String(item.deposit) : '0',
      quantity: String(item.totalUnits || 1),
      size: item.size || '',
      color: item.color || '',
      code: item.code,
      useCustomCode: false,
      notes: item.notes || '',
      imageUrl: item.imageUrl || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // Open Review Details Modal
  const handleOpenReview = (item: RentalItem) => {
    setReviewingItem(item);
    setIsReviewOpen(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Please enter an item name (e.g. Kandyan Bridal Saree Red)';
    }

    if (!formData.branchId) {
      errors.branchId = 'Please select a salon branch';
    }

    const rentPriceNum = Number(formData.rentPrice);
    if (formData.rentPrice === '' || isNaN(rentPriceNum) || rentPriceNum < 0) {
      errors.rentPrice = 'Please enter a valid rental price (must be 0 or higher)';
    }

    if (formData.deposit !== '') {
      const depositNum = Number(formData.deposit);
      if (isNaN(depositNum) || depositNum < 0) {
        errors.deposit = 'Deposit must be 0 or higher';
      }
    }

    if (!editingItem) {
      const qtyNum = parseInt(formData.quantity, 10);
      if (!formData.quantity || isNaN(qtyNum) || qtyNum < 1) {
        errors.quantity = 'Must have at least 1 physical unit';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create / Edit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          name: formData.name.trim(),
          category: formData.category,
          branchId: formData.branchId,
          rentPrice: Number(formData.rentPrice),
          deposit: editingItem.deposit ?? 0,
          size: formData.size.trim() || undefined,
          color: formData.color.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          imageUrl: formData.imageUrl.trim() || undefined,
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        category: formData.category,
        branchId: formData.branchId,
        rentPrice: Number(formData.rentPrice),
        deposit: formData.deposit ? Number(formData.deposit) : 0,
        quantity: parseInt(formData.quantity, 10),
        code: formData.useCustomCode && formData.code.trim() ? formData.code.trim() : undefined,
        size: formData.size.trim() || undefined,
        color: formData.color.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
      });
    }
  };

  // Toggle item status (Deactivate / Activate)
  const handleToggleStatus = (item: RentalItem) => {
    const isActivating = item.status === 'INACTIVE';
    const actionText = isActivating ? 'Activate' : 'Deactivate';

    appAlert({
      title: `${actionText} ${item.name}?`,
      text: isActivating
        ? 'This item will be active again for rental operations. Previously set unit physical conditions are preserved.'
        : 'Deactivating hides this item from active rental bookings while safely preserving all copies and unit records.',
      icon: isActivating ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionText}`,
      confirmButtonColor: isActivating ? '#10b981' : '#ef4444',
      cancelButtonText: 'Cancel',
    }).then((res) => {
      if (res.isConfirmed) {
        statusMutation.mutate({
          id: item.id,
          status: isActivating ? 'ACTIVE' : 'INACTIVE',
        });
      }
    });
  };

  // Open physical copies modal
  const handleOpenUnitsModal = (item: RentalItem) => {
    setInspectingItem(item);
    setIsUnitsModalOpen(true);
  };

  // Friendly status formatter for units
  function formatUnitStatus(status: string) {
    switch (status) {
      case 'AVAILABLE':
        return 'Available';
      case 'RESERVED':
        return 'Reserved for Booking';
      case 'RENTED':
        return 'With Customer';
      case 'CLEANING':
        return 'Under Cleaning';
      case 'MAINTENANCE':
        return 'Under Maintenance';
      case 'INACTIVE':
        return 'Retired / Damaged';
      default:
        return status;
    }
  }

  // Friendly badge styling for unit status
  function getUnitStatusBadge(status: string) {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available
          </span>
        );
      case 'CLEANING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
            <Clock className="w-3 h-3 text-sky-500" />
            Under Cleaning
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
            <Wrench className="w-3 h-3 text-amber-500" />
            Under Maintenance
          </span>
        );
      case 'RESERVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25/60">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/100" />
            Reserved
          </span>
        );
      case 'RENTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <Shirt className="w-3 h-3 text-indigo-500" />
            With Customer
          </span>
        );
      case 'INACTIVE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Retired / Damaged
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rental Items</h1>
              <p className="text-sm text-slate-500">
                Manage your rental collection, rental pricing, and individual physical copies.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsCatalogShareOpen(true)}
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 font-semibold shadow-xs flex items-center gap-2 h-10 px-4 rounded-xl transition-all"
          >
            <Share2 className="w-4 h-4 stroke-[2.2]" />
            <span>Share Catalog</span>
            {selectedItemIds.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-purple-600 text-white rounded-full">
                {selectedItemIds.length}
              </span>
            )}
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm flex items-center gap-2 h-10 px-4 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Rental Item</span>
          </Button>
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Rental Catalog</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summaryMetrics.totalItems}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total unique designs</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Total Physical Copies</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summaryMetrics.totalCopies}</p>
          <p className="text-xs text-slate-400 mt-0.5">All units in inventory</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700">Available to Rent</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{summaryMetrics.availableCopies}</p>
          <p className="text-xs text-emerald-600/80 mt-0.5">Ready for immediate booking</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700">Under Maintenance</p>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-800 mt-1">{summaryMetrics.attentionCopies}</p>
          <p className="text-xs text-amber-600/80 mt-0.5">Physical copies in repair</p>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by name, code (e.g. RENT-0001), tag, color, or size..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-lg border-slate-200 text-sm focus-visible:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-44">
            <Select
              value={selectedCategory}
              onValueChange={(val) => {
                setSelectedCategory(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-lg text-sm bg-white">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Dropdown */}
          <div className="w-full md:w-36">
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                setSelectedStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-lg text-sm bg-white">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Branch Dropdown (only when All Branches is selected in header and multiple branches exist) */}
          {isAllBranches && branches.length > 1 && (
            <div className="w-full md:w-48">
              <Select
                value={filterBranchId}
                onValueChange={(val) => {
                  setFilterBranchId(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 rounded-lg text-sm bg-white">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reset Filters */}
          {(search || selectedCategory !== 'all' || selectedStatus !== 'all' || (isAllBranches && filterBranchId !== 'all')) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setFilterBranchId('all');
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 shrink-0"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* ── Table & Cards Listing ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20">
            <OpsLoading />
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3.5">
              <Shirt className="w-8 h-8 stroke-[1.75]" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {search || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'No rental items match your filters'
                : 'No rental items added yet'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              {search || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'Try clearing your search terms or selecting another category.'
                : 'Add sarees, bridal frocks, jewellery sets, and accessories to start managing rentals and copies.'}
            </p>
            {search || selectedCategory !== 'all' || selectedStatus !== 'all' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setFilterBranchId('all');
                }}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                onClick={handleOpenCreate}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Your First Item
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* 1. Mobile Cards View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer shrink-0 mt-0.5"
                        title="Select for catalog"
                      />
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          onClick={() => handleOpenReview(item)}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => handleOpenReview(item)}
                          className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer hover:bg-primary/10 transition-colors"
                        >
                          {item.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(item)}
                          className="font-semibold text-slate-900 text-sm truncate text-left block hover:text-primary hover:underline transition-colors"
                          title="Click to review full details"
                        >
                          {item.name}
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                            {item.code}
                          </span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {item.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Branch details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Rent Price</span>
                      <span className="font-semibold text-slate-900">{formatMoneyLkr(item.rentPrice)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Deposit</span>
                      <span className="text-slate-700 font-medium">
                        {item.deposit > 0 ? formatMoneyLkr(item.deposit) : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Copies</span>
                      <span className="font-semibold text-slate-900">
                        {item.totalUnits} {item.totalUnits === 1 ? 'copy' : 'copies'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Availability</span>
                      {item.status === 'ACTIVE' ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          {item.availableUnits} available
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Item Inactive</span>
                      )}
                    </div>
                  </div>

                  {/* Specs if present */}
                  {(item.color || item.size || item.branchName) && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      {item.branchName && (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {item.branchName}
                        </span>
                      )}
                      {item.color && <span>· Color: {item.color}</span>}
                      {item.size && <span>· Size: {item.size}</span>}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReview(item)}
                      className="h-8 flex-1 text-xs font-medium text-slate-700 hover:text-primary border-slate-200"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-primary" />
                      <span>Review</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenUnitsModal(item)}
                      className="h-8 flex-1 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1" />
                      <span>Copies ({item.totalUnits})</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(item)}
                      className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-50"
                      title="Edit item details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(item)}
                      className={`h-8 px-2 text-xs ${
                        item.status === 'ACTIVE'
                          ? 'text-slate-400 hover:text-amber-600'
                          : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                      title={item.status === 'ACTIVE' ? 'Deactivate item' : 'Activate item'}
                    >
                      {item.status === 'ACTIVE' ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop & Tablet Data Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((i) => selectedItemIds.includes(i.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIds(Array.from(new Set([...selectedItemIds, ...items.map((i) => i.id)])));
                          } else {
                            const pageIds = new Set(items.map((i) => i.id));
                            setSelectedItemIds(selectedItemIds.filter((id) => !pageIds.has(id)));
                          }
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        title="Select all on this page"
                      />
                    </th>
                    <th className="py-3.5 px-4">Rental Item</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Rent Price (LKR)</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Refundable Deposit (LKR)</th>
                    <th className="py-3.5 px-4">Copies & Availability</th>
                    <th className="py-3.5 px-4">Branch</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          title="Select item for catalog"
                        />
                      </td>
                      {/* Item Name & Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              onClick={() => handleOpenReview(item)}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity shadow-2xs"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              onClick={() => handleOpenReview(item)}
                              className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer hover:bg-primary/10 transition-colors"
                              title="Click to review full details"
                            >
                              {item.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenReview(item)}
                              className="font-semibold text-slate-900 truncate block text-left hover:text-primary hover:underline transition-colors"
                              title="Click to review full item details"
                            >
                              {item.name}
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.2 rounded font-medium">
                                {item.code}
                              </span>
                              {item.color && (
                                <span className="text-xs text-slate-500">· {item.color}</span>
                              )}
                              {item.size && (
                                <span className="text-xs text-slate-500">· Size {item.size}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Rent Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-900">{formatMoneyAmount(item.rentPrice)}</p>
                        <p className="text-[11px] text-slate-400">per rental</p>
                      </td>

                      {/* Deposit */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.deposit > 0 ? (
                          <p className="text-slate-700 font-medium">{formatMoneyAmount(item.deposit)}</p>
                        ) : (
                          <span className="text-xs text-slate-400">No deposit</span>
                        )}
                      </td>

                      {/* Copies & Availability */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {item.totalUnits} {item.totalUnits === 1 ? 'copy' : 'copies'}
                            </span>
                            {item.status === 'ACTIVE' ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                {item.availableUnits} available
                              </span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                Item Inactive
                              </span>
                            )}
                          </div>

                          {/* Unit state breakdown if any are not available */}
                          {(item.cleaningUnits > 0 ||
                            item.maintenanceUnits > 0 ||
                            item.rentedUnits > 0 ||
                            item.reservedUnits > 0 ||
                            item.inactiveUnits > 0) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                              {item.rentedUnits > 0 && (
                                <span className="text-indigo-700 font-medium">{item.rentedUnits} with customer</span>
                              )}
                              {item.reservedUnits > 0 && (
                                <span className="text-primary font-medium">{item.reservedUnits} booked</span>
                              )}
                              {item.cleaningUnits > 0 && (
                                <span className="text-sky-700 font-medium">{item.cleaningUnits} in cleaning</span>
                              )}
                              {item.maintenanceUnits > 0 && (
                                <span className="text-amber-700 font-medium">{item.maintenanceUnits} in maintenance</span>
                              )}
                              {item.inactiveUnits > 0 && (
                                <span className="text-slate-500">{item.inactiveUnits} retired</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {item.branchName || 'Main Branch'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {item.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReview(item)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-primary hover:bg-primary/10 hover:border-primary/25 border-slate-200"
                            title="Review full item details and specifications"
                            aria-label="Review item details"
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenUnitsModal(item)}
                            className="h-8 px-2.5 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
                            title="View and manage individual copies"
                          >
                            <Layers className="w-3.5 h-3.5 mr-1" />
                            <span>Copies ({item.totalUnits})</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                            title="Edit item details"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(item)}
                            className={`h-8 w-8 p-0 ${
                              item.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-amber-600'
                                : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                            title={item.status === 'ACTIVE' ? 'Deactivate item' : 'Activate item'}
                          >
                            {item.status === 'ACTIVE' ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="border-t border-slate-100 p-3">
            <OpsPagination
              page={meta.page}
              limit={meta.limit}
              total={meta.total}
              totalPages={meta.totalPages}
              onPageChange={(p) => setPage(p)}
              itemLabel="rental items"
            />
          </div>
        )}
      </div>

      {/* ── Add / Edit Item Dialog ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-4xl lg:max-w-[1000px] w-[95vw] max-h-[92vh] overflow-hidden p-0 flex flex-col shadow-2xl border-slate-200">
          {/* Modal Header */}
          <DialogHeader className="px-6 py-4 border-b border-border bg-slate-50/60 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                  {editingItem ? 'Edit Rental Item' : 'Add Rental Item'}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingItem
                    ? 'Update item information, category, pricing, and specifications.'
                    : 'Enter your rental item details. Physical units will be automatically created for tracking.'}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Form */}
          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Row 1 — Item Information (Full width) */}
              <div>
                <Label htmlFor="item-name" className="text-xs font-semibold text-slate-700">
                  Item Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="item-name"
                  type="text"
                  placeholder="e.g. Kandyan Bridal Saree Maroon"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 h-9.5 text-sm bg-white border-slate-200 focus:border-primary focus:ring-primary"
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Row 2 — Category & Branch (Two-column layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="item-category" className="text-xs font-semibold text-slate-700">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <Link
                      to="/salon/rentals/categories"
                      target="_blank"
                      className="text-[11px] text-primary hover:underline font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <span>Manage Categories</span>
                    </Link>
                  </div>
                  <Select
                    value={formData.category}
                    onValueChange={(val: string) =>
                      setFormData({ ...formData, category: val })
                    }
                  >
                    <SelectTrigger id="item-category" className="mt-1 h-9.5 text-sm bg-white border-slate-200">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="item-branch" className="text-xs font-semibold text-slate-700">
                    Branch <span className="text-red-500">*</span>
                  </Label>
                  {activeBranches.length > 1 ? (
                    <Select
                      value={formData.branchId}
                      onValueChange={(val) => setFormData({ ...formData, branchId: val })}
                    >
                      <SelectTrigger id="item-branch" className="mt-1 h-9.5 text-sm bg-white border-slate-200">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeBranches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 h-9.5 px-3 bg-slate-100/90 rounded-md border border-slate-200 flex items-center justify-between text-sm text-slate-700 font-medium">
                      <span>{activeBranches[0]?.name || 'Main Branch'}</span>
                      <span className="text-[11px] text-slate-400">Assigned Branch</span>
                    </div>
                  )}
                  {formErrors.branchId && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.branchId}</p>
                  )}
                </div>
              </div>

              {/* Row 3 — Pricing & Copies (Two-column layout on same row on desktop) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rent-price" className="text-xs font-semibold text-slate-700">
                    Rent Price (LKR) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="rent-price"
                    type="number"
                    min="0"
                    step="50"
                    placeholder="e.g. 8000"
                    value={formData.rentPrice}
                    onChange={(e) => setFormData({ ...formData, rentPrice: e.target.value })}
                    className="mt-1 h-9.5 text-sm bg-white font-medium border-slate-200"
                  />
                  {formErrors.rentPrice && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.rentPrice}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="initial-quantity" className="text-xs font-semibold text-slate-700">
                    Number of Copies <span className="text-red-500">*</span>
                  </Label>
                  {!editingItem ? (
                    <div className="mt-1 flex items-center gap-3">
                      <Input
                        id="initial-quantity"
                        type="number"
                        min="1"
                        max="100"
                        placeholder="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="h-9.5 w-24 text-sm bg-white font-bold text-center border-slate-200"
                      />
                      <p className="text-xs text-slate-500">
                        We will automatically create trackable units (e.g. Unit 01, Unit 02).
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1 h-9.5 px-3 bg-slate-100/90 rounded-md border border-slate-200 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">
                        {editingItem.totalUnits || 1} physical {(editingItem.totalUnits || 1) === 1 ? 'copy' : 'copies'}
                      </span>
                      <span className="text-[11px] text-slate-500">Manage via Physical Copies dialog</span>
                    </div>
                  )}
                  {formErrors.quantity && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.quantity}</p>
                  )}
                </div>
              </div>

              {/* Row 4 — Specifications (Two-column layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-size" className="text-xs font-semibold text-slate-700">
                    Size <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="item-size"
                    type="text"
                    placeholder="e.g. Free Size, M, L, 34"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="mt-1 h-9.5 text-sm bg-white border-slate-200"
                  />
                </div>

                <div>
                  <Label htmlFor="item-color" className="text-xs font-semibold text-slate-700">
                    Color <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="item-color"
                    type="text"
                    placeholder="e.g. Maroon & Gold, Ivory"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="mt-1 h-9.5 text-sm bg-white border-slate-200"
                  />
                </div>
              </div>

              {/* Row 5 — Additional Details (Two-column layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="item-code" className="text-xs font-semibold text-slate-700">
                      Item Code
                    </Label>
                    {!editingItem && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            useCustomCode: !formData.useCustomCode,
                            code: !formData.useCustomCode ? codeSuggestion?.code || '' : '',
                          })
                        }
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        {formData.useCustomCode ? 'Use Auto Code' : 'Set Custom Code'}
                      </button>
                    )}
                  </div>

                  {editingItem ? (
                    <div className="mt-1 h-9.5 px-3 bg-slate-100/90 rounded-md border border-slate-200 flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-800 font-bold">{formData.code}</span>
                      <span className="text-[11px] text-slate-400">Permanent item code</span>
                    </div>
                  ) : formData.useCustomCode ? (
                    <Input
                      id="item-code"
                      type="text"
                      placeholder="e.g. RENT-0001 or KS-RED-01"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="mt-1 h-9.5 text-sm uppercase font-mono bg-white border-slate-200"
                    />
                  ) : (
                    <div className="mt-1 h-9.5 px-3 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-600 font-medium">
                        {codeSuggestion?.code || 'Generating...'}
                      </span>
                      <span className="text-[11px] text-slate-400">Auto-generated</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="item-notes" className="text-xs font-semibold text-slate-700">
                    Notes <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="item-notes"
                    type="text"
                    placeholder="e.g. Hand-embroidered, include matching veil and hair accessories"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 h-9.5 text-sm bg-white border-slate-200"
                  />
                </div>
              </div>

              {/* Photo / Image URL (Optional compact row) */}
              <div>
                <Label htmlFor="item-image" className="text-xs font-semibold text-slate-700">
                  Photo / Image URL <span className="text-slate-400 font-normal">(Optional)</span>
                </Label>
                <div className="mt-1 flex items-center gap-3">
                  <Input
                    id="item-image"
                    type="url"
                    placeholder="https://example.com/photos/item.jpg"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="h-9 text-sm bg-white border-slate-200 flex-1"
                  />
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Compact Sticky Footer */}
            <DialogFooter className="px-6 py-3 border-t border-border bg-slate-50/80 sticky bottom-0 shrink-0 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs px-4"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : null}
                {editingItem ? 'Save Changes' : 'Create Rental Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Manage Physical Copies / Units Dialog ── */}
      <Dialog open={isUnitsModalOpen} onOpenChange={setIsUnitsModalOpen}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>Physical Copies</span>
                  <span className="font-mono text-sm px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">
                    {inspectingItem?.code}
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">{inspectingItem?.name}</p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddUnitsOpen(!isAddUnitsOpen)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Copy</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Quick Add Copy Box (Collapsible) */}
          {isAddUnitsOpen && (
            <div className="bg-primary/10/70 p-3.5 rounded-xl border border-primary/25 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary">Add More Copies of this Item</p>
                <button
                  type="button"
                  onClick={() => setIsAddUnitsOpen(false)}
                  className="text-purple-400 hover:text-primary p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-28">
                  <Label className="text-[11px] font-semibold text-primary">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={addUnitsCount}
                    onChange={(e) => setAddUnitsCount(e.target.value)}
                    className="h-8 text-sm bg-white mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px] font-semibold text-primary">Note (optional)</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Purchased second piece"
                    value={addUnitsNotes}
                    onChange={(e) => setAddUnitsNotes(e.target.value)}
                    className="h-8 text-sm bg-white mt-1"
                  />
                </div>
                <div className="self-end">
                  <Button
                    size="sm"
                    disabled={addUnitsMutation.isPending}
                    onClick={() => {
                      const qty = parseInt(addUnitsCount, 10);
                      if (isNaN(qty) || qty < 1) {
                        toast.error('Please enter a valid quantity');
                        return;
                      }
                      addUnitsMutation.mutate({
                        itemId: inspectingItem!.id,
                        quantity: qty,
                        notes: addUnitsNotes.trim() || undefined,
                      });
                    }}
                    className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3"
                  >
                    {addUnitsMutation.isPending ? 'Adding...' : 'Add Now'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Units list */}
          {isLoadingUnits ? (
            <div className="py-12">
              <OpsLoading />
            </div>
          ) : !fullInspectingItem?.units || fullInspectingItem.units.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No physical copies recorded yet. Click &quot;Add Copy&quot; to create unit records.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[500px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Unit Code</th>
                      <th className="py-2.5 px-3">Condition / Status</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Change Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fullInspectingItem.units.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/50">
                        {/* Unit Code */}
                        <td className="py-3 px-3">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {unit.unitCode}
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">Unit #{unit.unitNumber}</p>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3">{getUnitStatusBadge(unit.status)}</td>

                        {/* Unit Notes */}
                        <td className="py-3 px-3 text-xs text-slate-600 max-w-[180px]">
                          {editingUnitNote?.id === unit.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                size={1}
                                value={unitNoteText}
                                onChange={(e) => setUnitNoteText(e.target.value)}
                                className="h-7 text-xs bg-white"
                                placeholder="Condition note..."
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  updateUnitMutation.mutate({
                                    unitId: unit.id,
                                    notes: unitNoteText.trim(),
                                  });
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-1.5 text-xs text-slate-400"
                                onClick={() => setEditingUnitNote(null)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingUnitNote(unit);
                                setUnitNoteText(unit.notes || '');
                              }}
                              className="cursor-pointer hover:text-primary truncate"
                              title={unit.notes || 'Click to add note'}
                            >
                              {unit.notes ? (
                                <span>{unit.notes}</span>
                              ) : (
                                <span className="text-slate-300 italic">+ Add note</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Change Status Action */}
                        <td className="py-3 px-3 text-right">
                          {unit.status === 'RESERVED' || unit.status === 'RENTED' ? (
                            <span
                              className="text-xs text-primary bg-primary/10 px-2 py-1 rounded font-medium inline-block"
                              title="Managed automatically by booking workflow in Phase 2"
                            >
                              Active Booking
                            </span>
                          ) : (
                            <Select
                              value={unit.status}
                              onValueChange={(val: 'AVAILABLE' | 'MAINTENANCE' | 'INACTIVE') => {
                                updateUnitMutation.mutate({
                                  unitId: unit.id,
                                  status: val,
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-44 ml-auto bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AVAILABLE">Available</SelectItem>
                                
                                <SelectItem value="MAINTENANCE">Under Maintenance</SelectItem>
                                <SelectItem value="INACTIVE">Retired / Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsUnitsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 3. Review Rental Item Details Modal ── */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {reviewingItem?.code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200/80 text-slate-700">
                    {reviewingItem?.category}
                  </span>
                  {reviewingItem?.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Inactive
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 mt-1">
                  {reviewingItem?.name}
                </DialogTitle>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{reviewingItem?.branchName || 'Main Branch'}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsReviewOpen(false);
                    if (reviewingItem) handleOpenEdit(reviewingItem);
                  }}
                  className="h-8 text-xs font-medium text-slate-700"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsReviewOpen(false);
                    if (reviewingItem) handleOpenUnitsModal(reviewingItem);
                  }}
                  className="h-8 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  Copies ({reviewingItem?.totalUnits})
                </Button>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {isLoadingReview ? (
              <div className="py-12">
                <OpsLoading />
              </div>
            ) : (
              <>
                {/* Visual / Media + Key Specs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Image or Icon Preview */}
                  <div className="md:col-span-1 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center min-h-[160px] max-h-[220px]">
                    {reviewingItem?.imageUrl ? (
                      <img
                        src={reviewingItem.imageUrl}
                        alt={reviewingItem.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="p-6 text-center space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center font-bold text-xl">
                          {reviewingItem?.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs text-slate-400 font-medium">No photo uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Pricing and Details cards */}
                  <div className="md:col-span-2 grid grid-cols-2 gap-3">
                    <div className="bg-primary/10/50 p-3.5 rounded-xl border border-primary/15 space-y-1">
                      <span className="text-[11px] font-semibold text-primary uppercase">Rent Charge</span>
                      <p className="text-xl font-bold text-primary">
                        {formatMoneyLkr(reviewingItem?.rentPrice || 0)}
                      </p>
                      <p className="text-[11px] text-primary/80">per rental period</p>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Refundable Deposit</span>
                      <p className="text-xl font-bold text-slate-900">
                        {(reviewingItem?.deposit || 0) > 0 ? formatMoneyLkr(reviewingItem!.deposit) : 'No deposit'}
                      </p>
                      <p className="text-[11px] text-slate-400">returned on inspection</p>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Color & Style</span>
                      <p className="font-semibold text-slate-800 text-sm">
                        {reviewingItem?.color || 'Standard color'}
                      </p>
                      <p className="text-slate-400">Category: {reviewingItem?.category}</p>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Size / Measurements</span>
                      <p className="font-semibold text-slate-800 text-sm">
                        {reviewingItem?.size || 'Free size / Custom fit'}
                      </p>
                      <p className="text-slate-400">Total units: {reviewingItem?.totalUnits} pieces</p>
                    </div>
                  </div>
                </div>

                {/* Combined Total Upfront Pill */}
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-emerald-900">Total Customer Upfront Amount:</span>
                    <p className="text-emerald-700 text-[11px]">
                      Rental Fee ({formatMoneyLkr(reviewingItem?.rentPrice || 0)}) + Security Deposit (
                      {formatMoneyLkr(reviewingItem?.deposit || 0)})
                    </p>
                  </div>
                  <span className="text-base font-bold text-emerald-800">
                    {formatMoneyLkr((reviewingItem?.rentPrice || 0) + (reviewingItem?.deposit || 0))}
                  </span>
                </div>

                {/* Notes & Care Instructions */}
                {reviewingItem?.notes && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                    <span className="font-semibold text-amber-800 uppercase text-[11px] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-600" /> Care & Handling Notes
                    </span>
                    <p className="text-slate-700 leading-relaxed">{reviewingItem.notes}</p>
                  </div>
                )}

                {/* Inventory Status Breakdown */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Physical Units & Availability ({fullReviewItem?.units?.length || reviewingItem?.totalUnits || 0} copies)
                    </h4>
                    <span className="text-xs text-emerald-700 font-semibold">
                      {reviewingItem?.availableUnits || 0} available right now
                    </span>
                  </div>

                  {/* Inventory metric chips */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                    <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200/60">
                      <p className="font-bold text-base">{reviewingItem?.availableUnits || 0}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Available</p>
                    </div>
                    <div className="bg-primary/10 text-primary p-2 rounded-lg border border-primary/25/60">
                      <p className="font-bold text-base">{reviewingItem?.reservedUnits || 0}</p>
                      <p className="text-[10px] text-primary font-medium">Reserved</p>
                    </div>
                    <div className="bg-indigo-50 text-indigo-800 p-2 rounded-lg border border-indigo-200/60">
                      <p className="font-bold text-base">{reviewingItem?.rentedUnits || 0}</p>
                      <p className="text-[10px] text-indigo-600 font-medium">With Client</p>
                    </div>
                    <div className="bg-sky-50 text-sky-800 p-2 rounded-lg border border-sky-200/60">
                      <p className="font-bold text-base">{reviewingItem?.cleaningUnits || 0}</p>
                      <p className="text-[10px] text-sky-600 font-medium">Cleaning</p>
                    </div>
                    <div className="bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-200/60">
                      <p className="font-bold text-base">{reviewingItem?.maintenanceUnits || 0}</p>
                      <p className="text-[10px] text-amber-600 font-medium">Repair</p>
                    </div>
                    <div className="bg-slate-100 text-slate-700 p-2 rounded-lg border border-slate-200">
                      <p className="font-bold text-base">{reviewingItem?.inactiveUnits || 0}</p>
                      <p className="text-[10px] text-slate-500 font-medium">Retired</p>
                    </div>
                  </div>

                  {/* Individual Units List */}
                  {fullReviewItem?.units && fullReviewItem.units.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                      {fullReviewItem.units.map((unit) => (
                        <div key={unit.id} className="p-2.5 px-3 flex items-center justify-between hover:bg-slate-50/60">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {unit.unitCode}
                            </span>
                            <span className="text-slate-400 text-[11px]">Copy #{unit.unitNumber}</span>
                            {unit.notes && (
                              <span className="text-slate-600 italic text-[11px] truncate max-w-[200px]">
                                &ldquo;{unit.notes}&rdquo;
                              </span>
                            )}
                          </div>
                          <div>{getUnitStatusBadge(unit.status)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {reviewingItem?.createdAt ? `Added ${formatDisplayDate(reviewingItem.createdAt)}` : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsReviewOpen(false);
                  if (reviewingItem) handleOpenUnitsModal(reviewingItem);
                }}
                className="text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
              >
                <Layers className="w-3.5 h-3.5 mr-1" />
                Manage Physical Copies
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReviewOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── WhatsApp Rental Catalog Sharing Modal ── */}
      <RentalCatalogShareModal
        open={isCatalogShareOpen}
        onOpenChange={setIsCatalogShareOpen}
        categories={dbCategories}
        initiallySelectedIds={selectedItemIds}
        initialCategory={selectedCategory}
        allRentalItems={items}
      />
    </div>
  );
}
