import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Plus,
  Search,
  AlertCircle,
  Printer,
  FileText,
  DollarSign,
  ShieldCheck,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  tenantApi,
  type RentalPaymentMethod,
  type CreateRentalPaymentPayload,
  type RentalBooking,
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

export default function RentalPaymentsPage() {
  const queryClient = useQueryClient();
  const { branchId: activeBranchId, isAllBranches, activeBranches } = useSalonBranch();

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search, 300, 1);
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Active branch resolution
  const effectiveBranchId = useMemo(() => {
    if (!isAllBranches && activeBranchId) return activeBranchId;
    return filterBranchId !== 'all' ? filterBranchId : undefined;
  }, [isAllBranches, activeBranchId, filterBranchId]);

  // Modals
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  // Collect Payment Form State
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const debouncedBookingSearch = useDebouncedSearch(bookingSearch, 300, 1);
  const [rentAmount, setRentAmount] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<RentalPaymentMethod>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [collectError, setCollectError] = useState<string | null>(null);

  // Generate idempotency key when opening collect modal
  useEffect(() => {
    if (isCollectOpen) {
      setIdempotencyKey(`pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
      setSelectedBooking(null);
      setBookingSearch('');
      setRentAmount('');
      setDepositAmount('');
      setPaymentMethod('CASH');
      setReferenceNumber('');
      setPaymentNotes('');
      setCollectError(null);
    }
  }, [isCollectOpen]);

  // 1. Fetch Payments Summary KPIs
  const { data: summaryData } = useQuery({
    queryKey: ['rental-payments-summary', effectiveBranchId],
    queryFn: () => tenantApi.rentals.getPaymentsSummary(effectiveBranchId),
  });

  // 2. Fetch Paginated Payments List
  const {
    data: paymentsData,
    isLoading: isLoadingPayments,
  } = useQuery({
    queryKey: [
      'rental-payments-list',
      effectiveBranchId,
      filterMethod,
      filterStartDate,
      filterEndDate,
      debouncedSearch,
      page,
      limit,
    ],
    queryFn: () =>
      tenantApi.rentals.listPayments({
        branchId: effectiveBranchId,
        paymentMethod: filterMethod !== 'all' ? filterMethod : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      }),
  });

  // 3. Search Active Bookings for Payment Collection
  const {
    data: candidateBookingsData,
    isLoading: isLoadingCandidateBookings,
  } = useQuery({
    queryKey: ['candidate-bookings-for-payment', effectiveBranchId, debouncedBookingSearch],
    queryFn: () =>
      tenantApi.rentals.listBookings({
        branchId: effectiveBranchId,
        search: debouncedBookingSearch.trim() || undefined,
        limit: 10,
      }),
    enabled: isCollectOpen && !selectedBooking,
  });

  // 4. Fetch Selected Payment Details for Printable Receipt
  const {
    data: receiptPayment,
    isLoading: isLoadingReceipt,
  } = useQuery({
    queryKey: ['rental-payment-receipt', receiptPaymentId],
    queryFn: () => tenantApi.rentals.getPayment(receiptPaymentId!),
    enabled: Boolean(receiptPaymentId),
  });

  // Collect Payment Mutation
  const collectPaymentMutation = useMutation({
    mutationFn: (payload: CreateRentalPaymentPayload) => tenantApi.rentals.collectPayment(payload),
    onSuccess: (payment) => {
      toast.success(`Payment ${payment.paymentNumber} collected successfully!`);
      queryClient.invalidateQueries({ queryKey: ['rental-payments-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-payments-summary'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['rental-bookings-summary'] });
      setIsCollectOpen(false);
      // Open receipt for the collected payment
      setReceiptPaymentId(payment.id);
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to collect payment');
      setCollectError(msg);
      toast.error(msg);
    },
  });

  // Live calculations for payment form
  const paymentFormTotals = useMemo(() => {
    const rentNum = parseFloat(rentAmount) || 0;
    const depNum = parseFloat(depositAmount) || 0;
    const total = Math.round((rentNum + depNum) * 100) / 100;

    let remRentAfter = 0;
    let remDepAfter = 0;
    if (selectedBooking?.financials) {
      remRentAfter = Math.max(0, Math.round((selectedBooking.financials.remainingRent - rentNum) * 100) / 100);
      remDepAfter = Math.max(0, Math.round((selectedBooking.financials.remainingDeposit - depNum) * 100) / 100);
    }

    return {
      rentNum,
      depNum,
      total,
      remRentAfter,
      remDepAfter,
    };
  }, [rentAmount, depositAmount, selectedBooking]);

  const handleSelectBooking = async (booking: RentalBooking) => {
    try {
      // Fetch full booking details with updated financials
      const fullBooking = await tenantApi.rentals.getBooking(booking.id);
      setSelectedBooking(fullBooking);
      setCollectError(null);

      // Default quick-fill: pay all remaining balance and deposit
      if (fullBooking.financials) {
        setRentAmount(fullBooking.financials.remainingRent > 0 ? String(fullBooking.financials.remainingRent) : '0');
        setDepositAmount(fullBooking.financials.remainingDeposit > 0 ? String(fullBooking.financials.remainingDeposit) : '0');
      }
    } catch {
      setSelectedBooking(booking);
    }
  };

  const handleQuickFill = (type: 'all' | 'rent' | 'deposit') => {
    if (!selectedBooking?.financials) return;
    const { remainingRent, remainingDeposit } = selectedBooking.financials;

    if (type === 'all') {
      setRentAmount(String(remainingRent));
      setDepositAmount(String(remainingDeposit));
    } else if (type === 'rent') {
      setRentAmount(String(remainingRent));
      setDepositAmount('0');
    } else if (type === 'deposit') {
      setRentAmount('0');
      setDepositAmount(String(remainingDeposit));
    }
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) {
      setCollectError('Please select a booking to collect payment for');
      return;
    }

    const rentNum = parseFloat(rentAmount) || 0;
    const depNum = parseFloat(depositAmount) || 0;
    const total = Math.round((rentNum + depNum) * 100) / 100;

    if (total <= 0) {
      setCollectError('Total payment amount must be greater than zero');
      return;
    }

    if (selectedBooking.financials) {
      if (rentNum > selectedBooking.financials.remainingRent + 0.001) {
        setCollectError(`Rent payment cannot exceed remaining balance (LKR ${formatMoneyAmount(selectedBooking.financials.remainingRent)})`);
        return;
      }
      if (depNum > selectedBooking.financials.remainingDeposit + 0.001) {
        setCollectError(`Deposit payment cannot exceed remaining required deposit (LKR ${formatMoneyAmount(selectedBooking.financials.remainingDeposit)})`);
        return;
      }
    }

    setCollectError(null);
    collectPaymentMutation.mutate({
      bookingId: selectedBooking.id,
      amount: total,
      rentAmount: rentNum,
      depositAmount: depNum,
      paymentMethod,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: paymentNotes.trim() || undefined,
      idempotencyKey,
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rental Payments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Collect advance rental payments, outstanding balances, and refundable security deposits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCollectOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Collect Payment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected Rental Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rental Revenue Collected</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatMoneyLkr(summaryData?.totalCollectedRent ?? 0)}
            </p>
            <span className="text-[11px] text-emerald-600 font-medium">Earned rental revenue</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Security Deposit Held */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Security Deposit Held</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">
              {formatMoneyLkr(summaryData?.totalSecurityDepositHeld ?? 0)}
            </p>
            <span className="text-[11px] text-indigo-600 font-medium">Refundable client deposits</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Total Inflow Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cash Inflow</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatMoneyLkr(summaryData?.totalAmountCollected ?? 0)}
            </p>
            <span className="text-[11px] text-slate-500">Revenue + Deposits</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transactions</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {summaryData?.totalTransactions ?? 0}
            </p>
            <span className="text-[11px] text-slate-500">Receipts issued</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
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
              placeholder="Search receipt #, booking ref, customer, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-sm"
            />
          </div>

          {/* Payment Method selector */}
          <div className="md:col-span-3">
            <Select
              value={filterMethod}
              onValueChange={(val) => {
                setFilterMethod(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All Payment Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Methods</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
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
              title="Start Date"
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
              title="End Date"
            />
          </div>

          {/* Branch filter if in multi-branch view */}
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

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoadingPayments ? (
          <div className="py-16">
            <OpsLoading />
          </div>
        ) : !paymentsData?.data || paymentsData.data.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No Rental Payments Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {search || filterMethod !== 'all' || filterStartDate
                ? 'Try adjusting your search criteria or clearing active filters.'
                : 'Collect your first advance payment or security deposit for a rental booking.'}
            </p>
            <Button
              onClick={() => setIsCollectOpen(true)}
              variant="outline"
              size="sm"
              className="mt-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Collect Payment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4 text-center">Method</th>
                  <th className="py-3.5 px-4 text-right">Rent Paid</th>
                  <th className="py-3.5 px-4 text-right">Deposit Paid</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4">Received By</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentsData.data.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Payment / Receipt # */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                      {payment.paymentNumber}
                    </td>

                    {/* Booking Reference */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                      {payment.bookingReference}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{payment.customerName}</div>
                      {payment.customerPhone && (
                        <div className="text-xs text-slate-400 font-mono">{payment.customerPhone}</div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-xs">
                      {formatDisplayDateTime(payment.createdAt)}
                    </td>

                    {/* Method */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          payment.paymentMethod === 'CASH'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : payment.paymentMethod === 'CARD'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : payment.paymentMethod === 'BANK_TRANSFER'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {payment.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Rent Portion */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-slate-700">
                      {payment.rentAmount > 0 ? formatMoneyAmount(payment.rentAmount) : '-'}
                    </td>

                    {/* Security Deposit Portion */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-indigo-700">
                      {payment.depositAmount > 0 ? (
                        <span>{formatMoneyAmount(payment.depositAmount)}</span>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-900">
                      {formatMoneyLkr(payment.amount)}
                    </td>

                    {/* Receiver */}
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {payment.receiverName || 'Staff'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReceiptPaymentId(payment.id)}
                        className="h-8 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {paymentsData && paymentsData.meta.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, paymentsData.meta.total)} of {paymentsData.meta.total} payments
            </span>
            <OpsPagination
              page={page}
              limit={limit}
              total={paymentsData.meta.total}
              totalPages={paymentsData.meta.totalPages}
              onPageChange={setPage}
              itemLabel="rental payments"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COLLECT PAYMENT MODAL                                                     */}
      {/* ========================================================================= */}
      <Dialog open={isCollectOpen} onOpenChange={setIsCollectOpen}>
        <DialogContent className="max-w-xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Collect Rental Payment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitPayment} className="space-y-4 pt-2">
            {collectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{collectError}</span>
              </div>
            )}

            {/* 1. Booking Selection */}
            {!selectedBooking ? (
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-700">
                  Select Booking for Payment Collection *
                </Label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    placeholder="Search by booking reference, customer name or phone..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="pl-9 text-sm"
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {isLoadingCandidateBookings ? (
                    <div className="p-4 text-center">
                      <OpsLoading />
                    </div>
                  ) : !candidateBookingsData?.data || candidateBookingsData.data.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-500">
                      No active bookings found.
                    </p>
                  ) : (
                    candidateBookingsData.data
                      .filter((b) => b.status !== 'CANCELLED' && b.status !== 'RETURNED')
                      .map((b) => (
                        <div
                          key={b.id}
                          onClick={() => handleSelectBooking(b)}
                          className="p-3 flex items-center justify-between text-xs hover:bg-emerald-50/50 cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">{b.bookingReference}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {b.status}
                              </span>
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              {b.customerName} {b.customerPhone ? `(${b.customerPhone})` : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Schedule: {formatDisplayDate(b.pickupDate)} → {formatDisplayDate(b.returnDate)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900">
                              Rent: {formatMoneyLkr(b.totalRent)}
                            </div>
                            <div className="text-indigo-600 text-[11px] font-medium">
                              Deposit: {formatMoneyLkr(b.totalDeposit)}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] text-emerald-700 font-semibold p-0 mt-1">
                              Select <ArrowRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Booking Header Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {selectedBooking.bookingReference}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {selectedBooking.status}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBooking(null)}
                      className="h-6 text-[11px] text-slate-500 hover:text-slate-900 px-1.5"
                    >
                      Change Booking
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Customer</span>
                      <span className="font-semibold text-slate-900">{selectedBooking.customerName}</span>{' '}
                      {selectedBooking.customerPhone && <span className="text-slate-500">({selectedBooking.customerPhone})</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Schedule</span>
                      <span>
                        {formatDisplayDate(selectedBooking.pickupDate)} → {formatDisplayDate(selectedBooking.returnDate)}
                      </span>
                    </div>
                  </div>

                  {/* Financial Status Summary */}
                  {selectedBooking.financials && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 text-[11px] block">Rental Fee (Revenue)</span>
                        <div className="font-bold text-slate-900 text-sm">
                          {formatMoneyLkr(selectedBooking.financials.totalRent)}
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between mt-0.5">
                          <span>Paid: {formatMoneyAmount(selectedBooking.financials.paidRent)}</span>
                          <span className={selectedBooking.financials.remainingRent > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                            Bal: {formatMoneyAmount(selectedBooking.financials.remainingRent)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-indigo-600 text-[11px] block font-medium">Security Deposit (Refundable)</span>
                        <div className="font-bold text-indigo-900 text-sm">
                          {formatMoneyLkr(selectedBooking.financials.totalDeposit)}
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between mt-0.5">
                          <span>Held: {formatMoneyAmount(selectedBooking.financials.heldDeposit)}</span>
                          <span className={selectedBooking.financials.remainingDeposit > 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                            Need: {formatMoneyAmount(selectedBooking.financials.remainingDeposit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Fill Buttons */}
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickFill('all')}
                      className="text-[11px] h-7 text-slate-700 bg-white"
                    >
                      Pay Full Outstanding
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickFill('rent')}
                      className="text-[11px] h-7 text-slate-700 bg-white"
                    >
                      Pay Rent Only
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickFill('deposit')}
                      className="text-[11px] h-7 text-indigo-700 border-indigo-200 bg-white"
                    >
                      Pay Deposit Only
                    </Button>
                  </div>
                </div>

                {/* Amount Split Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rentAmount" className="text-xs font-semibold text-slate-700">
                      Rental Charge Allocation (LKR)
                    </Label>
                    <Input
                      id="rentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={rentAmount}
                      onChange={(e) => setRentAmount(e.target.value)}
                      className="mt-1 text-sm bg-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Max: LKR {formatMoneyAmount(selectedBooking.financials?.remainingRent ?? 0)}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="depositAmount" className="text-xs font-semibold text-indigo-700">
                      Refundable Deposit Allocation (LKR)
                    </Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="mt-1 text-sm bg-white border-indigo-200 focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Max: LKR {formatMoneyAmount(selectedBooking.financials?.remainingDeposit ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Total Payment Amount Banner */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Total Payment Received
                    </span>
                    <p className="text-xl font-bold text-emerald-700 mt-0.5">
                      {formatMoneyLkr(paymentFormTotals.total)}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                    <div>Rent: {formatMoneyLkr(paymentFormTotals.rentNum)}</div>
                    <div>Deposit: {formatMoneyLkr(paymentFormTotals.depNum)}</div>
                  </div>
                </div>

                {/* Payment Method & Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Payment Method *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(val) => setPaymentMethod(val as RentalPaymentMethod)}
                    >
                      <SelectTrigger className="mt-1 text-sm bg-white">
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
                    <Label htmlFor="refNum" className="text-xs font-semibold text-slate-700">
                      Reference Number (Optional)
                    </Label>
                    <Input
                      id="refNum"
                      placeholder="e.g. Card slip # or transaction ref"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="mt-1 text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">
                    Notes (Optional)
                  </Label>
                  <Input
                    id="notes"
                    placeholder="e.g. Customer requested receipt via SMS"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="mt-1 text-sm bg-white"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCollectOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={collectPaymentMutation.isPending || paymentFormTotals.total <= 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium"
                  >
                    {collectPaymentMutation.isPending ? 'Processing...' : `Confirm Payment (${formatMoneyLkr(paymentFormTotals.total)})`}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* PRINTABLE RECEIPT MODAL                                                    */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(receiptPaymentId)}
        onOpenChange={(open) => !open && setReceiptPaymentId(null)}
      >
        <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Payment Receipt
              </span>
              <Button
                size="sm"
                onClick={handlePrintReceipt}
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
            <div id="printable-rental-receipt" className="space-y-4 p-2 text-slate-800 text-xs font-sans">
              {/* Receipt Header */}
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
                  <span className="font-bold text-xs uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/25">
                    Official Rental Payment Receipt
                  </span>
                </div>
              </div>

              {/* Receipt Details Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block">Receipt Number</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{receiptPayment.paymentNumber}</span>
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
                    {receiptPayment.customerCode && (
                      <span className="ml-1 text-[10px] font-mono text-primary">({receiptPayment.customerCode})</span>
                    )}
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

              {/* Booking Schedule */}
              {receiptPayment.booking && (
                <div className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold block">Rental Schedule</span>
                    <span className="font-medium text-slate-800">
                      {formatDisplayDate(receiptPayment.booking.pickupDate)} → {formatDisplayDate(receiptPayment.booking.returnDate)}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Status: {receiptPayment.booking.status}
                  </span>
                </div>
              )}

              {/* Rented Items (if attached) */}
              {receiptPayment.booking?.items && receiptPayment.booking.items.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Rented Items & Physical Units
                  </h4>
                  <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase">
                        <th className="py-1.5 px-2 text-left">Item Name</th>
                        <th className="py-1.5 px-2 text-left">Unit Code</th>
                        <th className="py-1.5 px-2 text-right">Rent Price</th>
                        <th className="py-1.5 px-2 text-right">Deposit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receiptPayment.booking.items.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-2 font-medium">{it.itemName}</td>
                          <td className="py-1.5 px-2 font-mono text-[11px] text-slate-600">{it.unitCode}</td>
                          <td className="py-1.5 px-2 text-right">{formatMoneyAmount(it.rentPrice)}</td>
                          <td className="py-1.5 px-2 text-right">{formatMoneyAmount(it.deposit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment Allocation Breakdown */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
                <h4 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  Payment Allocation Breakdown
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-700">
                    <span>Rental Charge Allocation (Revenue):</span>
                    <span className="font-semibold text-slate-900">{formatMoneyLkr(receiptPayment.rentAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Refundable Security Deposit Allocation:</span>
                    <span className="font-semibold text-indigo-700">{formatMoneyLkr(receiptPayment.depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Paid in this Transaction:</span>
                    <span className="text-emerald-700">{formatMoneyLkr(receiptPayment.amount)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex justify-between">
                  <span>Method: <strong className="text-slate-800">{receiptPayment.paymentMethod.replace('_', ' ')}</strong></span>
                  {receiptPayment.referenceNumber && (
                    <span>Ref: <strong className="text-slate-800">{receiptPayment.referenceNumber}</strong></span>
                  )}
                </div>
              </div>

              {/* Outstanding Booking Balances */}
              {receiptPayment.booking?.financials && (
                <div className="p-2.5 bg-slate-100/70 rounded-lg border border-slate-200 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                    Remaining Booking Balances
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Remaining Rental Balance:</span>
                    <span className="font-medium text-slate-900">
                      {formatMoneyLkr(receiptPayment.booking.financials.remainingRent)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Remaining Required Security Deposit:</span>
                    <span className="font-medium text-indigo-800">
                      {formatMoneyLkr(receiptPayment.booking.financials.remainingDeposit)}
                    </span>
                  </div>
                </div>
              )}

              {/* Legal Deposit Refund Notice */}
              <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-lg text-[11px] text-indigo-900">
                <span className="font-bold">Notice regarding Security Deposits:</span> The security deposit is held in trust as a refundable bond and does not form part of salon rental revenue. It is returned upon inspection when items are returned in good condition.
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 pb-2 text-center text-xs">
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-500">Authorized Signature</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-500">Customer Signature</span>
                </div>
              </div>

              {/* Actions for Modal */}
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
                  onClick={handlePrintReceipt}
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
    </div>
  );
}
