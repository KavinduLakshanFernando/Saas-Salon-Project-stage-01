import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  CreditCard,
  Printer,
  ShieldCheck,
  Check,
  PackageCheck,
  Receipt,
  RotateCcw,
  Trash2,
  Layers,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  tenantApi,
  type RentalBooking,
  type RentalAvailabilityItem,
  type RentalAvailabilityUnit,
  type RentalCategory,
  type Customer,
  type RentalPaymentMethod,
  type CreateRentalPaymentPayload,
} from '@/api/tenant.api';
import { useSalonBranch } from '@/contexts/SalonBranchContext';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { formatMoneyLkr, formatMoneyAmount } from '@/lib/money';
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
import { OpsLoading, OpsPagination, getErrorMessage } from './salon-ops-ui';

const CATEGORIES: RentalCategory[] = [
  'Saree',
  'Frock',
  'Jewellery',
  'Veil',
  'Crown',
  'Jacket',
  'Accessory',
  'Other',
];

function todayIso(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysIso(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  const nextYear = next.getFullYear();
  const nextMonth = String(next.getMonth() + 1).padStart(2, '0');
  const nextDay = String(next.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function calculateDurationDays(pickupDate: string, returnDate: string): number {
  if (!pickupDate || !returnDate || returnDate < pickupDate) return 0;
  const p = new Date(pickupDate + 'T00:00:00');
  const r = new Date(returnDate + 'T00:00:00');
  const diffTime = r.getTime() - p.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
  return Math.max(1, diffDays);
}

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDisplayDateTime(isoStr?: string | Date | null): string {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface SelectedCopyInfo {
  unitId: string;
  unitCode: string;
  unitNumber?: number;
  rentalItemId: string;
  itemName: string;
  itemCode: string;
  category: string;
  rentPrice: number;
  deposit: number;
}

export default function RentalBookingsPage() {
  const queryClient = useQueryClient();
  const { branchId: activeBranchId, activeBranches, isAllBranches } = useSalonBranch();

  // Resolved default login branch (active branch, or main branch, or first available branch)
  const resolvedLoginBranchId = useMemo(() => {
    if (!isAllBranches && activeBranchId && activeBranchId !== 'all') {
      return activeBranchId;
    }
    const main = activeBranches.find((b) => b.isMain);
    if (main) return main.id;
    return activeBranches[0]?.id || '';
  }, [activeBranchId, activeBranches, isAllBranches]);

  const handleOpenNewBooking = () => {
    setBookingBranchId(resolvedLoginBranchId || activeBranches[0]?.id || '');
    setIsCreateOpen(true);
  };

  // Filters & Search
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search, 350, 1);
  const [selectedStatus, setSelectedStatus] = useState<string>(() => statusParam || 'all');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    if (statusParam) {
      setSelectedStatus(statusParam);
      setPage(1);
    }
  }, [statusParam]);

  // Active branch resolution
  const effectiveBranchId = useMemo(() => {
    if (!isAllBranches && activeBranchId) return activeBranchId;
    return filterBranchId !== 'all' ? filterBranchId : undefined;
  }, [isAllBranches, activeBranchId, filterBranchId]);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectingBookingId, setInspectingBookingId] = useState<string | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<RentalBooking | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Phase 3 Modal states: Pickup, Payment & Receipt
  const [pickupBooking, setPickupBooking] = useState<RentalBooking | null>(null);
  const [actualPickupDate, setActualPickupDate] = useState<string>(todayIso());
  const [pickupNotes, setPickupNotes] = useState<string>('');
  const [conditionOut, setConditionOut] = useState<string>('');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupPaymentAmount, setPickupPaymentAmount] = useState<string>('');
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState<RentalPaymentMethod>('CASH');
  const [pickupPaymentRef, setPickupPaymentRef] = useState<string>('');
  const [isCollectingPaymentAtPickup, setIsCollectingPaymentAtPickup] = useState(false);

  const [paymentBooking, setPaymentBooking] = useState<RentalBooking | null>(null);
  const [payRentAmount, setPayRentAmount] = useState<string>('');
  const [payDepositAmount, setPayDepositAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<RentalPaymentMethod>('CASH');
  const [payRefNum, setPayRefNum] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payError, setPayError] = useState<string | null>(null);

  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // SINGLE POPUP UI STATE FOR BOOKING CREATION
  // -------------------------------------------------------------
  const [bookingBranchId, setBookingBranchId] = useState<string>(() => resolvedLoginBranchId);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pickupDate, setPickupDate] = useState<string>(todayIso());
  const [returnDate, setReturnDate] = useState<string>(addDaysIso(todayIso(), 2));
  const [selectedCopies, setSelectedCopies] = useState<SelectedCopyInfo[]>([]);
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [confirmedBookingResult, setConfirmedBookingResult] = useState<any | null>(null);
  const [createBookingError, setCreateBookingError] = useState<string | null>(null);

  // Advance Payment State in Booking Modal (unified, without sub-categories)
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState<string>('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<RentalPaymentMethod>('CASH');
  const [advanceReferenceNumber, setAdvanceReferenceNumber] = useState<string>('');
  const [advancePaymentNotes, setAdvancePaymentNotes] = useState<string>('');
  const [customSecurityDeposit, setCustomSecurityDeposit] = useState<string>('');

  // Customer search & quick add state
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebouncedSearch(customerSearch, 300, 1);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerEmail, setQuickCustomerEmail] = useState('');
  const [quickCustomerNotes, setQuickCustomerNotes] = useState('');
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);

  // Availability filter & item dropdown selection state
  const [availCategory, setAvailCategory] = useState<string>('all');
  const [availSearch, setAvailSearch] = useState<string>('');
  const [selectedRentalItemId, setSelectedRentalItemId] = useState<string>('');

  // Set default values when single popup opens
  useEffect(() => {
    if (isCreateOpen) {
      setBookingBranchId(resolvedLoginBranchId);
      setPickupDate(todayIso());
      setReturnDate(addDaysIso(todayIso(), 2));
      setSelectedCustomer(null);
      setSelectedCopies([]);
      setBookingNotes('');
      setCustomSecurityDeposit('');
      setConfirmedBookingResult(null);
      setCustomerSearch('');
      setIsCustomerDropdownOpen(false);
      setCreateBookingError(null);
      setIsQuickCustomerOpen(false);
      setAdvancePaymentAmount('');
      setAdvancePaymentMethod('CASH');
      setAdvanceReferenceNumber('');
      setAdvancePaymentNotes('');
      setSelectedRentalItemId('');
      setAvailCategory('all');
      setAvailSearch('');
    }
  }, [isCreateOpen, resolvedLoginBranchId]);

  // Keep branch defaulted to login branch if unset or set to 'all'
  useEffect(() => {
    if (isCreateOpen && (!bookingBranchId || bookingBranchId === 'all') && resolvedLoginBranchId) {
      setBookingBranchId(resolvedLoginBranchId);
    }
  }, [isCreateOpen, bookingBranchId, resolvedLoginBranchId]);

  // Handle clicking outside customer search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------
  // QUERIES
  // -------------------------------------------------------------
  // 1. Bookings Summary KPIs
  const { data: summaryData } = useQuery({
    queryKey: ['rental-bookings-summary', effectiveBranchId],
    queryFn: () => tenantApi.rentals.getBookingSummary(effectiveBranchId),
  });

  // 2. Bookings Paginated List
  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
  } = useQuery({
    queryKey: [
      'rental-bookings-list',
      effectiveBranchId,
      selectedStatus,
      filterStartDate,
      filterEndDate,
      debouncedSearch,
      page,
      limit,
    ],
    queryFn: () =>
      tenantApi.rentals.listBookings({
        branchId: effectiveBranchId,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      }),
  });

  // 3. Customer Search in Single Popup
  const { data: customersData = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers-booking-search', debouncedCustomerSearch],
    queryFn: () =>
      tenantApi.customers.search({
        search: debouncedCustomerSearch.trim(),
        status: 'ACTIVE',
        limit: '15',
      }),
    enabled: isCreateOpen,
  });

  // Dynamic categories from database
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['rental-categories-active'],
    queryFn: () => tenantApi.rentals.listCategories({ status: 'ACTIVE' }),
  });

  // 4. Availability Query for Single Popup (loads available items for branch & dates)
  const {
    data: availabilityItems = [],
    isLoading: isLoadingAvailability,
  } = useQuery({
    queryKey: [
      'rental-availability',
      bookingBranchId || resolvedLoginBranchId,
      pickupDate,
      returnDate,
    ],
    queryFn: () =>
      tenantApi.rentals.checkAvailability({
        branchId: bookingBranchId,
        pickupDate,
        returnDate,
      }),
    enabled: isCreateOpen && Boolean(bookingBranchId) && Boolean(pickupDate) && Boolean(returnDate) && returnDate >= pickupDate,
  });

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    dbCategories.forEach((c) => set.add(c.name));
    CATEGORIES.forEach((c) => set.add(c));
    availabilityItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [dbCategories, availabilityItems]);

  // Filtered items based on Category dropdown and search
  const displayedItems = useMemo(() => {
    return availabilityItems.filter((item) => {
      if (availCategory !== 'all' && item.category !== availCategory) {
        return false;
      }
      if (availSearch.trim()) {
        const q = availSearch.trim().toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [availabilityItems, availCategory, availSearch]);

  // Active selected rental item
  const activeSelectedItem = useMemo(() => {
    if (selectedRentalItemId) {
      const found = availabilityItems.find((i) => i.id === selectedRentalItemId);
      if (found) return found;
    }
    return displayedItems[0] || null;
  }, [availabilityItems, displayedItems, selectedRentalItemId]);

  // Keep selectedRentalItemId synchronized with displayed items
  useEffect(() => {
    if (displayedItems.length > 0) {
      if (!selectedRentalItemId || !displayedItems.some((i) => i.id === selectedRentalItemId)) {
        setSelectedRentalItemId(displayedItems[0].id);
      }
    } else {
      setSelectedRentalItemId('');
    }
  }, [displayedItems, selectedRentalItemId]);

  // 5. Inspecting Booking Full Details
  const { data: inspectingBooking, isLoading: isLoadingInspecting } = useQuery({
    queryKey: ['rental-booking-detail', inspectingBookingId],
    queryFn: () => tenantApi.rentals.getBooking(inspectingBookingId!),
    enabled: Boolean(inspectingBookingId),
  });

  // 6. Receipt Payment for Print Modal
  const { data: receiptPayment, isLoading: isLoadingReceipt } = useQuery({
    queryKey: ['rental-payment-receipt', receiptPaymentId],
    queryFn: () => tenantApi.rentals.getPayment(receiptPaymentId!),
    enabled: Boolean(receiptPaymentId),
  });

  // -------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------
  // Cancel Booking Mutation
  const cancelBookingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      tenantApi.rentals.cancelBooking(id, reason),
    onSuccess: (res) => {
      toast.success(`Booking ${res.bookingReference} has been cancelled`);
      setCancellingBooking(null);
      setCancellationReason('');
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-summary'] });
      queryClient.invalidateQueries({ queryKey: ['rental-availability'] });
      if (inspectingBookingId) {
        queryClient.invalidateQueries({ queryKey: ['rental-booking-detail', inspectingBookingId] });
      }
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Failed to cancel booking'));
    },
  });

  // Confirm Pickup Mutation
  const confirmPickupMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        actualPickupDate?: string;
        pickupNotes?: string;
        conditionOut?: string;
        allowPendingDeposit?: boolean;
        payment?: {
          amount: number;
          paymentMethod?: RentalPaymentMethod;
          referenceNumber?: string;
          notes?: string;
        };
      };
    }) => tenantApi.rentals.confirmPickup(id, payload),
    onSuccess: (res) => {
      toast.success(`Booking ${res.bookingReference} successfully marked as PICKED UP!`);
      setPickupBooking(null);
      setPickupNotes('');
      setConditionOut('');
      setPickupPaymentAmount('');
      setPickupPaymentRef('');
      setPickupError(null);
      setIsCollectingPaymentAtPickup(false);
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-summary'] });
      queryClient.invalidateQueries({ queryKey: ['rental-availability'] });
      queryClient.invalidateQueries({ queryKey: ['rental-payments-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-payments-summary'] });
      if (inspectingBookingId) {
        queryClient.invalidateQueries({ queryKey: ['rental-booking-detail', inspectingBookingId] });
      }
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to confirm pickup');
      setPickupError(msg);
      toast.error(msg);
    },
  });

  // Collect Payment Mutation
  const collectPaymentMutation = useMutation({
    mutationFn: (payload: CreateRentalPaymentPayload) => tenantApi.rentals.collectPayment(payload),
    onSuccess: (payment) => {
      toast.success(`Payment ${payment.paymentNumber} collected successfully!`);
      setPaymentBooking(null);
      setPayError(null);
      queryClient.invalidateQueries({ queryKey: ['rental-payments-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-payments-summary'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-summary'] });
      if (inspectingBookingId) {
        queryClient.invalidateQueries({ queryKey: ['rental-booking-detail', inspectingBookingId] });
      }
      // Open receipt dialog
      setReceiptPaymentId(payment.id);
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to collect payment');
      setPayError(msg);
      toast.error(msg);
    },
  });

  // Quick Customer Creation
  const quickCustomerMutation = useMutation({
    mutationFn: (data: { name: string; phone: string; email?: string; notes?: string }) =>
      tenantApi.customers.create({
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: (newCust) => {
      toast.success(`Customer "${newCust.name}" created`);
      setSelectedCustomer(newCust);
      setCustomerSearch(`${newCust.name} (${newCust.phone || ''})`);
      setIsCustomerDropdownOpen(false);
      setIsQuickCustomerOpen(false);
      setQuickCustomerName('');
      setQuickCustomerPhone('');
      setQuickCustomerEmail('');
      setQuickCustomerNotes('');
      setQuickCustomerError(null);
      queryClient.invalidateQueries({ queryKey: ['customers-booking-search'] });
    },
    onError: (err: unknown) => {
      setQuickCustomerError(getErrorMessage(err, 'Failed to create customer'));
    },
  });

  // Create Booking Mutation
  const createBookingMutation = useMutation({
    mutationFn: () => {
      if (!selectedCustomer) throw new Error('Customer is required');
      if (!bookingBranchId) throw new Error('Branch is required');
      if (selectedCopies.length === 0) throw new Error('At least one physical copy must be selected');
      if (returnDate < pickupDate) throw new Error('Return date cannot be earlier than pickup date');

      return tenantApi.rentals.createBooking({
        branchId: bookingBranchId || resolvedLoginBranchId,
        customerId: selectedCustomer.id,
        pickupDate,
        returnDate,
        unitIds: selectedCopies.map((c) => c.unitId),
        notes: bookingNotes.trim() || undefined,
        securityDeposit: customSecurityDeposit !== '' ? (parseFloat(customSecurityDeposit) || 0) : undefined,
        advancePayment: advancePaymentNum > 0 ? {
          rentAmount: Math.min(advancePaymentNum, bookingTotals.totalRent) > 0
            ? Math.min(advancePaymentNum, bookingTotals.totalRent)
            : undefined,
          depositAmount: Math.max(0, advancePaymentNum - bookingTotals.totalRent) > 0
            ? Math.max(0, advancePaymentNum - bookingTotals.totalRent)
            : undefined,
          paymentMethod: advancePaymentMethod,
          referenceNumber: advanceReferenceNumber.trim() || undefined,
          notes: advancePaymentNotes.trim() || undefined,
        } : undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(`Booking ${res.bookingReference} reserved successfully!`);
      setConfirmedBookingResult(res);
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-summary'] });
      queryClient.invalidateQueries({ queryKey: ['rental-availability'] });
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to create booking');
      setCreateBookingError(msg);
      toast.error(msg);
    },
  });

  // Calculated Totals for Single Popup
  const bookingTotals = useMemo(() => {
    const totalRent = selectedCopies.reduce((sum, c) => sum + Number(c.rentPrice || 0), 0);
    const defaultDeposit = selectedCopies.reduce((sum, c) => sum + Number(c.deposit || 0), 0);
    const totalDeposit = customSecurityDeposit !== '' ? (parseFloat(customSecurityDeposit) || 0) : defaultDeposit;
    return {
      totalRent,
      defaultDeposit,
      totalDeposit,
      grandTotal: totalRent + totalDeposit,
    };
  }, [selectedCopies, customSecurityDeposit]);

  const advancePaymentNum = useMemo(() => {
    const n = parseFloat(advancePaymentAmount);
    return isNaN(n) ? 0 : Math.max(0, n);
  }, [advancePaymentAmount]);

  const totalCollectedNow = advancePaymentNum;

  const remainingBalance = useMemo(() => {
    return Math.max(0, bookingTotals.grandTotal - advancePaymentNum);
  }, [bookingTotals.grandTotal, advancePaymentNum]);

  // Copy toggle in single popup
  const handleToggleCopy = (item: RentalAvailabilityItem, unit: RentalAvailabilityUnit) => {
    if (!unit.isAvailable) return;

    setSelectedCopies((prev) => {
      const exists = prev.some((c) => c.unitId === unit.id);
      if (exists) {
        return prev.filter((c) => c.unitId !== unit.id);
      }
      return [
        ...prev,
        {
          unitId: unit.id,
          unitCode: unit.unitCode,
          unitNumber: unit.unitNumber,
          rentalItemId: item.id,
          itemName: item.name,
          itemCode: item.code,
          category: item.category,
          rentPrice: item.rentPrice,
          deposit: item.deposit,
        },
      ];
    });
  };

  const handleSelectAllItemCopies = (item: RentalAvailabilityItem) => {
    const availableUnits = item.units.filter((u) => u.isAvailable);
    setSelectedCopies((prev) => {
      const existingIds = new Set(prev.map((c) => c.unitId));
      const additions = availableUnits
        .filter((u) => !existingIds.has(u.id))
        .map((u) => ({
          unitId: u.id,
          unitCode: u.unitCode,
          unitNumber: u.unitNumber,
          rentalItemId: item.id,
          itemName: item.name,
          itemCode: item.code,
          category: item.category,
          rentPrice: item.rentPrice,
          deposit: item.deposit,
        }));
      return [...prev, ...additions];
    });
  };

  const handleDeselectAllItemCopies = (item: RentalAvailabilityItem) => {
    const unitIds = new Set(item.units.map((u) => u.id));
    setSelectedCopies((prev) => prev.filter((c) => !unitIds.has(c.unitId)));
  };

  const handleOpenPickupModal = (booking: RentalBooking) => {
    setPickupBooking(booking);
    setActualPickupDate(todayIso());
    setPickupNotes('');
    setConditionOut('');
    setPickupError(null);
    setPickupPaymentAmount('');
    setPickupPaymentMethod('CASH');
    setPickupPaymentRef('');
    setIsCollectingPaymentAtPickup(false);
  };

  const handleOpenPaymentModal = (booking: RentalBooking) => {
    setPaymentBooking(booking);
    setPayMethod('CASH');
    setPayRefNum('');
    setPayNotes('');
    setPayError(null);
    if (booking.financials) {
      setPayRentAmount(booking.financials.remainingRent > 0 ? String(booking.financials.remainingRent) : '0');
      setPayDepositAmount(booking.financials.remainingDeposit > 0 ? String(booking.financials.remainingDeposit) : '0');
    } else {
      setPayRentAmount(String(booking.totalRent));
      setPayDepositAmount(String(booking.totalDeposit));
    }
  };

  const handleSubmitPaymentModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBooking) return;
    const rentNum = parseFloat(payRentAmount) || 0;
    const depNum = parseFloat(payDepositAmount) || 0;
    const total = Math.round((rentNum + depNum) * 100) / 100;

    if (total <= 0) {
      setPayError('Payment amount must be greater than zero');
      return;
    }

    collectPaymentMutation.mutate({
      bookingId: paymentBooking.id,
      amount: total,
      rentAmount: rentNum,
      depositAmount: depNum,
      paymentMethod: payMethod,
      referenceNumber: payRefNum.trim() || undefined,
      notes: payNotes.trim() || undefined,
      idempotencyKey: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rental Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Reserve bridal wear, suits, and accessories with conflict prevention, payment tracking, and handover management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenNewBooking}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Booking
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bookings */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {summaryData?.totalBookings ?? 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* Active Reserved */}
        <div className="bg-white p-4 rounded-xl border border-primary/20 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Active Reserved</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {summaryData?.reservedBookings ?? 0}
            </p>
            <span className="text-[11px] text-primary font-medium">Awaiting pickup</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Security Deposit Held KPI (Part A #11: Actual Collected Deposits) */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Security Deposit Held</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">
              {formatMoneyLkr(summaryData?.totalSecurityDepositHeld ?? summaryData?.totalDepositReserved ?? 0)}
            </p>
            <span className="text-[11px] text-indigo-600 font-medium">Actual collected deposits</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Picked Up / Handed Over */}
        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Picked Up / Out</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {summaryData?.pickedUpBookings ?? 0}
            </p>
            <span className="text-[11px] text-blue-600 font-medium">Currently rented out</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search reference, customer name, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-sm"
            />
          </div>

          {/* Status selector */}
          <div className="md:col-span-3">
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                setSelectedStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="RESERVED">Reserved (Pending Handover)</SelectItem>
                <SelectItem value="PICKED_UP">Picked Up (Rented Out)</SelectItem>
                <SelectItem value="PARTIALLY_RETURNED">Partially Returned</SelectItem>
                <SelectItem value="RETURNED">Returned</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range filters */}
          <div className="md:col-span-2">
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setPage(1);
              }}
              className="text-sm"
              title="Pickup Date From"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                setPage(1);
              }}
              className="text-sm"
              title="Return Date To"
            />
          </div>

          {/* Branch filter if multi-branch */}
          {isAllBranches && (
            <div className="md:col-span-1">
              <Select
                value={filterBranchId}
                onValueChange={(val) => {
                  setFilterBranchId(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {activeBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoadingBookings ? (
          <div className="py-16">
            <OpsLoading />
          </div>
        ) : !bookingsData?.data || bookingsData.data.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No Rental Bookings Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {search || selectedStatus !== 'all' || filterStartDate
                ? 'Try adjusting your search criteria or clearing active filters.'
                : 'Create your first rental booking using the New Booking button.'}
            </p>
            <Button
              onClick={handleOpenNewBooking}
              variant="outline"
              size="sm"
              className="mt-2 text-primary border-primary/30 hover:bg-primary/10"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Booking
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Reference</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Customer</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Schedule</th>
                  <th className="py-3.5 px-4 text-center">Copies</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Rental Charge</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Deposit Status</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookingsData.data.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Reference */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {booking.bookingReference}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{booking.customerName}</div>
                      {booking.customerPhone && (
                        <div className="text-xs text-slate-400 font-mono">{booking.customerPhone}</div>
                      )}
                    </td>

                    {/* Schedule */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-slate-800 font-medium">
                        {formatDisplayDate(booking.pickupDate)} → {formatDisplayDate(booking.returnDate)}
                      </div>
                      <div className="text-[11px] text-primary font-semibold">
                        {calculateDurationDays(booking.pickupDate, booking.returnDate)} days duration
                      </div>
                    </td>

                    {/* Copies Count */}
                    <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                        {booking.itemCount} {booking.itemCount === 1 ? 'copy' : 'copies'}
                      </span>
                    </td>

                    {/* Rental Charge & Paid Progress */}
                    <td className="py-3.5 px-4 text-slate-900 whitespace-nowrap">
                      <div className="font-semibold">{formatMoneyAmount(booking.totalRent)}</div>
                      {booking.financials && (
                        <div className="text-[11px]">
                          {booking.financials.remainingRent <= 0 ? (
                            <span className="text-primary font-semibold">Paid in full</span>
                          ) : (
                            <span className="text-amber-700">
                              Bal: {formatMoneyAmount(booking.financials.remainingRent)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Refundable Deposit Status */}
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <div className="font-medium text-indigo-900">{formatMoneyAmount(booking.totalDeposit)}</div>
                      {booking.financials && (
                        <div className="text-[11px]">
                          {booking.financials.remainingDeposit <= 0 ? (
                            <span className="text-primary font-semibold">Deposit fully held</span>
                          ) : (
                            <span className="text-rose-600 font-medium">
                              Need: {formatMoneyAmount(booking.financials.remainingDeposit)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          booking.status === 'RESERVED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : booking.status === 'PICKED_UP'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : booking.status === 'PARTIALLY_RETURNED'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : booking.status === 'RETURNED'
                                ? 'bg-primary/10 text-primary border-primary/25'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {booking.status === 'RESERVED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPickupModal(booking)}
                            className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                            title="Confirm Handover & Pickup"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            Pickup
                          </Button>
                        )}

                        {(booking.status === 'PICKED_UP' || booking.status === 'PARTIALLY_RETURNED') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              window.location.href = '/salon/rentals/returns';
                            }}
                            className="h-8 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1"
                            title="Process Return & Settlement"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectingBookingId(booking.id)}
                          className="h-8 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {bookingsData && bookingsData.meta.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, bookingsData.meta.total)} of {bookingsData.meta.total} bookings
            </span>
            <OpsPagination
              page={page}
              limit={limit}
              total={bookingsData.meta.total}
              totalPages={bookingsData.meta.totalPages}
              onPageChange={setPage}
              itemLabel="rental bookings"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SINGLE POPUP UI: NEW RENTAL BOOKING                                       */}
      {/* ========================================================================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[1240px] w-[96vw] max-h-[94vh] p-0 overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200">
          {/* Dialog Header */}
          <DialogHeader className="px-6 py-3.5 border-b border-slate-100 flex-shrink-0 flex flex-row items-center justify-between bg-slate-50/50">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <span>New Rental Booking</span>
                <span className="text-xs font-normal text-slate-500 block">
                  Bridal Saree, Outfit & Jewellery Reservation Workspace
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {confirmedBookingResult ? (
            /* Confirmation Success Screen */
            <div className="p-8 text-center space-y-5 flex-1 overflow-y-auto">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Reservation Confirmed!</h3>
                <p className="text-base font-mono text-primary font-bold mt-1">
                  Reference: {confirmedBookingResult.bookingReference}
                </p>
                {confirmedBookingResult.payment && (
                  <p className="text-xs font-mono text-purple-700 font-semibold mt-0.5">
                    Advance Payment Receipt: {confirmedBookingResult.payment.paymentNumber} ({formatMoneyLkr(confirmedBookingResult.payment.amount)})
                  </p>
                )}
              </div>

              <div className="max-w-md mx-auto p-5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2.5 shadow-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">{confirmedBookingResult.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Schedule:</span>
                  <span className="font-semibold text-slate-900">
                    {formatDisplayDate(confirmedBookingResult.pickupDate)} → {formatDisplayDate(confirmedBookingResult.returnDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Physical Copies:</span>
                  <span className="font-semibold text-slate-900">{confirmedBookingResult.unitsCount} items reserved</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Total Rent:</span>
                  <span className="font-bold text-slate-900">{formatMoneyLkr(confirmedBookingResult.totalRent)}</span>
                </div>
                <div className="flex justify-between text-indigo-700 font-medium">
                  <span>Refundable Security Deposit:</span>
                  <span>{formatMoneyLkr(confirmedBookingResult.totalDeposit)}</span>
                </div>
                {confirmedBookingResult.payment && (
                  <div className="flex justify-between text-primary font-bold pt-2 border-t border-slate-200">
                    <span>Payment Collected Now:</span>
                    <span>{formatMoneyLkr(confirmedBookingResult.payment.amount)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {confirmedBookingResult.payment && (
                  <Button
                    onClick={() => {
                      setReceiptPaymentId(confirmedBookingResult.payment.id);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs gap-1.5 h-9"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Advance Receipt
                  </Button>
                )}

                {!confirmedBookingResult.payment && (
                  <Button
                    onClick={() => {
                      setIsCreateOpen(false);
                      handleOpenPaymentModal(confirmedBookingResult);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs gap-1.5 h-9"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Collect Payment Now
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setInspectingBookingId(confirmedBookingResult.id);
                  }}
                  className="text-xs h-9"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  View Details
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirmedBookingResult(null);
                    setSelectedCustomer(null);
                    setSelectedCopies([]);
                    setBookingNotes('');
                    setAdvancePaymentAmount('');
                  }}
                  className="text-xs h-9"
                >
                  Create Another Reservation
                </Button>
              </div>
            </div>
          ) : (
            /* Main Form: Two Column Layout on Desktop */
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Workspace */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {createBookingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{createBookingError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* LEFT COLUMN: ~60% (7 cols) - Booking Info, Customer & Items Catalog */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* SECTION 1: BOOKING DETAILS & CUSTOMER */}
                    <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 space-y-3.5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                          1. Reservation Details & Schedule
                        </span>
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          <Clock className="w-3 h-3 text-primary" />
                          {calculateDurationDays(pickupDate, returnDate)} Days Duration
                        </div>
                      </div>

                      {/* Branch and Schedule Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {activeBranches.length > 1 ? (
                          <div className="sm:col-span-1">
                            <Label className="text-[11px] font-semibold text-slate-700">Branch *</Label>
                            <Select value={bookingBranchId} onValueChange={setBookingBranchId}>
                              <SelectTrigger className="h-8 text-xs bg-white mt-1 border-slate-200">
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
                          </div>
                        ) : (
                          <div className="sm:col-span-1">
                            <Label className="text-[11px] font-semibold text-slate-700">Branch *</Label>
                            <div className="h-8 px-2.5 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-between text-xs text-slate-700 font-medium mt-1">
                              <span>{activeBranches[0]?.name || 'Main Branch'}</span>
                              <span className="text-[10px] text-slate-400">Assigned</span>
                            </div>
                          </div>
                        )}

                        <div className="sm:col-span-1">
                          <Label htmlFor="pickupDate" className="text-[11px] font-semibold text-slate-700">
                            Pickup Date *
                          </Label>
                          <Input
                            id="pickupDate"
                            type="date"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            className="h-8 text-xs bg-white mt-1 border-slate-200"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <Label htmlFor="returnDate" className="text-[11px] font-semibold text-slate-700">
                            Expected Return Date *
                          </Label>
                          <Input
                            id="returnDate"
                            type="date"
                            value={returnDate}
                            min={pickupDate}
                            onChange={(e) => setReturnDate(e.target.value)}
                            className="h-8 text-xs bg-white mt-1 border-slate-200"
                          />
                        </div>
                      </div>

                      {/* Customer Selection with Quick Add & Live Search */}
                      <div className="relative pt-1" ref={customerDropdownRef}>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[11px] font-semibold text-slate-700">
                            Customer <span className="text-red-500">*</span>
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsQuickCustomerOpen(!isQuickCustomerOpen);
                              setQuickCustomerError(null);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="h-5 text-[11px] text-primary p-0 font-medium hover:bg-transparent hover:underline"
                          >
                            {isQuickCustomerOpen ? 'Cancel Quick Add' : '+ Quick Add Customer'}
                          </Button>
                        </div>

                        {isQuickCustomerOpen ? (
                          /* Quick Add Customer Subform */
                          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-center pb-1 border-b border-primary/15">
                              <span className="text-xs font-bold text-slate-800">Quick Add Customer</span>
                            </div>

                            {quickCustomerError && (
                              <div className="p-1.5 bg-rose-50 text-rose-700 rounded text-[11px]">
                                {quickCustomerError}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] text-slate-700">Customer Name *</Label>
                                <Input
                                  placeholder="Full Name"
                                  value={quickCustomerName}
                                  onChange={(e) => setQuickCustomerName(e.target.value)}
                                  className="h-8 text-xs bg-white mt-0.5"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-slate-700">Phone Number *</Label>
                                <Input
                                  placeholder="07xxxxxxxx"
                                  value={quickCustomerPhone}
                                  onChange={(e) => setQuickCustomerPhone(e.target.value)}
                                  className="h-8 text-xs bg-white mt-0.5"
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!quickCustomerName.trim() || !quickCustomerPhone.trim() || quickCustomerMutation.isPending}
                              onClick={() =>
                                quickCustomerMutation.mutate({
                                  name: quickCustomerName,
                                  phone: quickCustomerPhone,
                                  email: quickCustomerEmail,
                                  notes: quickCustomerNotes,
                                })
                              }
                              className="w-full h-7 bg-primary hover:bg-primary/90 text-primary-foreground text-xs mt-1"
                            >
                              {quickCustomerMutation.isPending ? 'Saving...' : 'Save & Select Customer'}
                            </Button>
                          </div>
                        ) : (
                          /* Searchable Customer Input with Dropdown */
                          <div className="relative">
                            <div className="relative flex items-center">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <Input
                                placeholder="Search customer by name, phone, or code..."
                                value={customerSearch}
                                onChange={(e) => {
                                  setCustomerSearch(e.target.value);
                                  setIsCustomerDropdownOpen(true);
                                  if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                                    setSelectedCustomer(null);
                                  }
                                }}
                                onFocus={() => setIsCustomerDropdownOpen(true)}
                                className={cn(
                                  'h-8 pl-8 pr-16 text-xs bg-white border-slate-200 transition-colors',
                                  selectedCustomer && 'border-primary font-semibold text-slate-900 bg-primary/10/20'
                                )}
                              />
                              {selectedCustomer ? (
                                <div className="absolute right-1.5 flex items-center gap-1">
                                  <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                                    {selectedCustomer.phone || selectedCustomer.code || 'Selected'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCustomer(null);
                                      setCustomerSearch('');
                                      setIsCustomerDropdownOpen(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    title="Clear customer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : customerSearch ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerSearch('');
                                    setSelectedCustomer(null);
                                  }}
                                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>

                            {/* Floating Dropdown Results */}
                            {isCustomerDropdownOpen && !selectedCustomer && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                                {isLoadingCustomers ? (
                                  <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    Searching customers...
                                  </div>
                                ) : !customersData || customersData.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-500">
                                    <p>No customer found {customerSearch ? `for "${customerSearch}"` : ''}</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQuickCustomerName(customerSearch);
                                        setIsQuickCustomerOpen(true);
                                        setIsCustomerDropdownOpen(false);
                                      }}
                                      className="mt-1.5 text-xs text-primary hover:underline font-semibold"
                                    >
                                      + Quick Add {customerSearch ? `"${customerSearch}"` : 'Customer'}
                                    </button>
                                  </div>
                                ) : (
                                  customersData.map((c) => (
                                    <div
                                      key={c.id}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setSelectedCustomer(c);
                                        setCustomerSearch(`${c.name} (${c.phone || c.code || ''})`);
                                        setIsCustomerDropdownOpen(false);
                                      }}
                                      className="p-2.5 text-xs hover:bg-primary/10 cursor-pointer flex justify-between items-center transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                                          {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-slate-800">{c.name}</span>
                                          {c.phone && (
                                            <span className="text-slate-500 text-[11px] ml-1.5 font-mono">
                                              ({c.phone})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25">
                                        Select
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Internal Notes */}
                      <div>
                        <Label htmlFor="bookingNotes" className="text-[11px] font-semibold text-slate-700">
                          Internal Notes (Optional)
                        </Label>
                        <textarea
                          id="bookingNotes"
                          rows={1}
                          placeholder="Event remarks, special fitting notes..."
                          value={bookingNotes}
                          onChange={(e) => setBookingNotes(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary mt-1 resize-none bg-white"
                        />
                      </div>
                    </div>

                    {/* SECTION 2: SELECT CATEGORY & ITEM DROPDOWN DESIGN */}
                    <div className="border border-slate-200/90 rounded-xl p-4 bg-white shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                            2. Select Rental Item
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                            {availabilityItems.length} in catalog
                          </span>
                        </div>
                        {displayedItems.length > 0 && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'} available
                          </span>
                        )}
                      </div>

                      {/* Side-by-Side Category and Rental Item Dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Dropdown 1: Category */}
                        <div className="sm:col-span-5 space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Category</Label>
                          <Select
                            value={availCategory}
                            onValueChange={(val) => {
                              setAvailCategory(val);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs bg-white border-slate-200 hover:border-slate-300 focus:ring-1 focus:ring-primary">
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="all">All Categories ({availabilityItems.length})</SelectItem>
                              {categoryOptions.map((cat) => {
                                const countInCat = availabilityItems.filter((i) => i.category === cat).length;
                                return (
                                  <SelectItem key={cat} value={cat}>
                                    {cat} {countInCat > 0 ? `(${countInCat})` : ''}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Dropdown 2: Rental Item */}
                        <div className="sm:col-span-7 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-semibold text-slate-700">Rental Item</Label>
                            {availSearch && (
                              <button
                                type="button"
                                onClick={() => setAvailSearch('')}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Clear search
                              </button>
                            )}
                          </div>
                          <Select
                            value={activeSelectedItem?.id || ''}
                            onValueChange={(val) => setSelectedRentalItemId(val)}
                            disabled={isLoadingAvailability || displayedItems.length === 0}
                          >
                            <SelectTrigger className="h-9 text-xs bg-white border-slate-200 hover:border-slate-300 focus:ring-1 focus:ring-primary font-medium">
                              <SelectValue
                                placeholder={
                                  isLoadingAvailability
                                    ? 'Loading available items...'
                                    : displayedItems.length === 0
                                    ? 'No items found'
                                    : 'Select an item'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {displayedItems.map((item) => {
                                const availCount = item.units.filter((u) => u.isAvailable).length;
                                const selectedCount = selectedCopies.filter((c) => c.rentalItemId === item.id).length;
                                return (
                                  <SelectItem key={item.id} value={item.id} className="py-2 text-xs">
                                    <div className="flex items-center justify-between gap-2.5 w-full">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                                        <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200/50">
                                          {item.code}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                        <span className="font-medium text-slate-700">{formatMoneyLkr(item.rentPrice)}</span>
                                        <span
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                            availCount > 0
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                                          }`}
                                        >
                                          {availCount}/{item.units.length} avail
                                        </span>
                                        {selectedCount > 0 && (
                                          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded-full">
                                            {selectedCount} selected
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Optional Search / Quick Filter Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <Input
                          placeholder="Quick search by item name or code..."
                          value={availSearch}
                          onChange={(e) => setAvailSearch(e.target.value)}
                          className="h-7 pl-8 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white"
                        />
                      </div>

                      {/* Selected Item Details & Physical Copy Pills */}
                      {isLoadingAvailability ? (
                        <div className="py-8">
                          <OpsLoading message="Checking availability for dates..." />
                        </div>
                      ) : !activeSelectedItem ? (
                        <div className="py-8 text-center text-xs text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          <p className="font-semibold text-slate-700">No rental items available</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Try changing the selected category, search keyword, or booking dates.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40 space-y-3">
                          {/* Item Summary Header */}
                          <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">{activeSelectedItem.name}</span>
                                <span className="font-mono text-purple-700 bg-purple-50 text-[10px] px-1.5 py-0.5 rounded font-bold border border-purple-200/60">
                                  {activeSelectedItem.code}
                                </span>
                                <span className="text-[10px] bg-white text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                                  {activeSelectedItem.category}
                                </span>
                                {(activeSelectedItem.size || activeSelectedItem.color) && (
                                  <span className="text-xs text-slate-500">
                                    {[
                                      activeSelectedItem.size && `Size: ${activeSelectedItem.size}`,
                                      activeSelectedItem.color && `Color: ${activeSelectedItem.color}`,
                                    ]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-slate-900 text-xs">
                                {formatMoneyLkr(activeSelectedItem.rentPrice)}
                                <span className="text-[10px] font-normal text-slate-500"> / booking</span>
                              </div>
                              <div className="text-indigo-600 text-[10px] font-medium">
                                Deposit: {formatMoneyLkr(activeSelectedItem.deposit)}
                              </div>
                            </div>
                          </div>

                          {/* Physical Unit Pills Selection */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700">
                                Select Physical Copies:
                                <span className="ml-1 text-[10px] font-normal text-slate-500">
                                  ({activeSelectedItem.units.filter((u) => u.isAvailable).length} available of{' '}
                                  {activeSelectedItem.units.length} total)
                                </span>
                              </span>
                              <div className="flex items-center gap-2">
                                {activeSelectedItem.units.some(
                                  (u) => u.isAvailable && !selectedCopies.some((c) => c.unitId === u.id)
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllItemCopies(activeSelectedItem)}
                                    className="text-[10px] text-primary hover:underline font-semibold"
                                  >
                                    + Select All Available
                                  </button>
                                )}
                                {activeSelectedItem.units.some((u) => selectedCopies.some((c) => c.unitId === u.id)) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeselectAllItemCopies(activeSelectedItem)}
                                    className="text-[10px] text-rose-600 hover:underline font-semibold"
                                  >
                                    Deselect Item Copies
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {activeSelectedItem.units.map((unit) => {
                                const isSelected = selectedCopies.some((c) => c.unitId === unit.id);
                                return (
                                  <button
                                    key={unit.id}
                                    type="button"
                                    disabled={!unit.isAvailable}
                                    onClick={() => handleToggleCopy(activeSelectedItem, unit)}
                                    title={unit.conflictReason || 'Click to select copy'}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border shadow-2xs ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/20 font-bold'
                                        : unit.isAvailable
                                        ? 'bg-white hover:bg-primary/5 text-primary border-primary/40 hover:border-primary font-semibold'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed opacity-60'
                                    }`}
                                  >
                                    {isSelected ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                                        <span>{unit.unitCode}</span>
                                        <span className="text-[10px] opacity-90 font-sans font-medium">Selected</span>
                                      </>
                                    ) : unit.isAvailable ? (
                                      <>
                                        <Plus className="w-3 h-3 text-primary stroke-[2]" />
                                        <span>{unit.unitCode}</span>
                                        <span className="text-[10px] opacity-75 font-sans font-normal">Available</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>{unit.unitCode}</span>
                                        <span className="text-[10px] opacity-75 font-sans font-normal">
                                          {unit.status === 'MAINTENANCE'
                                            ? 'Maintenance'
                                            : unit.status === 'CLEANING'
                                            ? 'Cleaning'
                                            : unit.status === 'RENTED'
                                            ? 'Rented'
                                            : 'Booked'}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: ~40% (5 cols) - Dedicated Selected Items & Advance Payment */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* SECTION 3: DEDICATED SELECTED ITEMS PANEL */}
                    <div className="border border-slate-200/90 rounded-xl p-4 bg-white shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Selected Copies ({selectedCopies.length})
                          </span>
                        </div>
                        {selectedCopies.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCopies([])}
                            className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline font-medium"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {/* Selected Items List */}
                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                        {selectedCopies.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="font-semibold text-slate-600">No copies selected yet</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Click unit pills from the catalog on the left to add items.
                            </p>
                          </div>
                        ) : (
                          selectedCopies.map((c) => (
                            <div key={c.unitId} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-purple-700 text-[11px] bg-purple-50 px-1 rounded">
                                    {c.unitCode}
                                  </span>
                                  <span className="font-semibold text-slate-900 truncate">{c.itemName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Rent: <span className="font-medium text-slate-700">{formatMoneyLkr(c.rentPrice)}</span> • Dep: <span className="font-medium text-indigo-700">{formatMoneyLkr(c.deposit)}</span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCopies((prev) => prev.filter((p) => p.unitId !== c.unitId))}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* FINANCIAL SUMMARY MATRIX */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total Rental Charge:</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {formatMoneyLkr(bookingTotals.totalRent)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-indigo-700">
                        <div>
                          <span className="font-semibold">Refundable Security Deposit:</span>
                          <span className="text-[10px] text-slate-400 block font-normal">Held in trust • Refunded on return</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">LKR</span>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            placeholder="0"
                            value={customSecurityDeposit}
                            onChange={(e) => setCustomSecurityDeposit(e.target.value)}
                            className="w-24 h-7 text-xs text-right font-bold text-indigo-700 border-indigo-200 bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                        <span>Grand Total Value:</span>
                        <span className="text-base text-primary">
                          {formatMoneyLkr(bookingTotals.grandTotal)}
                        </span>
                      </div>
                    </div>

                    {/* ADVANCE PAYMENT PANEL (Simplified, No Sub-Categories) */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 text-xs shadow-xs">
                      <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-primary" />
                          Advance Payment (Optional)
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                          Optional
                        </span>
                      </div>

                      {/* Unified Advance Payment Input */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="advancePaymentAmount" className="text-[11px] font-semibold text-slate-700">
                            Advance Payment Amount (LKR)
                          </Label>
                          {bookingTotals.grandTotal > 0 && (
                            <button
                              type="button"
                              onClick={() => setAdvancePaymentAmount(String(bookingTotals.grandTotal))}
                              className="text-[10px] font-semibold text-primary hover:text-primary hover:underline"
                            >
                              Pay Full ({formatMoneyLkr(bookingTotals.grandTotal)})
                            </button>
                          )}
                        </div>
                        <Input
                          id="advancePaymentAmount"
                          type="number"
                          min="0"
                          step="100"
                          placeholder="0.00"
                          value={advancePaymentAmount}
                          onChange={(e) => setAdvancePaymentAmount(e.target.value)}
                          className="h-8.5 text-xs bg-white mt-1 border-slate-200 font-semibold"
                        />
                      </div>

                      {/* Payment Method fields if payment collected */}
                      {totalCollectedNow > 0 && (
                        <div className="space-y-2 pt-2 border-t border-primary/20">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px] text-slate-700 font-semibold">Payment Method *</Label>
                              <Select
                                value={advancePaymentMethod}
                                onValueChange={(val: RentalPaymentMethod) => setAdvancePaymentMethod(val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white mt-0.5 border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CASH">Cash</SelectItem>
                                  <SelectItem value="CARD">Card</SelectItem>
                                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                  <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[11px] text-slate-700">Reference # (Optional)</Label>
                              <Input
                                placeholder="Slip / Txn Ref"
                                value={advanceReferenceNumber}
                                onChange={(e) => setAdvanceReferenceNumber(e.target.value)}
                                className="h-8 text-xs bg-white mt-0.5 border-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Clean Financial Calculation Summary */}
                      <div className="bg-white p-3 rounded-lg border border-primary/20 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Advance Paid Now:</span>
                          <span className="font-semibold text-primary">{formatMoneyLkr(totalCollectedNow)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Remaining Balance:</span>
                          <span className={remainingBalance > 0 ? 'font-bold text-amber-700' : 'font-semibold text-primary'}>
                            {formatMoneyLkr(remainingBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-slate-100 font-bold text-slate-900 text-sm">
                          <span>Total Cash Collected Now:</span>
                          <span className="text-primary">{formatMoneyLkr(totalCollectedNow)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STICKY BOTTOM CONFIRMATION FOOTER */}
              <div className="px-6 py-3.5 bg-slate-50/90 backdrop-blur-sm border-t border-slate-200/80 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Copies</span>
                    <span className="font-bold text-slate-900">{selectedCopies.length} items</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Rent Total</span>
                    <span className="font-bold text-slate-900">{formatMoneyLkr(bookingTotals.totalRent)}</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-primary block text-[10px] uppercase font-bold">Collected Now</span>
                    <span className="font-extrabold text-primary">{formatMoneyLkr(totalCollectedNow)}</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-amber-700 block text-[10px] uppercase font-semibold">Rental Balance</span>
                    <span className="font-bold text-amber-700">{formatMoneyLkr(remainingBalance)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-xs h-9 px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedCustomer || selectedCopies.length === 0 || createBookingMutation.isPending}
                    onClick={() => createBookingMutation.mutate()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 h-9 gap-1.5 shadow-sm"
                  >
                    {createBookingMutation.isPending ? (
                      'Reserving...'
                    ) : totalCollectedNow > 0 ? (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Confirm & Collect {formatMoneyLkr(totalCollectedNow)}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm Reservation ({selectedCopies.length} items)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BOOKING DETAILS DIALOG                                                    */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(inspectingBookingId)}
        onOpenChange={(open) => !open && setInspectingBookingId(null)}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Booking Details
                </DialogTitle>
                {inspectingBooking && (
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    Ref: {inspectingBooking.bookingReference}
                  </p>
                )}
              </div>
              {inspectingBooking && (
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    inspectingBooking.status === 'RESERVED'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : inspectingBooking.status === 'PICKED_UP'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : inspectingBooking.status === 'RETURNED'
                          ? 'bg-primary/10 text-primary border border-primary/25'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {inspectingBooking.status}
                </span>
              )}
            </div>
          </DialogHeader>

          {isLoadingInspecting ? (
            <OpsLoading />
          ) : !inspectingBooking ? (
            <p className="text-sm text-slate-500 py-6 text-center">Booking not found.</p>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Pickup / Handover Details Banner if PICKED_UP */}
              {inspectingBooking.status === 'PICKED_UP' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1 text-blue-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <PackageCheck className="w-4 h-4 text-blue-600" />
                    Handover Confirmed — Items Picked Up
                  </div>
                  <p className="text-slate-700">
                    Handed over on <strong>{formatDisplayDateTime(inspectingBooking.actualPickupAt)}</strong>
                    {inspectingBooking.pickedUpByName && <span> by staff <strong>{inspectingBooking.pickedUpByName}</strong></span>}.
                  </p>
                  {inspectingBooking.pickupNotes && (
                    <p className="text-slate-600 italic">Condition notes: {inspectingBooking.pickupNotes}</p>
                  )}
                </div>
              )}

              {/* Customer and Schedule Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-400 uppercase">Customer Information</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm">{inspectingBooking.customerName}</p>
                    {inspectingBooking.customerCode && (
                      <span className="text-xs text-purple-700 bg-purple-50 font-mono font-semibold px-1.5 py-0.5 rounded border border-purple-200/60">
                        ID: {inspectingBooking.customerCode}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600">{inspectingBooking.customerPhone || 'No phone'}</p>
                  {inspectingBooking.customerEmail && (
                    <p className="text-slate-500">{inspectingBooking.customerEmail}</p>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-400 uppercase">Rental Schedule</span>
                  <p className="font-bold text-slate-900 text-sm">
                    {formatDisplayDate(inspectingBooking.pickupDate)} → {formatDisplayDate(inspectingBooking.returnDate)}
                  </p>
                  <p className="text-primary font-semibold">
                    {calculateDurationDays(inspectingBooking.pickupDate, inspectingBooking.returnDate)} days rental
                  </p>
                  <p className="text-slate-500">Branch: {inspectingBooking.branchName || '-'}</p>
                </div>
              </div>

              {/* Reserved Copies Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Reserved Physical Copies ({inspectingBooking.itemCount})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {inspectingBooking.items?.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-start justify-between text-xs hover:bg-slate-50/50 gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{item.itemName}</span>
                          {item.itemCode && (
                            <span className="font-mono text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                              Item: {item.itemCode}
                            </span>
                          )}
                          {item.itemCategory && (
                            <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {item.itemCategory}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-mono text-xs flex-wrap">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            Unit Code: {item.unitCode}
                          </span>
                          {item.unitNumber && (
                            <span className="text-slate-400 font-sans text-[11px]">(Copy #{item.unitNumber})</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatMoneyLkr(item.rentPrice)}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Deposit: {formatMoneyLkr(item.deposit)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Status & Breakdown */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider">
                    Financial Settlement Status
                  </span>
                  {inspectingBooking.status !== 'CANCELLED' && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenPaymentModal(inspectingBooking)}
                      className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Collect Payment
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[11px] uppercase font-semibold block">Rental Fee (Revenue)</span>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {formatMoneyLkr(inspectingBooking.totalRent)}
                    </div>
                    {inspectingBooking.financials && (
                      <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Paid:</span>
                          <span className="font-semibold text-primary">{formatMoneyAmount(inspectingBooking.financials.paidRent)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Balance:</span>
                          <span className={inspectingBooking.financials.remainingRent > 0 ? 'font-bold text-amber-700' : 'font-semibold text-primary'}>
                            {formatMoneyAmount(inspectingBooking.financials.remainingRent)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-indigo-200">
                    <span className="text-indigo-700 text-[11px] uppercase font-semibold block">Security Deposit (Refundable)</span>
                    <div className="font-bold text-indigo-900 text-sm mt-0.5">
                      {formatMoneyLkr(inspectingBooking.totalDeposit)}
                    </div>
                    {inspectingBooking.financials && (
                      <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Held:</span>
                          <span className="font-semibold text-indigo-700">{formatMoneyAmount(inspectingBooking.financials.heldDeposit)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Deficit:</span>
                          <span className={inspectingBooking.financials.remainingDeposit > 0 ? 'font-bold text-rose-600' : 'font-semibold text-primary'}>
                            {formatMoneyAmount(inspectingBooking.financials.remainingDeposit)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment History for this Booking */}
              {inspectingBooking.payments && inspectingBooking.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Payment Transaction History ({inspectingBooking.payments.length})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {inspectingBooking.payments.map((p) => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-700">{p.paymentNumber}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {p.paymentMethod.replace('_', ' ')}
                            </span>
                            <span className="text-slate-400 text-[11px]">{formatDisplayDateTime(p.createdAt)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Rent: {formatMoneyLkr(p.rentAmount)} | Deposit: {formatMoneyLkr(p.depositAmount)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{formatMoneyLkr(p.amount)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReceiptPaymentId(p.id)}
                            className="h-7 text-[11px] text-slate-700 gap-1 px-2"
                          >
                            <Printer className="w-3 h-3" /> Receipt
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {(inspectingBooking.status === 'PICKED_UP' || inspectingBooking.status === 'PARTIALLY_RETURNED') && (
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = '/salon/rentals/returns';
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Process Return & Settlement
                  </Button>
                )}
                {inspectingBooking.status === 'RESERVED' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleOpenPickupModal(inspectingBooking)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      Confirm Pickup / Handover
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCancellingBooking(inspectingBooking);
                        setCancellationReason('');
                        setInspectingBookingId(null);
                      }}
                      className="text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                    >
                      Cancel Booking
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectingBookingId(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* CONFIRM PICKUP / HANDOVER MODAL                                           */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(pickupBooking)}
        onOpenChange={(open) => !open && setPickupBooking(null)}
      >
        <DialogContent className="max-w-lg sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-primary" />
              Confirm Item Handover & Pickup
            </DialogTitle>
          </DialogHeader>

          {pickupBooking && (() => {
            const remRent = pickupBooking.financials ? Number(pickupBooking.financials.remainingRent || 0) : Number(pickupBooking.totalRent || 0);
            const remDep = pickupBooking.financials ? Number(pickupBooking.financials.remainingDeposit || 0) : Number(pickupBooking.totalDeposit || 0);
            const totalRemaining = remRent + remDep;
            const payAmountNum = parseFloat(pickupPaymentAmount);
            const isPaying = !isNaN(payAmountNum) && payAmountNum > 0;

            return (
              <div className="space-y-4 pt-1 text-xs">
                {pickupError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{pickupError}</span>
                  </div>
                )}

                {/* Booking & Customer Quick Summary Card */}
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Booking Reference</span>
                    <span className="font-mono font-bold text-slate-900">{pickupBooking.bookingReference}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Customer</span>
                    <span className="font-semibold text-slate-900 truncate block">{pickupBooking.customerName}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Scheduled Return Date:</span>
                    <span className="font-semibold text-slate-800">{formatDisplayDate(pickupBooking.returnDate)}</span>
                  </div>
                </div>

                {/* Financial Balance & Payment Choice */}
                {totalRemaining > 0 ? (
                  <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Outstanding Rental Balance
                        </span>
                        <span className="text-base font-extrabold text-slate-900">
                          {formatMoneyLkr(totalRemaining)}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                        Due on Return
                      </span>
                    </div>

                    {/* Segmented Choice: Pay on Return (Default) vs Pay Now */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCollectingPaymentAtPickup(false);
                          setPickupPaymentAmount('');
                        }}
                        className={`p-2.5 rounded-lg text-left border transition-all ${
                          !isCollectingPaymentAtPickup
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            !isCollectingPaymentAtPickup ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                          }`}>
                            {!isCollectingPaymentAtPickup && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="text-xs font-semibold">Pay on Return</span>
                        </div>
                        <p className="text-[10px] font-normal opacity-75 mt-0.5 pl-5">
                          Collect when returned
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCollectingPaymentAtPickup(true);
                          setPickupPaymentAmount(String(totalRemaining));
                        }}
                        className={`p-2.5 rounded-lg text-left border transition-all ${
                          isCollectingPaymentAtPickup
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isCollectingPaymentAtPickup ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                          }`}>
                            {isCollectingPaymentAtPickup && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="text-xs font-semibold">Pay Now</span>
                        </div>
                        <p className="text-[10px] font-normal opacity-75 mt-0.5 pl-5">
                          Collect at handover
                        </p>
                      </button>
                    </div>

                    {/* Pay Now Expanded Form */}
                    {isCollectingPaymentAtPickup && (
                      <div className="pt-2.5 border-t border-slate-200/80 space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="pickupPayAmount" className="text-[11px] font-semibold text-slate-700">
                              Payment Amount (LKR) *
                            </Label>
                            <Input
                              id="pickupPayAmount"
                              type="number"
                              min="0"
                              step="100"
                              value={pickupPaymentAmount}
                              onChange={(e) => setPickupPaymentAmount(e.target.value)}
                              className="h-8 text-xs bg-white mt-1 border-slate-200 font-bold text-slate-900"
                            />
                          </div>

                          <div>
                            <Label className="text-[11px] font-semibold text-slate-700">Payment Method *</Label>
                            <Select
                              value={pickupPaymentMethod}
                              onValueChange={(val: RentalPaymentMethod) => setPickupPaymentMethod(val)}
                            >
                              <SelectTrigger className="h-8 text-xs bg-white mt-1 border-slate-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CASH">Cash</SelectItem>
                                <SelectItem value="CARD">Card</SelectItem>
                                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="pickupPayRef" className="text-[10px] text-slate-600">
                            Reference / Slip # (Optional)
                          </Label>
                          <Input
                            id="pickupPayRef"
                            placeholder="e.g. Receipt # / Bank Transfer Ref"
                            value={pickupPaymentRef}
                            onChange={(e) => setPickupPaymentRef(e.target.value)}
                            className="h-7 text-xs bg-white mt-0.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-xs">Rental charges and deposit are fully settled!</span>
                  </div>
                )}

                {/* Form Inputs */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="actualPickupDate" className="text-xs font-semibold text-slate-700">
                      Actual Pickup Date *
                    </Label>
                    <Input
                      id="actualPickupDate"
                      type="date"
                      value={actualPickupDate}
                      onChange={(e) => setActualPickupDate(e.target.value)}
                      className="mt-1 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="conditionOut" className="text-xs font-semibold text-slate-700">
                      Item Condition at Handover (Optional)
                    </Label>
                    <Input
                      id="conditionOut"
                      placeholder="e.g. Inspected with customer, no damages or stains"
                      value={conditionOut}
                      onChange={(e) => setConditionOut(e.target.value)}
                      className="mt-1 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pickupNotes" className="text-xs font-semibold text-slate-700">
                      Staff Handover Notes (Optional)
                    </Label>
                    <Input
                      id="pickupNotes"
                      placeholder="e.g. Identity verified, agreement signed"
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      className="mt-1 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickupBooking(null)}
                    className="text-xs h-8.5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmPickupMutation.isPending}
                    onClick={() => {
                      confirmPickupMutation.mutate({
                        id: pickupBooking.id,
                        payload: {
                          actualPickupDate,
                          pickupNotes,
                          conditionOut,
                          allowPendingDeposit: true,
                          payment: isPaying && isCollectingPaymentAtPickup
                            ? {
                                amount: payAmountNum,
                                paymentMethod: pickupPaymentMethod,
                                referenceNumber: pickupPaymentRef.trim() || undefined,
                              }
                            : undefined,
                        },
                      });
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-sm h-8.5 px-4"
                  >
                    {confirmPickupMutation.isPending ? (
                      'Processing...'
                    ) : isPaying && isCollectingPaymentAtPickup ? (
                      <>
                        <CreditCard className="w-3.5 h-3.5" />
                        Pay {formatMoneyLkr(payAmountNum)} & Confirm
                      </>
                    ) : (
                      <>
                        <PackageCheck className="w-3.5 h-3.5" />
                        Confirm Handover
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* COLLECT PAYMENT MODAL (FROM BOOKINGS PAGE)                                */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(paymentBooking)}
        onOpenChange={(open) => !open && setPaymentBooking(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Collect Payment — {paymentBooking?.bookingReference}
            </DialogTitle>
          </DialogHeader>

          {paymentBooking && (
            <form onSubmit={handleSubmitPaymentModal} className="space-y-4 pt-1 text-xs">
              {payError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">{paymentBooking.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining Rent:</span>
                  <span className="font-bold text-slate-900">
                    {formatMoneyLkr(paymentBooking.financials?.remainingRent ?? paymentBooking.totalRent)}
                  </span>
                </div>
                <div className="flex justify-between text-indigo-700">
                  <span>Remaining Deposit Needed:</span>
                  <span className="font-bold">
                    {formatMoneyLkr(paymentBooking.financials?.remainingDeposit ?? paymentBooking.totalDeposit)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Rent Amount (LKR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payRentAmount}
                    onChange={(e) => setPayRentAmount(e.target.value)}
                    className="mt-1 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-indigo-700">Deposit Amount (LKR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payDepositAmount}
                    onChange={(e) => setPayDepositAmount(e.target.value)}
                    className="mt-1 text-xs bg-white border-indigo-200"
                  />
                </div>
              </div>

              <div className="p-2 bg-primary/10 rounded-lg border border-primary/25 flex justify-between items-center">
                <span className="font-semibold text-primary">Total Payment:</span>
                <span className="text-base font-bold text-primary">
                  {formatMoneyLkr((parseFloat(payRentAmount) || 0) + (parseFloat(payDepositAmount) || 0))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Method *</Label>
                  <Select value={payMethod} onValueChange={(val) => setPayMethod(val as RentalPaymentMethod)}>
                    <SelectTrigger className="mt-1 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Reference #</Label>
                  <Input
                    placeholder="Slip / Trans #"
                    value={payRefNum}
                    onChange={(e) => setPayRefNum(e.target.value)}
                    className="mt-1 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentBooking(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={collectPaymentMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
                >
                  {collectPaymentMutation.isPending ? 'Processing...' : 'Confirm Payment'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* PRINTABLE RECEIPT MODAL                                                    */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(receiptPaymentId)}
        onOpenChange={(open) => !open && setReceiptPaymentId(null)}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-600" />
                Payment Receipt
              </span>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-8 mr-6"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </Button>
            </DialogTitle>
          </DialogHeader>

          {isLoadingReceipt ? (
            <div className="py-12">
              <OpsLoading />
            </div>
          ) : !receiptPayment ? (
            <p className="text-sm text-slate-500 py-8 text-center">Receipt not found.</p>
          ) : (
            <div id="printable-booking-receipt" className="space-y-4 p-2 text-slate-800 text-xs font-sans">
              <div className="text-center border-b border-slate-300 pb-3 space-y-1">
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                  {receiptPayment.branch?.name || receiptPayment.branchName || 'Smart Salon Rentals'}
                </h2>
                {receiptPayment.branch?.address && (
                  <p className="text-slate-500 text-[11px]">{receiptPayment.branch.address}</p>
                )}
                {receiptPayment.branch?.phone && (
                  <p className="text-slate-500 text-[11px]">Tel: {receiptPayment.branch.phone}</p>
                )}
                <div className="pt-1">
                  <span className="font-bold text-xs uppercase tracking-widest text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">
                    Official Rental Payment Receipt
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block">Receipt Number</span>
                    <span className="font-mono font-bold text-slate-900">{receiptPayment.paymentNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block">Booking Reference</span>
                    <span className="font-mono font-semibold text-slate-800">{receiptPayment.bookingReference}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block">Date & Time</span>
                    <span className="text-slate-700">{formatDisplayDateTime(receiptPayment.createdAt)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block">Customer</span>
                    <span className="font-bold text-slate-900">{receiptPayment.customerName}</span>
                  </div>
                  {receiptPayment.customerPhone && (
                    <div>
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Phone</span>
                      <span className="text-slate-700 font-mono">{receiptPayment.customerPhone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block">Cashier / Staff</span>
                    <span className="text-slate-700">{receiptPayment.receiverName || 'Staff'}</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
                <h4 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  Payment Allocation Breakdown
                </h4>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span>Rental Charge Allocation:</span>
                    <span className="font-semibold text-slate-900">{formatMoneyLkr(receiptPayment.rentAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refundable Security Deposit:</span>
                    <span className="font-semibold text-indigo-700">{formatMoneyLkr(receiptPayment.depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Paid:</span>
                    <span className="text-primary">{formatMoneyLkr(receiptPayment.amount)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex justify-between">
                  <span>Method: <strong className="text-slate-800">{receiptPayment.paymentMethod.replace('_', ' ')}</strong></span>
                  {receiptPayment.referenceNumber && (
                    <span>Ref: <strong className="text-slate-800">{receiptPayment.referenceNumber}</strong></span>
                  )}
                </div>
              </div>

              {/* ACCOUNT / BOOKING BALANCE SUMMARY */}
              <div className="border border-purple-200/80 rounded-lg p-3 bg-purple-50/40 space-y-2">
                <div className="flex items-center justify-between border-b border-purple-200/60 pb-1.5">
                  <h4 className="text-[11px] font-bold uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    Account & Booking Balance Summary
                  </h4>
                  <span className="text-[10px] font-mono text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-semibold">
                    {receiptPayment.bookingReference}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Rental Charge:</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoneyLkr(receiptPayment.booking?.totalRent ?? 0)}
                    </span>
                  </div>
                  {((receiptPayment.booking?.totalDeposit ?? 0) > 0) && (
                    <div className="flex justify-between text-indigo-700">
                      <span>Required Security Deposit:</span>
                      <span className="font-semibold">
                        {formatMoneyLkr(receiptPayment.booking?.totalDeposit ?? 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Total Booking Value:</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoneyLkr(
                        receiptPayment.booking?.financials?.grandTotal ??
                        ((receiptPayment.booking?.totalRent ?? 0) +
                         (receiptPayment.booking?.totalDeposit ?? 0))
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Paid to Date:</span>
                    <span className="font-semibold text-emerald-700">
                      {formatMoneyLkr(receiptPayment.booking?.financials?.totalPaid ?? receiptPayment.amount)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-purple-200/70 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Outstanding Rental Balance:</span>
                      <span className={`font-bold ${
                        (receiptPayment.booking?.financials?.remainingRent ?? 0) > 0
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {formatMoneyLkr(receiptPayment.booking?.financials?.remainingRent ?? 0)}
                      </span>
                    </div>

                    {(receiptPayment.booking?.financials?.remainingDeposit ?? 0) > 0 && (
                      <div className="flex justify-between items-center text-indigo-700">
                        <span className="font-medium">Remaining Deposit Due:</span>
                        <span className="font-bold">
                          {formatMoneyLkr(receiptPayment.booking?.financials?.remainingDeposit ?? 0)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5 border-t border-purple-200 font-bold text-sm">
                      <span className="text-slate-900">Net Balance Due:</span>
                      <div className="flex items-center gap-2">
                        {(receiptPayment.booking?.financials?.totalBalance ?? 0) <= 0 ? (
                          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                            ✓ Fully Settled
                          </span>
                        ) : (
                          <span className="text-sm font-extrabold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300">
                            {formatMoneyLkr(receiptPayment.booking?.financials?.totalBalance ?? 0)} Due
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-lg text-[11px] text-indigo-900">
                <span className="font-bold">Notice regarding Security Deposits:</span> The security deposit is held in trust as a refundable bond and does not form part of salon rental revenue. It is returned upon inspection when items are returned in good condition.
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 pb-2 text-center text-xs">
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-500">Authorized Signature</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-500">Customer Signature</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptPaymentId(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* CANCELLATION CONFIRMATION DIALOG                                          */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(cancellingBooking)}
        onOpenChange={(open) => !open && setCancellingBooking(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Cancel Rental Booking
            </DialogTitle>
          </DialogHeader>

          {cancellingBooking && (
            <div className="space-y-4 pt-2 text-sm text-slate-600">
              <p>
                Are you sure you want to cancel booking{' '}
                <strong className="text-slate-900 font-mono">
                  {cancellingBooking.bookingReference}
                </strong>{' '}
                for <strong className="text-slate-900">{cancellingBooking.customerName}</strong>?
              </p>

              <div>
                <Label htmlFor="cancelReason" className="text-xs font-semibold text-slate-700">
                  Reason for Cancellation (Optional)
                </Label>
                <Input
                  id="cancelReason"
                  placeholder="e.g. Customer cancelled event, changed dates"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="mt-1 text-sm bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancellingBooking(null)}
                  className="text-xs"
                >
                  Keep Booking
                </Button>
                <Button
                  size="sm"
                  disabled={cancelBookingMutation.isPending}
                  onClick={() =>
                    cancelBookingMutation.mutate({
                      id: cancellingBooking.id,
                      reason: cancellationReason.trim() || undefined,
                    })
                  }
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  {cancelBookingMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
