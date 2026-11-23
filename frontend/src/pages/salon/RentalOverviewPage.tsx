import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Shirt,
  ArrowLeftRight,
  CreditCard,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Layers,
  RefreshCw,
  User,
  Plus,
  Box,
} from 'lucide-react';
import { tenantApi } from '@/api/tenant.api';
import { useSalonBranch } from '@/contexts/SalonBranchContext';
import { formatMoneyLkr } from '@/lib/money';
import { Button } from '@/components/ui/button';
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
import { OpsLoading } from './salon-ops-ui';

function getTodayStr() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getWeekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDisplayTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RentalOverviewPage() {
  const navigate = useNavigate();
  const { branchId: activeBranchId, branches } = useSalonBranch();

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || 'all');
  const [dateFilterPreset, setDateFilterPreset] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState<string>(getMonthStartStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());

  // Customer & Unit History Drilldown Modals
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);


  const handlePresetChange = (preset: 'all' | 'today' | 'this_week' | 'this_month' | 'custom') => {
    setDateFilterPreset(preset);
    const today = getTodayStr();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'this_week') {
      setStartDate(getWeekStartStr());
      setEndDate(today);
    } else if (preset === 'this_month') {
      setStartDate(getMonthStartStr());
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Overview KPIs query
  const overviewQuery = useQuery({
    queryKey: ['rental-overview-kpis', selectedBranchId, startDate, endDate],
    queryFn: () =>
      tenantApi.rentals.getOverview({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  // Upcoming Pickups query
  const upcomingPickupsQuery = useQuery({
    queryKey: ['rental-overview-pickups', selectedBranchId],
    queryFn: () =>
      tenantApi.rentals.getUpcomingPickups({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        limit: 5,
      }),
  });

  // Expected Returns query
  const expectedReturnsQuery = useQuery({
    queryKey: ['rental-overview-expected-returns', selectedBranchId],
    queryFn: () =>
      tenantApi.rentals.getExpectedReturns({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        limit: 5,
      }),
  });

  // Overdue Returns query
  const overdueQuery = useQuery({
    queryKey: ['rental-overview-overdue', selectedBranchId],
    queryFn: () =>
      tenantApi.rentals.getOverdueBookings({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        limit: 5,
      }),
  });

  // Recent Activity query
  const recentActivityQuery = useQuery({
    queryKey: ['rental-overview-recent-activity', selectedBranchId],
    queryFn: () =>
      tenantApi.rentals.getRecentActivity({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        limit: 8,
      }),
  });

  // Customer History drilldown query
  const customerHistoryQuery = useQuery({
    queryKey: ['customer-rental-history', viewingCustomerId],
    queryFn: () => tenantApi.rentals.getCustomerHistory(viewingCustomerId!),
    enabled: !!viewingCustomerId,
  });



  const kpis = overviewQuery.data || {
    totalBookings: 0,
    activeReservations: 0,
    currentlyRentedUnits: 0,
    overdueRentalUnits: 0,
    availableUnits: 0,
    rentalRevenue: 0,
    outstandingRentalPayments: 0,
    securityDepositsHeld: 0,
    maintenanceUnits: 0,
    cleaningUnits: 0,
  };

  const isLoading = overviewQuery.isLoading;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP HEADER & QUICK ACTIONS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Rental Overview & Analytics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
              Live Operations
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time rental operations, reservations, returns, cash flow, and unit availability.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/salon/rentals/bookings')}
            className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Booking
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/salon/rentals/returns')}
            className="border-slate-300 dark:border-slate-700"
          >
            <ArrowLeftRight className="w-4 h-4 mr-1.5 text-blue-600" />
            Process Returns
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/salon/rentals/payments')}
            className="border-slate-300 dark:border-slate-700"
          >
            <CreditCard className="w-4 h-4 mr-1.5 text-emerald-600" />
            Collect Payment
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/salon/rentals/reports')}
            className="border-slate-300 dark:border-slate-700"
          >
            <BarChart3 className="w-4 h-4 mr-1.5 text-indigo-600" />
            Reports & History
          </Button>
        </div>
      </div>

      {/* 2. OPERATIONAL FILTERS BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Branch:</span>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Period:</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-0.5">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'this_week', label: '7 Days' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    dateFilterPreset === preset.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date indication badge & refresh */}
        <div className="flex items-center gap-3">
          {startDate && endDate && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing records from <span className="font-medium text-slate-700 dark:text-slate-300">{startDate}</span> to{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">{endDate}</span>
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              overviewQuery.refetch();
              upcomingPickupsQuery.refetch();
              expectedReturnsQuery.refetch();
              overdueQuery.refetch();
              recentActivityQuery.refetch();
            }}
            className="h-8 text-xs text-slate-500 hover:text-slate-900"
            title="Refresh Overview Data"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Sync
          </Button>
        </div>
      </div>

      {isLoading && <OpsLoading message="Loading rental operations metrics..." />}

      {/* 3. EIGHT COMPREHENSIVE KPI CARDS */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Rental Bookings (Period) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Bookings</span>
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <CalendarDays className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.totalBookings}</span>
              <span className="text-xs text-slate-400">reservations</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Period Filtered</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/bookings')}>
                View all &rarr;
              </span>
            </div>
          </div>

          {/* 2. Active Reservations (Snapshot) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Reservations</span>
              <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{kpis.activeReservations}</span>
              <span className="text-xs text-slate-400">awaiting pickup</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Current Snapshot
              </span>
              <span className="text-blue-600 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/bookings')}>
                Manage &rarr;
              </span>
            </div>
          </div>

          {/* 3. Currently Rented Physical Units (Snapshot) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Currently Rented</span>
              <span className="p-2 bg-primary/10 dark:bg-purple-950/60 text-primary dark:text-purple-400 rounded-lg">
                <Shirt className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary dark:text-purple-400">{kpis.currentlyRentedUnits}</span>
              <span className="text-xs text-slate-400">units with clients</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/100"></span> In Circulation
              </span>
              <span className="text-primary font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/returns')}>
                Track &rarr;
              </span>
            </div>
          </div>

          {/* 4. Overdue Rental Units (Snapshot - Alerting) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-600 uppercase tracking-wider font-semibold">Overdue Units</span>
              <span className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{kpis.overdueRentalUnits}</span>
              <span className="text-xs text-rose-500 font-medium">units overdue</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-rose-500">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Action Required
              </span>
              <span className="text-rose-600 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/returns')}>
                Inspect &rarr;
              </span>
            </div>
          </div>

          {/* 5. Available Physical Units (Snapshot) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Available Inventory</span>
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Box className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.availableUnits}</span>
              <span className="text-xs text-slate-400">units in salon</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{kpis.maintenanceUnits || 0} in repair</span>
              <span className="text-emerald-600 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/items')}>
                Catalog &rarr;
              </span>
            </div>
          </div>

          {/* 6. Rental Revenue (Period - Earned revenue) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rental Revenue</span>
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatMoneyLkr(kpis.rentalRevenue)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate">Rent + Fees (Excl. Deposits)</span>
              <span className="text-emerald-600 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/reports')}>
                Details &rarr;
              </span>
            </div>
          </div>

          {/* 7. Outstanding Rental Balance (Receivables) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600 uppercase tracking-wider font-semibold">Outstanding Rent</span>
              <span className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatMoneyLkr(kpis.outstandingRentalPayments)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Uncollected rental fees</span>
              <span className="text-amber-600 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/payments')}>
                Collect &rarr;
              </span>
            </div>
          </div>

          {/* 8. Security Deposits Currently Held (Liabilities) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Deposits Held</span>
              <span className="p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                {formatMoneyLkr(kpis.securityDepositsHeld)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Customer liability held</span>
              <span className="text-teal-600 font-medium cursor-pointer" onClick={() => navigate('/salon/rentals/returns')}>
                Settlement &rarr;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. OPERATIONAL WORKFLOW SECTIONS (2 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: OVERDUE ALERTS + UPCOMING PICKUPS */}
        <div className="space-y-6">
          {/* A. OVERDUE RETURNS ALERT PANEL */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/40 dark:bg-rose-950/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Overdue Returns Requiring Action
                </h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {overdueQuery.data?.length || 0} Critical
              </span>
            </div>

            <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {overdueQuery.isLoading ? (
                <p className="text-xs text-slate-400 py-3">Checking overdue units...</p>
              ) : !overdueQuery.data || overdueQuery.data.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">All rentals returned on time!</p>
                  <p className="text-xs text-slate-400 mt-0.5">There are no overdue rental units currently pending return.</p>
                </div>
              ) : (
                overdueQuery.data.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 first:pt-1 last:pb-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {item.bookingReference}
                        </span>
                        <span className="text-xs px-2 py-0.5 font-bold rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          {item.overdueDays} {item.overdueDays === 1 ? 'day' : 'days'} overdue
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setViewingCustomerId(item.id)}
                          className="text-violet-600 hover:underline font-medium"
                        >
                          {item.customerName}
                        </button>
                        {item.customerPhone && <span>· {item.customerPhone}</span>}
                        <span>· Due: {formatDisplayDate(item.returnDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                        onClick={() => navigate('/salon/rentals/returns')}
                      >
                        Inspect & Return
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* B. UPCOMING SCHEDULED PICKUPS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Upcoming Pickups & Reservations
                </h3>
              </div>
              <span className="text-xs text-slate-500">Next Scheduled Handover</span>
            </div>

            <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingPickupsQuery.isLoading ? (
                <p className="text-xs text-slate-400 py-3">Loading upcoming pickups...</p>
              ) : !upcomingPickupsQuery.data || upcomingPickupsQuery.data.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No upcoming reservations scheduled for pickup.</p>
              ) : (
                upcomingPickupsQuery.data.map((pickup) => (
                  <div key={pickup.id} className="py-3 flex items-center justify-between gap-4 first:pt-1 last:pb-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {pickup.bookingReference}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            pickup.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : pickup.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {pickup.paymentStatus === 'PAID' ? 'Fully Paid' : pickup.paymentStatus === 'PARTIALLY_PAID' ? 'Partial Deposit' : 'Unpaid'}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({pickup.itemCount} {pickup.itemCount === 1 ? 'item' : 'items'})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingCustomerId(pickup.customerId)}
                          className="text-violet-600 hover:underline font-medium"
                        >
                          {pickup.customerName}
                        </button>
                        <span>· Pickup: <strong className="text-slate-700 dark:text-slate-300">{formatDisplayDate(pickup.pickupDate)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-slate-300 hover:bg-slate-50"
                        onClick={() => navigate('/salon/rentals/bookings')}
                      >
                        Handover / Pickup
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EXPECTED RETURNS + RECENT ACTIVITY */}
        <div className="space-y-6">
          {/* C. EXPECTED RETURNS (NEXT 7 DAYS) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Expected Returns (Next 7 Days)
                </h3>
              </div>
              <span className="text-xs text-slate-500">Scheduled Inbound</span>
            </div>

            <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {expectedReturnsQuery.isLoading ? (
                <p className="text-xs text-slate-400 py-3">Loading expected returns...</p>
              ) : !expectedReturnsQuery.data || expectedReturnsQuery.data.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No active rentals due for return this week.</p>
              ) : (
                expectedReturnsQuery.data.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 first:pt-1 last:pb-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {item.bookingReference}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.outstandingUnits} of {item.totalUnits} items out
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{item.customerName}</span>
                        <span>· Return due: <strong className="text-slate-700 dark:text-slate-300">{formatDisplayDate(item.returnDate)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-slate-300 hover:bg-slate-50"
                        onClick={() => navigate('/salon/rentals/returns')}
                      >
                        Receive
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* D. RECENT RENTAL ACTIVITY FEED */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Recent Rental Activity
                </h3>
              </div>
              <span className="text-xs text-slate-500">Audit Trail</span>
            </div>

            <div className="p-4 space-y-3">
              {recentActivityQuery.isLoading ? (
                <p className="text-xs text-slate-400 py-3">Loading activity stream...</p>
              ) : !recentActivityQuery.data || recentActivityQuery.data.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No recent rental operations logged.</p>
              ) : (
                recentActivityQuery.data.map((act) => {
                  let badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                  let icon = <CalendarDays className="w-3.5 h-3.5" />;
                  if (act.type === 'PICKUP') {
                    badgeColor = 'bg-primary/10 text-primary dark:bg-purple-950 dark:text-purple-300';
                    icon = <Shirt className="w-3.5 h-3.5" />;
                  } else if (act.type === 'RETURN') {
                    badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                    icon = <ArrowLeftRight className="w-3.5 h-3.5" />;
                  } else if (act.type === 'PAYMENT') {
                    badgeColor = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
                    icon = <CreditCard className="w-3.5 h-3.5" />;
                  }

                  return (
                    <div
                      key={act.id + act.timestamp}
                      className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`p-1.5 rounded-md ${badgeColor}`}>
                          {icon}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {act.title}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {act.subtitle} · Ref: <span className="font-mono">{act.referenceNumber}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {act.amount !== undefined && act.amount !== null && (
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formatMoneyLkr(act.amount)}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDisplayDate(act.timestamp)} {formatDisplayTime(act.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. CUSTOMER RENTAL HISTORY MODAL */}
      <Dialog open={!!viewingCustomerId} onOpenChange={(open) => !open && setViewingCustomerId(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-violet-600" />
              Customer Rental History & Profile
            </DialogTitle>
          </DialogHeader>

          {customerHistoryQuery.isLoading ? (
            <OpsLoading message="Loading customer rental ledger..." />
          ) : !customerHistoryQuery.data ? (
            <p className="text-sm text-slate-500 py-6 text-center">Customer details not found.</p>
          ) : (
            <div className="space-y-6 pt-2">
              {/* Profile details */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {customerHistoryQuery.data.customer.name}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                    <span>Code: <strong>{customerHistoryQuery.data.customer.customerCode}</strong></span>
                    {customerHistoryQuery.data.customer.phone && (
                      <span>Phone: <strong>{customerHistoryQuery.data.customer.phone}</strong></span>
                    )}
                    {customerHistoryQuery.data.customer.email && (
                      <span>Email: <strong>{customerHistoryQuery.data.customer.email}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-center px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="block text-[10px] text-slate-400 uppercase">Bookings</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {customerHistoryQuery.data.summary.totalBookings}
                    </span>
                  </div>
                  <div className="text-center px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="block text-[10px] text-slate-400 uppercase">Lifetime Spend</span>
                    <span className="text-base font-bold text-emerald-600">
                      {formatMoneyLkr(customerHistoryQuery.data.summary.totalSpent)}
                    </span>
                  </div>
                  <div className="text-center px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="block text-[10px] text-slate-400 uppercase">Active Out</span>
                    <span className="text-base font-bold text-primary">
                      {customerHistoryQuery.data.summary.activeRentalsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bookings Ledger */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Rental Transactions & Reservations
                </h4>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {customerHistoryQuery.data.bookings.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center">No rental bookings on record for this customer.</p>
                  ) : (
                    customerHistoryQuery.data.bookings.map((b) => (
                      <div key={b.id} className="p-3 text-xs flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              {b.bookingReference}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {b.status}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {b.branchName}
                            </span>
                          </div>
                          <div className="text-slate-500 mt-1 flex items-center gap-3">
                            <span>Pickup: {formatDisplayDate(b.pickupDate)}</span>
                            <span>Return: {formatDisplayDate(b.returnDate)}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            Rent: {formatMoneyLkr(b.totalRent)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Deposit: {formatMoneyLkr(b.totalDeposit)} · Paid: {formatMoneyLkr(b.rentPaid)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

