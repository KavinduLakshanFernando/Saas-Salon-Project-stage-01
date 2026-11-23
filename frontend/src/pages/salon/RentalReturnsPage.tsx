import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Printer,
  Clock,
  ShieldCheck,
  Receipt,
  RotateCcw,
  DollarSign,
  AlertTriangle,
  Layers,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  tenantApi,
  type PendingRentalReturn,
  type RentalItemCondition,
  type RentalPaymentMethod,
} from '@/api/tenant.api';
import { useSalonBranch } from '@/contexts/SalonBranchContext';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { formatMoneyLkr, formatMoneyAmount } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

function formatDisplayDate(isoStr?: string | Date | null): string {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ItemReturnDraft {
  bookingItemId: string;
  selected: boolean;
  unitCode: string;
  itemName: string;
  conditionOut: string | null;
  conditionIn: RentalItemCondition;
  inspectionNotes: string;
  lateFee: number;
  damageCharge: number;
  requiresMaintenance: boolean;
  alreadyReturned: boolean;
}

export default function RentalReturnsPage() {
  const queryClient = useQueryClient();
  const { branchId: activeBranchId, isAllBranches, activeBranches } = useSalonBranch();

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search, 300, 1);
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 15;

  const effectiveBranchId = useMemo(() => {
    if (!isAllBranches && activeBranchId) return activeBranchId;
    return filterBranchId !== 'all' ? filterBranchId : undefined;
  }, [isAllBranches, activeBranchId, filterBranchId]);

  // Query: Returns Summary KPI
  const { data: summaryData } = useQuery({
    queryKey: ['rentalReturnsSummary', effectiveBranchId],
    queryFn: () => tenantApi.rentals.getReturnsSummary(effectiveBranchId),
  });

  // Query: Pending Returns List
  const {
    data: returnsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'rentalPendingReturns',
      page,
      limit,
      debouncedSearch,
      effectiveBranchId,
      filterStatus,
      overdueOnly,
      filterStartDate,
      filterEndDate,
    ],
    queryFn: () =>
      tenantApi.rentals.listReturns({
        page,
        limit,
        search: debouncedSearch || undefined,
        branchId: effectiveBranchId,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        overdueOnly: overdueOnly ? true : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      }),
  });

  // Modal States
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isProcessReturnOpen, setIsProcessReturnOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<PendingRentalReturn | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<RentalPaymentMethod>('CASH');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);

  // Return Processing Form State
  const [itemDrafts, setItemDrafts] = useState<ItemReturnDraft[]>([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnCollectPayment, setReturnCollectPayment] = useState<boolean>(true);
  const [returnPayAmount, setReturnPayAmount] = useState<string>('');
  const [returnPayMethod, setReturnPayMethod] = useState<RentalPaymentMethod>('CASH');
  const [returnPayRef, setReturnPayRef] = useState<string>('');
  const [returnPayNotes, setReturnPayNotes] = useState<string>('');

  // Settlement Form State
  const [refundMethod, setRefundMethod] = useState<RentalPaymentMethod>('CASH');
  const [settlementNotes, setSettlementNotes] = useState('');

  // Query: Return Details for selected booking
  const { data: returnDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['rentalReturnDetails', selectedBookingId],
    queryFn: () =>
      selectedBookingId ? tenantApi.rentals.getReturnDetails(selectedBookingId) : null,
    enabled: Boolean(selectedBookingId) && (isProcessReturnOpen || isSettlementOpen),
  });

  // Query: Booking Return History
  const { data: bookingHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['rentalBookingReturns', selectedBookingId],
    queryFn: () =>
      selectedBookingId ? tenantApi.rentals.getBookingReturns(selectedBookingId) : [],
    enabled: Boolean(selectedBookingId) && isHistoryOpen,
  });

  // Query: Return Receipt
  const { data: receiptData, isLoading: isLoadingReceipt } = useQuery({
    queryKey: ['rentalReturnReceipt', selectedReturnId],
    queryFn: () =>
      selectedReturnId ? tenantApi.rentals.getReturnReceipt(selectedReturnId) : null,
    enabled: Boolean(selectedReturnId) && isReceiptOpen,
  });

  // Populate Return Drafts when details load
  useEffect(() => {
    if (returnDetails?.items) {
      const isBookingOverdue =
        new Date() > new Date(returnDetails.returnDate) &&
        returnDetails.items.some((i: any) => i.returnStatus !== 'RETURNED');
      const overdueDays = isBookingOverdue
        ? Math.max(
            1,
            Math.ceil(
              (new Date().getTime() - new Date(returnDetails.returnDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

      const drafts: ItemReturnDraft[] = returnDetails.items.map((item: any) => {
        const alreadyReturned = item.returnStatus === 'RETURNED';
        return {
          bookingItemId: item.id,
          selected: !alreadyReturned,
          unitCode: item.unitCode,
          itemName: item.itemName,
          conditionOut: item.conditionOut,
          conditionIn: (item.conditionIn as RentalItemCondition) || 'GOOD',
          inspectionNotes: item.inspectionNotes || '',
          lateFee: alreadyReturned ? item.lateFee : overdueDays > 0 ? 0 : 0,
          damageCharge: item.damageCharge || 0,
          requiresMaintenance: item.requiresMaintenance || false,
          alreadyReturned,
        };
      });
      setItemDrafts(drafts);
      setReturnNotes('');

      if ((returnDetails.remainingRent ?? 0) > 0) {
        setReturnCollectPayment(true);
        setReturnPayAmount(String(returnDetails.remainingRent));
        setReturnPayMethod('CASH');
        setReturnPayRef('');
        setReturnPayNotes('Collected upon return');
      } else {
        setReturnCollectPayment(false);
        setReturnPayAmount('0');
        setReturnPayRef('');
        setReturnPayNotes('');
      }
    }
  }, [returnDetails]);

  // Mutations
  const processReturnMutation = useMutation({
    mutationFn: (payload: { bookingId: string; data: any }) =>
      tenantApi.rentals.processReturn(payload.bookingId, payload.data),
    onSuccess: (data) => {
      if (data?.payment) {
        toast.success(`Return processed (${data.returnNumber}) & payment collected (${data.payment.paymentNumber})!`);
      } else {
        toast.success(`Return processed successfully (${data.returnNumber})`);
      }
      setIsProcessReturnOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rentalPendingReturns'] });
      queryClient.invalidateQueries({ queryKey: ['rentalReturnsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['rentalBookings'] });
      queryClient.invalidateQueries({ queryKey: ['rentalBookingSummary'] });
      if (data?.id) {
        setSelectedReturnId(data.id);
        setIsReceiptOpen(true);
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to process return'));
    },
  });

  const settleDepositMutation = useMutation({
    mutationFn: (payload: { bookingId: string; data: any }) =>
      tenantApi.rentals.settleDeposit(payload.bookingId, payload.data),
    onSuccess: (data) => {
      toast.success(`Deposit settled successfully (${data.settlementNumber})`);
      setIsSettlementOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rentalPendingReturns'] });
      queryClient.invalidateQueries({ queryKey: ['rentalReturnsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['rentalBookings'] });
      queryClient.invalidateQueries({ queryKey: ['rentalBookingSummary'] });
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to settle deposit'));
    },
  });

  const collectPaymentMutation = useMutation({
    mutationFn: (payload: { bookingId: string; amount: number; paymentMethod: RentalPaymentMethod; referenceNumber?: string; notes?: string }) =>
      tenantApi.rentals.collectPayment({
        bookingId: payload.bookingId,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        referenceNumber: payload.referenceNumber,
        notes: payload.notes,
        rentAmount: payload.amount,
      }),
    onSuccess: (data) => {
      toast.success(`Payment ${data.paymentNumber} collected successfully!`);
      setPaymentBooking(null);
      queryClient.invalidateQueries({ queryKey: ['rentalPendingReturns'] });
      queryClient.invalidateQueries({ queryKey: ['rentalReturnsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['rentalBookings'] });
      queryClient.invalidateQueries({ queryKey: ['rentalBookingSummary'] });
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to collect payment'));
    },
  });



  // Calculate return batch totals
  const selectedDrafts = itemDrafts.filter((d) => d.selected && !d.alreadyReturned);
  const totalBatchLateFees = selectedDrafts.reduce((sum, d) => sum + Number(d.lateFee || 0), 0);
  const totalBatchDamageCharges = selectedDrafts.reduce(
    (sum, d) => sum + Number(d.damageCharge || 0),
    0,
  );
  const totalBatchCharges = totalBatchLateFees + totalBatchDamageCharges;

  const handleConfirmReturn = () => {
    if (!selectedBookingId) return;
    if (selectedDrafts.length === 0) {
      toast.error('Please select at least one unit to return');
      return;
    }

    const payAmt = parseFloat(returnPayAmount);
    if (returnCollectPayment && (!payAmt || payAmt <= 0)) {
      toast.error('Please enter a valid payment amount or uncheck payment collection');
      return;
    }

    const payload = {
      bookingId: selectedBookingId,
      data: {
        returnNotes: returnNotes.trim() || undefined,
        items: selectedDrafts.map((d) => ({
          bookingItemId: d.bookingItemId,
          conditionIn: d.conditionIn,
          inspectionNotes: d.inspectionNotes.trim() || undefined,
          lateFee: Number(d.lateFee || 0),
          damageCharge: Number(d.damageCharge || 0),
          requiresMaintenance: d.requiresMaintenance,
        })),
        collectPayment: returnCollectPayment && payAmt > 0,
        paymentAmount: returnCollectPayment && payAmt > 0 ? payAmt : undefined,
        paymentMethod: returnCollectPayment && payAmt > 0 ? returnPayMethod : undefined,
        referenceNumber: returnCollectPayment && returnPayRef.trim() ? returnPayRef.trim() : undefined,
        paymentNotes: returnCollectPayment && returnPayNotes.trim() ? returnPayNotes.trim() : undefined,
      },
    };

    processReturnMutation.mutate(payload);
  };

  const handleConfirmSettlement = () => {
    if (!selectedBookingId) return;
    settleDepositMutation.mutate({
      bookingId: selectedBookingId,
      data: {
        refundMethod,
        notes: settlementNotes.trim() || undefined,
      },
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* PRINT-ONLY RECEIPT STYLES                                                 */}
      {/* ========================================================================= */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #rental-return-receipt-print-area,
          #rental-return-receipt-print-area * {
            visibility: visible;
          }
          #rental-return-receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* KPI METRIC CARDS                                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Returns
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {summaryData?.totalPending ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Bookings awaiting return</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">
              Overdue Bookings
            </p>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              {summaryData?.totalOverdue ?? 0}
            </p>
            <p className="text-xs text-rose-500 mt-0.5">Past scheduled return date</p>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
              Partially Returned
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {summaryData?.totalPartiallyReturned ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Some units still out</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-500">
              Awaiting Settlement
            </p>
            <p className="text-2xl font-bold text-primary mt-1">
              {summaryData?.totalAwaitingSettlement ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">All units in, deposit unsettled</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fees & Charges
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatMoneyAmount(
                (summaryData?.totalLateFees ?? 0) + (summaryData?.totalDamageCharges ?? 0),
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Total late & damage fees</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH AND FILTERS BAR                                                    */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center w-full">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ref, customer, phone..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Branch Filter */}
          {isAllBranches && (
            <div className="w-[180px]">
              <Select value={filterBranchId} onValueChange={setFilterBranchId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Branches" />
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

          {/* Status Filter */}
          <div className="w-[170px]">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PICKED_UP">Picked Up</SelectItem>
                <SelectItem value="PARTIALLY_RETURNED">Partially Returned</SelectItem>
                <SelectItem value="RETURNED">Returned (Unsettled)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overdue Only Filter */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            <span className="text-rose-600 font-semibold">Overdue Only</span>
          </label>

          {/* Date range filters */}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="h-9 text-xs w-[130px]"
              title="Return Date From"
            />
            <span className="text-slate-400 text-xs">to</span>
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="h-9 text-xs w-[130px]"
              title="Return Date To"
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-9 text-xs gap-1.5 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* RETURNS TABLE                                                             */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <OpsLoading message="Loading returns list..." />
        ) : isError ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">Failed to load returns</p>
            <p className="text-xs text-slate-500 mt-1">{getErrorMessage(error)}</p>
            <Button size="sm" onClick={() => refetch()} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : !returnsData || returnsData.data.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No pending returns found</p>
            <p className="text-xs text-slate-500 mt-1">
              All active rental items have been returned and settled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Pickup Date</th>
                  <th className="py-3 px-4">Expected Return</th>
                  <th className="py-3 px-4 text-center">Units Return Progress</th>
                  <th className="py-3 px-4 text-center">Settlement Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {returnsData.data.map((b: PendingRentalReturn) => {
                  const isOverdue = b.isOverdue;
                  const allReturned = b.returnedUnits === b.totalUnits;
                  const isSettled = b.settlementStatus === 'SETTLED';

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{b.bookingReference}</span>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              {b.overdueDays}d Late
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          Status: <span className="font-medium text-slate-600">{b.status}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800">{b.customerName}</p>
                        <p className="text-[11px] text-slate-500">{b.customerPhone || '-'}</p>
                        {b.remainingRent !== undefined && (
                          <div className="mt-1">
                            {b.remainingRent > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Rent Due: {formatMoneyLkr(b.remainingRent)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-700">
                                ✓ Rent Fully Paid
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">{b.branchName}</td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDisplayDate(b.pickupDate)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-medium ${
                            isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {formatDisplayDate(b.returnDate)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-semibold text-slate-800">
                            {b.returnedUnits} / {b.totalUnits} Units
                          </span>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                allReturned
                                  ? 'bg-emerald-500'
                                  : b.returnedUnits > 0
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{
                                width: `${
                                  b.totalUnits > 0 ? (b.returnedUnits / b.totalUnits) * 100 : 0
                                }%`,
                              }}
                            />
                          </div>
                          {b.outstandingUnits > 0 ? (
                            <span className="text-[10px] text-amber-600 mt-0.5 font-medium">
                              {b.outstandingUnits} still out
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                              All returned
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/25">
                            <Clock className="w-3 h-3" />
                            Unsettled
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.outstandingUnits > 0 && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                              onClick={() => {
                                setSelectedBookingId(b.id);
                                setIsProcessReturnOpen(true);
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Process Return
                            </Button>
                          )}

                          {b.remainingRent !== undefined && b.remainingRent > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 gap-1 font-semibold"
                              onClick={() => {
                                setPaymentBooking(b);
                                setPayAmount(String(b.remainingRent));
                                setPayMethod('CASH');
                                setPayRef('');
                                setPayNotes('Collected upon return');
                              }}
                            >
                              <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                              Collect Rent
                            </Button>
                          )}

                          {allReturned && !isSettled && (!b.remainingRent || b.remainingRent <= 0) && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                              onClick={() => {
                                setSelectedBookingId(b.id);
                                setIsSettlementOpen(true);
                              }}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {b.totalDeposit > 0 ? 'Settle Deposit' : 'Complete Settlement'}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                            title="View Return Transactions & Receipts"
                            onClick={() => {
                              setSelectedBookingId(b.id);
                              setIsHistoryOpen(true);
                            }}
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {returnsData && returnsData.meta.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, returnsData.meta.total)} of {returnsData.meta.total} returns
            </span>
            <OpsPagination
              page={page}
              limit={limit}
              total={returnsData.meta.total}
              totalPages={returnsData.meta.totalPages}
              onPageChange={setPage}
              itemLabel="pending returns"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PROCESS RETURN & INSPECTION                                      */}
      {/* ========================================================================= */}
      <Dialog open={isProcessReturnOpen} onOpenChange={setIsProcessReturnOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-emerald-600" />
              Process Rental Return — {returnDetails?.bookingReference}
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <OpsLoading message="Loading booking details for inspection..." />
          ) : returnDetails ? (
            <div className="space-y-6 pt-2">
              {/* Context Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-500 block">Customer</span>
                  <span className="font-semibold text-slate-800">
                    {returnDetails.customerName}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {returnDetails.customerPhone || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Branch</span>
                  <span className="font-semibold text-slate-800">
                    {returnDetails.branchName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pickup Date</span>
                  <span className="font-semibold text-slate-800">
                    {formatDisplayDate(returnDetails.pickupDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Scheduled Return</span>
                  <span
                    className={`font-semibold ${
                      new Date() > new Date(returnDetails.returnDate)
                        ? 'text-rose-600'
                        : 'text-slate-800'
                    }`}
                  >
                    {formatDisplayDate(returnDetails.returnDate)}
                  </span>
                </div>
              </div>

              {/* Overdue Alert Banner if applicable */}
              {new Date() > new Date(returnDetails.returnDate) && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Overdue Return:</span> This booking was scheduled to
                    be returned on {formatDisplayDate(returnDetails.returnDate)}. You may inspect
                    physical unit conditions and input any applicable late fees below.
                  </div>
                </div>
              )}

              {/* Outstanding Rent Notice if applicable */}
              {returnDetails && (returnDetails.remainingRent ?? 0) > 0 && (
                <div className="p-2.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Outstanding Rent Balance: <strong className="text-amber-900">{formatMoneyLkr(returnDetails.remainingRent ?? 0)}</strong>
                      <span className="text-amber-700 ml-1"> (Physical return can be completed now; payment collected after return)</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                    Pay on Return
                  </span>
                </div>
              )}

              {/* Instant Available Notice */}
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Returned physical copies immediately become <strong>Available</strong> in inventory for new reservations.</span>
              </div>

              {/* Items Inspection Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Select & Inspect Handed-Over Units
                  </h4>
                  <span className="text-xs text-slate-500">
                    {selectedDrafts.length} of{' '}
                    {itemDrafts.filter((d) => !d.alreadyReturned).length} units selected
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {itemDrafts.map((draft, idx) => (
                    <div
                      key={draft.bookingItemId}
                      className={`p-3.5 transition-colors ${
                        draft.alreadyReturned
                          ? 'bg-slate-50/60 opacity-60'
                          : draft.selected
                          ? 'bg-emerald-50/20'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Checkbox and Unit Info */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            disabled={draft.alreadyReturned}
                            checked={draft.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setItemDrafts((prev) =>
                                prev.map((d, i) => (i === idx ? { ...d, selected: checked } : d)),
                              );
                            }}
                            className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">
                                {draft.unitCode}
                              </span>
                              <span className="text-slate-600 text-xs">— {draft.itemName}</span>
                              {draft.alreadyReturned && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                  Already Returned
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Pickup Condition: <span className="font-medium text-slate-700">{draft.conditionOut || 'Pristine'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Inspection Controls if selected and not already returned */}
                        {draft.selected && !draft.alreadyReturned && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto items-center">
                            {/* Return Condition */}
                            <div>
                              <Label className="text-[10px] text-slate-500">Return Condition</Label>
                              <Select
                                value={draft.conditionIn}
                                onValueChange={(val: RentalItemCondition) => {
                                  setItemDrafts((prev) =>
                                    prev.map((d, i) =>
                                      i === idx
                                        ? {
                                            ...d,
                                            conditionIn: val,
                                            requiresMaintenance:
                                              val === 'DAMAGED' || val === 'REQUIRES_REPAIR'
                                                ? true
                                                : d.requiresMaintenance,
                                          }
                                        : d,
                                    ),
                                  );
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GOOD">Good / Available</SelectItem>
                                  <SelectItem value="MINOR_DAMAGE">Minor Wear</SelectItem>
                                  <SelectItem value="DAMAGED">Damaged</SelectItem>
                                  <SelectItem value="REQUIRES_REPAIR">Requires Repair</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Late Fee */}
                            <div>
                              <Label className="text-[10px] text-slate-500">Late Fee (LKR)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="100"
                                value={draft.lateFee || ''}
                                onChange={(e) => {
                                  const fee = Math.max(0, parseFloat(e.target.value) || 0);
                                  setItemDrafts((prev) =>
                                    prev.map((d, i) => (i === idx ? { ...d, lateFee: fee } : d)),
                                  );
                                }}
                                className="h-8 text-xs w-[100px]"
                                placeholder="0.00"
                              />
                            </div>

                            {/* Damage Charge */}
                            <div>
                              <Label className="text-[10px] text-slate-500">Damage Charge</Label>
                              <Input
                                type="number"
                                min="0"
                                step="100"
                                value={draft.damageCharge || ''}
                                onChange={(e) => {
                                  const dmg = Math.max(0, parseFloat(e.target.value) || 0);
                                  setItemDrafts((prev) =>
                                    prev.map((d, i) =>
                                      i === idx ? { ...d, damageCharge: dmg } : d,
                                    ),
                                  );
                                }}
                                className="h-8 text-xs w-[100px]"
                                placeholder="0.00"
                              />
                            </div>

                            {/* Maintenance Flag */}
                            <div className="flex items-center gap-1.5 pt-4">
                              <input
                                type="checkbox"
                                id={`maint-${draft.bookingItemId}`}
                                checked={draft.requiresMaintenance}
                                onChange={(e) => {
                                  const m = e.target.checked;
                                  setItemDrafts((prev) =>
                                    prev.map((d, i) =>
                                      i === idx ? { ...d, requiresMaintenance: m } : d,
                                    ),
                                  );
                                }}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <label
                                htmlFor={`maint-${draft.bookingItemId}`}
                                className="text-[11px] font-medium text-slate-700 cursor-pointer"
                              >
                                Maintenance
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Inspection notes for selected units */}
                      {draft.selected && !draft.alreadyReturned && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                          <Label className="text-[11px] text-slate-500 whitespace-nowrap">
                            Notes:
                          </Label>
                          <Input
                            value={draft.inspectionNotes}
                            onChange={(e) => {
                              const notes = e.target.value;
                              setItemDrafts((prev) =>
                                prev.map((d, i) =>
                                  i === idx ? { ...d, inspectionNotes: notes } : d,
                                ),
                              );
                            }}
                            placeholder="e.g. slight stain on sleeve, zipper inspected..."
                            className="h-7 text-xs flex-1"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Return Notes and Transaction Charges Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Return Transaction Notes
                  </Label>
                  <Textarea
                    value={returnNotes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReturnNotes(e.target.value)}
                    placeholder="Add any overall remarks about customer return..."
                    className="text-xs mt-1.5 h-20"
                  />
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Batch Units Selected:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedDrafts.length} Units
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Late Fees:</span>
                    <span className="font-semibold text-rose-600">
                      {formatMoneyLkr(totalBatchLateFees)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Damage Charges:</span>
                    <span className="font-semibold text-rose-600">
                      {formatMoneyLkr(totalBatchDamageCharges)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-100 font-bold text-slate-900 text-sm">
                    <span>Total Additional Charges:</span>
                    <span>{formatMoneyLkr(totalBatchCharges)}</span>
                  </div>
                </div>
              </div>

              {/* Flexible Return Payment Section */}
              {returnDetails && ((returnDetails.remainingRent ?? 0) > 0 || totalBatchCharges > 0) && (
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-700" />
                      <span className="font-bold text-xs text-amber-900">
                        Payment at Return (Flexible)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600">Outstanding Balance Due:</span>
                      <span className="font-bold text-sm text-amber-900">
                        {formatMoneyLkr((returnDetails.remainingRent ?? 0) + totalBatchCharges)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                    <input
                      type="checkbox"
                      id="collect-payment-at-return-toggle"
                      checked={returnCollectPayment}
                      onChange={(e) => setReturnCollectPayment(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                    />
                    <label
                      htmlFor="collect-payment-at-return-toggle"
                      className="text-xs font-semibold text-amber-950 cursor-pointer"
                    >
                      Collect due payment now upon return
                    </label>
                  </div>

                  {returnCollectPayment ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Payment Amount (LKR) *</Label>
                        <Input
                          type="number"
                          step="100"
                          min="0.01"
                          value={returnPayAmount}
                          onChange={(e) => setReturnPayAmount(e.target.value)}
                          className="h-8 text-xs bg-white font-bold mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Payment Method *</Label>
                        <Select
                          value={returnPayMethod}
                          onValueChange={(val) => setReturnPayMethod(val as RentalPaymentMethod)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="CARD">Credit / Debit Card</SelectItem>
                            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Ref / Slip # (Optional)</Label>
                        <Input
                          placeholder="e.g. TXN-12345"
                          value={returnPayRef}
                          onChange={(e) => setReturnPayRef(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800 italic">
                      Payment not collected now. Customer can pay later via &quot;Collect Rent&quot; on the returns dashboard.
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsProcessReturnOpen(false)}
                  disabled={processReturnMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReturn}
                  disabled={processReturnMutation.isPending || selectedDrafts.length === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold"
                >
                  {processReturnMutation.isPending ? (
                    'Processing Return...'
                  ) : returnCollectPayment && parseFloat(returnPayAmount) > 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Pay {formatMoneyLkr(parseFloat(returnPayAmount) || 0)} & Complete Return
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Return ({selectedDrafts.length} Units)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: DEPOSIT SETTLEMENT                                               */}
      {/* ========================================================================= */}
      <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Final Security Deposit Settlement — {returnDetails?.bookingReference}
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <OpsLoading message="Loading settlement calculations..." />
          ) : returnDetails?.settlementSummary ? (
            <div className="space-y-6 pt-2">
              {/* Financial Calculation Matrix */}
              <div className="bg-primary/10/50 border border-primary/25/80 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs text-primary">
                  <span>Actual Security Deposit Held:</span>
                  <span className="font-bold text-sm">
                    {formatMoneyLkr(returnDetails.settlementSummary.depositCollected)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Total Accrued Late Fees:</span>
                  <span className="font-semibold text-rose-600">
                    + {formatMoneyLkr(returnDetails.settlementSummary.totalLateFees)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Total Accrued Damage Charges:</span>
                  <span className="font-semibold text-rose-600">
                    + {formatMoneyLkr(returnDetails.settlementSummary.totalDamageCharges)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-800 font-semibold pt-1 border-t border-primary/25">
                  <span>Total Applicable Deductions:</span>
                  <span className="text-rose-700">
                    - {formatMoneyLkr(returnDetails.settlementSummary.depositDeducted)}
                  </span>
                </div>

                {/* Refundable or Additional Due Display */}
                {returnDetails.settlementSummary.refundableBalance > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg flex justify-between items-center mt-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 block">
                        Refundable Balance to Customer
                      </span>
                      <span className="text-[11px] text-emerald-600">
                        Remaining security deposit after charge deductions
                      </span>
                    </div>
                    <span className="text-xl font-bold text-emerald-700">
                      {formatMoneyLkr(returnDetails.settlementSummary.refundableBalance)}
                    </span>
                  </div>
                )}

                {returnDetails.settlementSummary.additionalAmountDue > 0 && (
                  <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-lg flex justify-between items-center mt-2">
                    <div>
                      <span className="text-xs font-bold text-rose-800 block">
                        Additional Amount Due from Customer
                      </span>
                      <span className="text-[11px] text-rose-600">
                        Charges exceed held deposit liability
                      </span>
                    </div>
                    <span className="text-xl font-bold text-rose-700">
                      {formatMoneyLkr(returnDetails.settlementSummary.additionalAmountDue)}
                    </span>
                  </div>
                )}
              </div>

              {/* Refund Method & Notes */}
              {returnDetails.settlementSummary.refundableBalance > 0 && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Refund Payout Method
                    </Label>
                    <Select
                      value={refundMethod}
                      onValueChange={(val: RentalPaymentMethod) => setRefundMethod(val)}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash Refund</SelectItem>
                        <SelectItem value="CARD">Credit/Debit Card</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-slate-700">Settlement Remarks</Label>
                <Textarea
                  value={settlementNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSettlementNotes(e.target.value)}
                  placeholder="Optional notes regarding final deposit payout or fee deductions..."
                  className="text-xs mt-1.5 h-16"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSettlementOpen(false)}
                  disabled={settleDepositMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSettlement}
                  disabled={settleDepositMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  {settleDepositMutation.isPending ? (
                    'Finalizing Settlement...'
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Complete Settlement & Close Booking
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: RETURN HISTORY & TRANSACTIONS                                    */}
      {/* ========================================================================= */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              Return Transactions History
            </DialogTitle>
          </DialogHeader>

          {isLoadingHistory ? (
            <OpsLoading message="Loading return transactions..." />
          ) : !bookingHistory || bookingHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No return transactions have been recorded yet for this booking.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {bookingHistory.map((ret: any) => (
                <div
                  key={ret.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        {ret.returnNumber}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {formatDisplayDateTime(ret.actualReturnAt)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setSelectedReturnId(ret.id);
                        setIsReceiptOpen(true);
                      }}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Receipt
                    </Button>
                  </div>

                  {/* Items in this return */}
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-700">Returned Units:</p>
                    {ret.items?.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center bg-slate-50 p-2 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-slate-900">{item.unitCode}</span>
                          <span className="text-slate-500 ml-1.5">({item.itemName})</span>
                          <span className="ml-2 text-[10px] font-semibold text-slate-600 uppercase bg-slate-200/80 px-1.5 py-0.5 rounded">
                            {item.conditionIn}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.lateFee > 0 && (
                            <span className="text-rose-600 font-medium">
                              Late: {formatMoneyLkr(item.lateFee)}
                            </span>
                          )}
                          {item.damageCharge > 0 && (
                            <span className="text-rose-600 font-medium">
                              Damage: {formatMoneyLkr(item.damageCharge)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ret.returnNotes && (
                    <p className="text-[11px] text-slate-500 italic">Notes: {ret.returnNotes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* COLLECT RETURN PAYMENT MODAL                                              */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(paymentBooking)} onOpenChange={(open) => !open && setPaymentBooking(null)}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Collect Return Payment — {paymentBooking?.bookingReference}
            </DialogTitle>
          </DialogHeader>

          {paymentBooking && (
            <div className="space-y-4 pt-1 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">{paymentBooking.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Outstanding Rent Balance:</span>
                  <span className="font-bold text-amber-800">{formatMoneyLkr(paymentBooking.remainingRent ?? 0)}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Amount to Collect (LKR) *</Label>
                <Input
                  type="number"
                  step="100"
                  min="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 text-xs bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Payment Method *</Label>
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
                  <Label className="text-xs font-semibold text-slate-700">Reference # (Optional)</Label>
                  <Input
                    placeholder="Slip / Trans #"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="mt-1 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Notes (Optional)</Label>
                <Input
                  placeholder="Notes..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="mt-1 text-xs bg-white"
                />
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
                  type="button"
                  size="sm"
                  disabled={collectPaymentMutation.isPending || !parseFloat(payAmount)}
                  onClick={() => {
                    const amt = parseFloat(payAmount);
                    if (!amt || amt <= 0) {
                      toast.error('Please enter a valid payment amount');
                      return;
                    }
                    collectPaymentMutation.mutate({
                      bookingId: paymentBooking.id,
                      amount: amt,
                      paymentMethod: payMethod,
                      referenceNumber: payRef.trim() || undefined,
                      notes: payNotes.trim() || undefined,
                    });
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {collectPaymentMutation.isPending ? 'Processing...' : `Confirm ${formatMoneyLkr(parseFloat(payAmount) || 0)}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: PRINTABLE RETURN RECEIPT                                         */}
      {/* ========================================================================= */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Return Inspection Receipt</span>
              <Button
                size="sm"
                onClick={handlePrintReceipt}
                className="bg-slate-900 text-white gap-1.5 text-xs h-8 mr-6"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </Button>
            </DialogTitle>
          </DialogHeader>

          {isLoadingReceipt ? (
            <OpsLoading message="Loading receipt format..." />
          ) : receiptData ? (
            <div
              id="rental-return-receipt-print-area"
              className="bg-white p-6 rounded-lg border border-slate-200 text-slate-800 space-y-5"
            >
              {/* Header */}
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="font-extrabold text-lg text-slate-900">
                  {receiptData.salonName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{receiptData.branch.name}</p>
                {receiptData.branch.address && (
                  <p className="text-[11px] text-slate-400">{receiptData.branch.address}</p>
                )}
                {receiptData.branch.phone && (
                  <p className="text-[11px] text-slate-400">Tel: {receiptData.branch.phone}</p>
                )}
                <div className="mt-2.5 inline-block px-3 py-1 bg-slate-100 rounded text-xs font-bold text-slate-800">
                  RETURN & INSPECTION RECEIPT
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 text-xs gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400 block">Return Number:</span>
                  <span className="font-bold text-slate-900">{receiptData.returnNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Booking Reference:</span>
                  <span className="font-bold text-slate-900">
                    {receiptData.bookingReference}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Customer:</span>
                  <span className="font-semibold text-slate-800">
                    {receiptData.customer.name}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {receiptData.customer.phone || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Return Timestamp:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDisplayDateTime(receiptData.actualReturnAt)}
                  </span>
                </div>
              </div>

              {/* Returned Items Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Inspected Items
                </span>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                      <th className="py-1 text-left">Unit Code / Item</th>
                      <th className="py-1 text-center">Condition</th>
                      <th className="py-1 text-right">Late Fee</th>
                      <th className="py-1 text-right">Damage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receiptData.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          <p className="font-semibold text-slate-900">{item.unitCode}</p>
                          <p className="text-[11px] text-slate-500">{item.itemName}</p>
                        </td>
                        <td className="py-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                            {item.conditionIn}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {item.lateFee > 0 ? formatMoneyAmount(item.lateFee) : '-'}
                        </td>
                        <td className="py-2 text-right">
                          {item.damageCharge > 0 ? formatMoneyAmount(item.damageCharge) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-slate-200 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Late Fees:</span>
                  <span className="font-semibold">
                    {formatMoneyLkr(receiptData.totalLateFees)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Damage Charges:</span>
                  <span className="font-semibold">
                    {formatMoneyLkr(receiptData.totalDamageCharges)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Accrued Charges:</span>
                  <span>{formatMoneyLkr(receiptData.totalCharges)}</span>
                </div>
              </div>

              {/* Inspector Footer */}
              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
                <span>Inspected By: {receiptData.inspectorName || 'Staff User'}</span>
                <span>Thank you for choosing {receiptData.salonName}!</span>
              </div>

              {/* Action Buttons & Pay Due Rent Option */}
              {(() => {
                const dueBooking = returnsData?.data.find((b) => b.bookingReference === receiptData.bookingReference);
                const hasDueRent = dueBooking && (dueBooking.remainingRent ?? 0) > 0;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    {hasDueRent ? (
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 font-semibold"
                        onClick={() => {
                          setIsReceiptOpen(false);
                          setPaymentBooking(dueBooking);
                          setPayAmount(String(dueBooking.remainingRent));
                          setPayMethod('CASH');
                          setPayRef('');
                          setPayNotes('Collected upon return');
                        }}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Collect Remaining Rent ({formatMoneyLkr(dueBooking.remainingRent ?? 0)})
                      </Button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-medium">
                        ✓ All rental charges settled
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsReceiptOpen(false)}>
                        Close
                      </Button>
                      <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5" onClick={handlePrintReceipt}>
                        <Printer className="w-3.5 h-3.5" />
                        Print Return Receipt
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

