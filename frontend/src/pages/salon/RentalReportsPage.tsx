import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Download,
  Search,
  DollarSign,
  Shirt,
  User,
  Tag,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { tenantApi } from '@/api/tenant.api';
import { useSalonBranch } from '@/contexts/SalonBranchContext';
import { formatMoneyLkr } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { OpsLoading, OpsPagination } from './salon-ops-ui';

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

type ReportTab = 'financial' | 'activity' | 'categories' | 'history';

export default function RentalReportsPage() {
  const { branchId: activeBranchId, branches } = useSalonBranch();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    if (tabParam === 'history' || tabParam === 'financial' || tabParam === 'activity' || tabParam === 'categories') {
      return tabParam;
    }
    return 'financial';
  });

  useEffect(() => {
    if (tabParam === 'history' || tabParam === 'financial' || tabParam === 'activity' || tabParam === 'categories') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || 'all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState<string>(getMonthStartStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());

  // Rental History Ledger Filters & Pagination
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatus, setHistoryStatus] = useState<string>('all');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyLimit, setHistoryLimit] = useState<number>(10);

  // Drilldown Modals
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handlePresetChange = (preset: 'all' | 'today' | 'this_week' | 'this_month' | 'custom') => {
    setDatePreset(preset);
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

  // Queries
  const summaryQuery = useQuery({
    queryKey: ['rental-reports-summary', selectedBranchId, startDate, endDate],
    queryFn: () =>
      tenantApi.rentals.getReportsSummary({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const revenueTrendQuery = useQuery({
    queryKey: ['rental-revenue-trend', selectedBranchId, startDate, endDate],
    queryFn: () =>
      tenantApi.rentals.getRevenueTrend({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: activeTab === 'financial',
  });

  const activityTrendQuery = useQuery({
    queryKey: ['rental-activity-trend', selectedBranchId, startDate, endDate],
    queryFn: () =>
      tenantApi.rentals.getActivityTrend({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: activeTab === 'activity',
  });

  const categoryBreakdownQuery = useQuery({
    queryKey: ['rental-category-breakdown', selectedBranchId, startDate, endDate],
    queryFn: () =>
      tenantApi.rentals.getCategoryBreakdown({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: activeTab === 'categories',
  });

  const unitStatusQuery = useQuery({
    queryKey: ['rental-unit-status-distribution', selectedBranchId],
    queryFn: () =>
      tenantApi.rentals.getUnitStatusDistribution(selectedBranchId !== 'all' ? selectedBranchId : undefined),
    enabled: activeTab === 'categories',
  });

  const historyQuery = useQuery({
    queryKey: [
      'rental-history-ledger',
      selectedBranchId,
      historyStatus,
      historySearch,
      startDate,
      endDate,
      historyPage,
      historyLimit,
    ],
    queryFn: () =>
      tenantApi.rentals.getHistory({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        status: historyStatus !== 'all' ? historyStatus : undefined,
        search: historySearch.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: historyPage,
        limit: historyLimit,
      }),
    enabled: activeTab === 'history',
  });

  // Customer History drilldown query
  const customerHistoryQuery = useQuery({
    queryKey: ['customer-rental-history-report', viewingCustomerId],
    queryFn: () => tenantApi.rentals.getCustomerHistory(viewingCustomerId!),
    enabled: !!viewingCustomerId,
  });



  // CSV Export
  const handleExportCsv = async (reportType: string = 'bookings') => {
    try {
      setIsExporting(true);
      const csvData = await tenantApi.rentals.exportReportsCsv({
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        reportType,
      });

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rental-${reportType}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Report CSV downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to export CSV: ' + (err?.message || 'Server error'));
    } finally {
      setIsExporting(false);
    }
  };

  const summary = summaryQuery.data || {
    totalRentals: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    rentalRevenue: 0,
    rentalCharges: 0,
    totalLateFees: 0,
    totalDamageCharges: 0,
    cashCollected: 0,
    depositsRefunded: 0,
    outstandingReceivables: 0,
    currentlyRentedCount: 0,
    availableItemsCount: 0,
    overdueItemsCount: 0,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HEADER & EXPORT */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Rental Financial & Historical Reports
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
              Audit & Ledger
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Revenue recognition, earned rental fees, cash receivables, asset status, and complete history ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isExporting}
            onClick={() => {
              if (activeTab === 'financial') handleExportCsv('revenue');
              else if (activeTab === 'categories') handleExportCsv('categories');
              else handleExportCsv('bookings');
            }}
            className="border-slate-300 dark:border-slate-700 shadow-xs"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-600" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* 2. FILTERS BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                    datePreset === preset.id
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

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              summaryQuery.refetch();
              if (activeTab === 'financial') revenueTrendQuery.refetch();
              if (activeTab === 'activity') activityTrendQuery.refetch();
              if (activeTab === 'categories') {
                categoryBreakdownQuery.refetch();
                unitStatusQuery.refetch();
              }
              if (activeTab === 'history') historyQuery.refetch();
            }}
            className="h-8 text-xs text-slate-500 hover:text-slate-900"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Sync Reports
          </Button>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'financial'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Financial Summary & Revenue
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Rental Activity & Trends
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Shirt className="w-4 h-4" />
            Category & Inventory Status
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Full Rental History Ledger
          </button>
        </nav>
      </div>

      {/* TAB 1: FINANCIAL & REVENUE REPORTS */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Earned Rental Revenue */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Total Rental Revenue
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                {formatMoneyLkr(summary.rentalRevenue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Rent: {formatMoneyLkr(summary.rentalCharges)} + Fees: {formatMoneyLkr(summary.totalLateFees + summary.totalDamageCharges)}
              </div>
            </div>

            {/* 2. Outstanding Receivables */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-amber-600 uppercase tracking-wider block font-semibold">
                Outstanding Balance
              </span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {formatMoneyLkr(summary.outstandingReceivables)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Uncollected earned rental receivables
              </div>
            </div>

            {/* 3. Cash Collected */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider block font-semibold">
                Gross Cash Collected
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatMoneyLkr(summary.cashCollected)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                All rental & deposit payments received
              </div>
            </div>

            {/* 4. Deposits Refunded */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Deposits Refunded
              </span>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">
                {formatMoneyLkr(summary.depositsRefunded)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Settled deposit liability returns
              </div>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Rental Revenue Trend
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily progression of earned rent and inspection fees.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-indigo-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span> Total Revenue
                </span>
                <span className="inline-flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-400"></span> Rental Charges
                </span>
              </div>
            </div>

            <div className="h-[280px] w-full">
              {revenueTrendQuery.isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-slate-400">Loading revenue trend...</p>
                </div>
              ) : !revenueTrendQuery.data || revenueTrendQuery.data.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-slate-400">No rental revenue records found for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrendQuery.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="date"
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatMoneyLkr(Number(val)), 'Amount']}
                      labelFormatter={(lbl) => `Date: ${lbl}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalRevenue"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                      name="Total Revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="rentalCharges"
                      stroke="#60A5FA"
                      strokeWidth={1.5}
                      fillOpacity={0}
                      name="Rent Base"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RENTAL ACTIVITY & TRENDS */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Total Bookings Recorded
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                {summary.totalRentals}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Confirmed + Cancelled</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider block font-semibold">
                Confirmed Rentals
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {summary.confirmedBookings}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Active, In-Progress, or Returned</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Cancelled Bookings
              </span>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">
                {summary.cancelledBookings}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Reverted without handover</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Booking & Handover Activity Volume
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily counts of reservations created, units handed over, and cancellations.
                </p>
              </div>
            </div>

            <div className="h-[280px] w-full">
              {activityTrendQuery.isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-slate-400">Loading activity trend...</p>
                </div>
              ) : !activityTrendQuery.data || activityTrendQuery.data.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-slate-400">No activity logged for this time range.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityTrendQuery.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="date"
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="confirmedBookings" fill="#4F46E5" name="Bookings Reserved" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pickedUpCount" fill="#10B981" name="Units Handed Over" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelledBookings" fill="#F43F5E" name="Cancelled" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORY & INVENTORY STATUS */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Performance Breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Category Performance & Revenue Share
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">
                Which rental segments generate the highest bookings and revenue.
              </p>

              <div className="space-y-4">
                {categoryBreakdownQuery.isLoading ? (
                  <p className="text-xs text-slate-400">Loading categories...</p>
                ) : !categoryBreakdownQuery.data || categoryBreakdownQuery.data.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No category data recorded.</p>
                ) : (
                  categoryBreakdownQuery.data.map((cat) => (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {cat.category.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-mono">
                            {cat.unitsRented} units ({cat.bookingCount} bookings)
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatMoneyLkr(cat.rentalRevenue)}
                          </span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400 w-9 text-right">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Physical Unit Fleet Status Distribution */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Physical Inventory Status Fleet
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">
                Current operational availability across all physical unit copies.
              </p>

              <div className="space-y-3">
                {unitStatusQuery.isLoading ? (
                  <p className="text-xs text-slate-400">Loading fleet statuses...</p>
                ) : !unitStatusQuery.data || unitStatusQuery.data.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No units registered.</p>
                ) : (
                  unitStatusQuery.data.map((st) => {
                    let colorClass = 'bg-slate-500';
                    let label = st.status;
                    if (st.status === 'AVAILABLE') colorClass = 'bg-emerald-500';
                    else if (st.status === 'RENTED') colorClass = 'bg-purple-500';
                    else if (st.status === 'RESERVED') colorClass = 'bg-blue-500';
                    else if (st.status === 'CLEANING') colorClass = 'bg-amber-500';
                    else if (st.status === 'MAINTENANCE') colorClass = 'bg-rose-500';

                    return (
                      <div
                        key={st.status}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${colorClass}`}></span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{st.count} units</span>
                          <span className="text-slate-500 text-[11px] w-9 text-right font-medium">{st.percentage}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FULL RENTAL HISTORY LEDGER */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar for Ledger */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search reference, customer, item, unit..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={historyStatus}
                onValueChange={(val) => {
                  setHistoryStatus(val);
                  setHistoryPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="RESERVED">RESERVED</SelectItem>
                  <SelectItem value="PICKED_UP">PICKED_UP</SelectItem>
                  <SelectItem value="PARTIALLY_RETURNED">PARTIALLY_RETURNED</SelectItem>
                  <SelectItem value="RETURNED">RETURNED</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Booking Ref</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Items & Units</th>
                    <th className="px-4 py-3 text-right">Rent Total</th>
                    <th className="px-4 py-3 text-right">Paid Rent</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {historyQuery.isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        <OpsLoading message="Loading rental history records..." />
                      </td>
                    </tr>
                  ) : !historyQuery.data?.data || historyQuery.data.data.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No rental history records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    historyQuery.data.data.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white font-mono">
                          {b.bookingReference}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setViewingCustomerId(b.customerId)}
                            className="font-medium text-violet-600 hover:underline text-left block"
                          >
                            {b.customerName}
                          </button>
                          {b.customerPhone && <span className="text-[11px] text-slate-400">{b.customerPhone}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{b.branchName}</td>
                        <td className="px-4 py-3">
                          <span className="block text-slate-800 dark:text-slate-200">
                            {formatDisplayDate(b.pickupDate)}
                          </span>
                          <span className="text-[11px] text-slate-400">to {formatDisplayDate(b.returnDate)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 max-w-[220px]">
                            {b.items?.map((it, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 truncate">
                                <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{it.itemName}</span>
                                <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                                  {it.unitCode}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                          {formatMoneyLkr(b.totalRent)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                          {formatMoneyLkr(b.rentPaid)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${b.netBalance > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {formatMoneyLkr(b.netBalance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              b.status === 'RETURNED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : b.status === 'PICKED_UP'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : b.status === 'PARTIALLY_RETURNED'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : b.status === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyQuery.data?.meta && historyQuery.data.meta.total > 0 && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                <OpsPagination
                  page={historyPage}
                  limit={historyLimit}
                  total={historyQuery.data.meta.total}
                  totalPages={historyQuery.data.meta.totalPages}
                  onPageChange={setHistoryPage}
                  onLimitChange={(sz: number) => {
                    setHistoryLimit(sz);
                    setHistoryPage(1);
                  }}
                  itemLabel="bookings"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* CUSTOMER RENTAL HISTORY MODAL */}
      <Dialog open={!!viewingCustomerId} onOpenChange={(open) => !open && setViewingCustomerId(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Customer Rental Profile & History
            </DialogTitle>
          </DialogHeader>

          {customerHistoryQuery.isLoading ? (
            <OpsLoading message="Loading customer profile..." />
          ) : !customerHistoryQuery.data ? (
            <p className="text-sm text-slate-500 py-6 text-center">Customer details not found.</p>
          ) : (
            <div className="space-y-6 pt-2">
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
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Rental Transactions Log
                </h4>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {customerHistoryQuery.data.bookings.map((b) => (
                    <div key={b.id} className="p-3 text-xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">
                            {b.bookingReference}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {b.status}
                          </span>
                          <span className="text-slate-400 text-[11px]">{b.branchName}</span>
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
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

