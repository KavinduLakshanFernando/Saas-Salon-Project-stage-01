import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Filter,
  History,
  Inbox,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { adminSmsApi } from '@/features/sms/api/admin-sms.api';
import type { AdminSalonSmsItem, SmsRechargeRequestItem } from '@/features/sms/types/sms.types';

export default function AdminSmsPackagesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'salons' | 'requests' | 'ledger' | 'logs'>('salons');

  // Search & Filter state for Salons
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [salonsPage, setSalonsPage] = useState(1);

  // Recharge Requests State
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsStatusFilter, setRequestsStatusFilter] = useState<string>('ALL');
  const [requestsSearch, setRequestsSearch] = useState('');

  // Pagination for sub-tabs
  const [ledgerPage, setLedgerPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  // Modals state
  const [activateSalon, setActivateSalon] = useState<AdminSalonSmsItem | null>(null);
  const [activateCredits, setActivateCredits] = useState<number>(1000);
  const [activateNotes, setActivateNotes] = useState<string>('');

  const [addCreditsSalon, setAddCreditsSalon] = useState<AdminSalonSmsItem | null>(null);
  const [additionalCredits, setAdditionalCredits] = useState<number>(1000);
  const [addCreditsNotes, setAddCreditsNotes] = useState<string>('');

  const [deactivateSalon, setDeactivateSalon] = useState<AdminSalonSmsItem | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Request Modals
  const [fulfillRequestItem, setFulfillRequestItem] = useState<SmsRechargeRequestItem | null>(null);
  const [fulfillCredits, setFulfillCredits] = useState<number>(1000);
  const [fulfillNotes, setFulfillNotes] = useState<string>('');

  const [rejectRequestItem, setRejectRequestItem] = useState<SmsRechargeRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // History Drawer state
  const [historySalon, setHistorySalon] = useState<AdminSalonSmsItem | null>(null);
  const [historySubTab, setHistorySubTab] = useState<'transactions' | 'logs'>('transactions');

  // 1. Fetch Salons Directory
  const { data: salonsData, isLoading: isSalonsLoading, refetch: refetchSalons } = useQuery({
    queryKey: ['admin-sms-salons', search, planFilter, statusFilter, salonsPage],
    queryFn: () =>
      adminSmsApi.listSalons({
        search: search.trim() || undefined,
        plan: planFilter === 'ALL' ? undefined : planFilter,
        page: salonsPage,
        limit: 10,
      }),
  });

  // 1.5 Fetch Recharge Requests
  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['admin-sms-requests', requestsPage, requestsStatusFilter, requestsSearch],
    queryFn: () =>
      adminSmsApi.listRechargeRequests({
        page: requestsPage,
        limit: 10,
        status: requestsStatusFilter === 'ALL' ? undefined : requestsStatusFilter,
        search: requestsSearch.trim() || undefined,
      }),
    enabled: activeTab === 'requests',
  });

  // Fetch pending count for tab badge
  const { data: pendingRequestsData } = useQuery({
    queryKey: ['admin-sms-pending-count'],
    queryFn: () => adminSmsApi.listRechargeRequests({ status: 'PENDING', limit: 1 }),
    refetchInterval: 30000,
  });
  const pendingRequestsCount = pendingRequestsData?.meta?.total ?? 0;

  // 2. Fetch Global Credit Ledger
  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['admin-sms-transactions', ledgerPage],
    queryFn: () => adminSmsApi.getGlobalTransactions({ page: ledgerPage, limit: 15 }),
    enabled: activeTab === 'ledger',
  });

  // 3. Fetch Global SMS Logs
  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['admin-sms-logs', logsPage],
    queryFn: () => adminSmsApi.getGlobalLogs({ page: logsPage, limit: 15 }),
    enabled: activeTab === 'logs',
  });

  // Salon History Drawer Queries
  const { data: salonTxData, isLoading: isSalonTxLoading } = useQuery({
    queryKey: ['admin-sms-salon-tx', historySalon?.id],
    queryFn: () =>
      adminSmsApi.getGlobalTransactions({ tenantId: historySalon!.id, page: 1, limit: 20 }),
    enabled: !!historySalon && historySubTab === 'transactions',
  });

  const { data: salonLogsData, isLoading: isSalonLogsLoading } = useQuery({
    queryKey: ['admin-sms-salon-logs', historySalon?.id],
    queryFn: () => adminSmsApi.getGlobalLogs({ tenantId: historySalon!.id, page: 1, limit: 20 }),
    enabled: !!historySalon && historySubTab === 'logs',
  });

  // Mutations
  const activateMutation = useMutation({
    mutationFn: ({
      tenantId,
      credits,
      notes,
    }: {
      tenantId: string;
      credits: number;
      notes?: string;
    }) => adminSmsApi.activateSms(tenantId, { credits, notes }),
    onSuccess: (res) => {
      toast.success('SMS Activated Successfully', {
        description: res.message,
      });
      setActivateSalon(null);
      setActivateCredits(1000);
      setActivateNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-salons'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-transactions'] });
    },
    onError: (err: any) => {
      toast.error('Failed to activate SMS', {
        description: err.response?.data?.message || err.message,
      });
    },
  });

  const addCreditsMutation = useMutation({
    mutationFn: ({
      tenantId,
      credits,
      notes,
    }: {
      tenantId: string;
      credits: number;
      notes?: string;
    }) => adminSmsApi.addCredits(tenantId, { credits, notes }),
    onSuccess: (res) => {
      toast.success('Credits Allocated Successfully', {
        description: res.message,
      });
      setAddCreditsSalon(null);
      setAdditionalCredits(1000);
      setAddCreditsNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-salons'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-transactions'] });
    },
    onError: (err: any) => {
      toast.error('Failed to allocate credits', {
        description: err.response?.data?.message || err.message,
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ tenantId, reason }: { tenantId: string; reason?: string }) =>
      adminSmsApi.deactivateSms(tenantId, reason),
    onSuccess: (res) => {
      toast.success('SMS Deactivated', {
        description: res.message,
      });
      setDeactivateSalon(null);
      setDeactivateReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-salons'] });
    },
    onError: (err: any) => {
      toast.error('Failed to deactivate SMS', {
        description: err.response?.data?.message || err.message,
      });
    },
  });

  const fulfillRequestMutation = useMutation({
    mutationFn: ({
      id,
      credits,
      adminNotes,
    }: {
      id: string;
      credits?: number;
      adminNotes?: string;
    }) => adminSmsApi.fulfillRechargeRequest(id, { credits, adminNotes }),
    onSuccess: (res) => {
      toast.success('Request Fulfilled', {
        description: res.message,
      });
      setFulfillRequestItem(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-pending-count'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-salons'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-transactions'] });
    },
    onError: (err: any) => {
      toast.error('Failed to fulfill request', {
        description: err.response?.data?.message || err.message,
      });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminSmsApi.rejectRechargeRequest(id, reason),
    onSuccess: (res) => {
      toast.success('Request Rejected', {
        description: res.message,
      });
      setRejectRequestItem(null);
      setRejectReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sms-pending-count'] });
    },
    onError: (err: any) => {
      toast.error('Failed to reject request', {
        description: err.response?.data?.message || err.message,
      });
    },
  });

  const handleOpenFulfillRequest = (req: SmsRechargeRequestItem) => {
    setFulfillRequestItem(req);
    setFulfillCredits(req.package?.credits || req.requestedCredits || 1000);
    setFulfillNotes('');
  };

  const handleOpenRejectRequest = (req: SmsRechargeRequestItem) => {
    setRejectRequestItem(req);
    setRejectReason('');
  };

  const handleFulfillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillRequestItem) return;
    if (fulfillCredits <= 0) {
      toast.error('Credits must be greater than 0');
      return;
    }
    fulfillRequestMutation.mutate({
      id: fulfillRequestItem.id,
      credits: fulfillCredits,
      adminNotes: fulfillNotes.trim() || undefined,
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectRequestItem) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    rejectRequestMutation.mutate({
      id: rejectRequestItem.id,
      reason: rejectReason.trim(),
    });
  };

  const handleOpenActivate = (salon: AdminSalonSmsItem) => {
    setActivateSalon(salon);
    setActivateCredits(1000);
    setActivateNotes('');
  };

  const handleOpenAddCredits = (salon: AdminSalonSmsItem) => {
    setAddCreditsSalon(salon);
    setAdditionalCredits(1000);
    setAddCreditsNotes('');
  };

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateSalon) return;
    activateMutation.mutate({
      tenantId: activateSalon.id,
      credits: Number(activateCredits) || 0,
      notes: activateNotes.trim() || undefined,
    });
  };

  const handleAddCreditsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCreditsSalon) return;
    if (additionalCredits <= 0) {
      toast.error('Credits must be greater than 0');
      return;
    }
    addCreditsMutation.mutate({
      tenantId: addCreditsSalon.id,
      credits: Number(additionalCredits),
      notes: addCreditsNotes.trim() || undefined,
    });
  };

  const salons = salonsData?.data ?? [];
  const filteredSalons = salons.filter((s) => {
    if (statusFilter === 'ACTIVE') return !s.isPlanCovered && s.wallet.isActive;
    if (statusFilter === 'INACTIVE') return !s.isPlanCovered && !s.wallet.isActive;
    if (statusFilter === 'PLAN_INCLUDED') return s.isPlanCovered;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
              <MessageSquare size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Salon SMS Management Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Super Admin control for Basic/Silver SMS activation, credit allocation, and usage monitoring.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetchSalons()}
          className="h-9 gap-1.5 text-xs font-semibold rounded-lg shadow-sm border-slate-200 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw size={13} className={isSalonsLoading ? 'animate-spin' : ''} />
          <span>Refresh Salons</span>
        </Button>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('salons')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'salons'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Building2 size={16} /> Salons SMS Directory
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'requests'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Inbox size={16} /> Recharge Requests
            {pendingRequestsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'ledger'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Coins size={16} /> Credit Adjustment History
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'logs'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Send size={16} /> Global SMS Logs
          </span>
        </button>
      </div>

      {/* TAB 1: Salons SMS Directory */}
      {activeTab === 'salons' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search salons by name, code, phone, or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSalonsPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter size={14} />
                <span>Plan:</span>
              </div>
              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setSalonsPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">All Plans</option>
                <option value="SILVER">Basic / Silver (Add-on)</option>
                <option value="GOLD">Gold (Included)</option>
                <option value="PLATINUM">Platinum (Included)</option>
                <option value="ENTERPRISE">Enterprise (Included)</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
                <span>SMS Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Disabled</option>
                <option value="PLAN_INCLUDED">Plan Included</option>
              </select>
            </div>
          </div>

          {/* Salons Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isSalonsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-indigo-600" />
                <span className="text-xs font-medium">Loading salons…</span>
              </div>
            ) : filteredSalons.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <Building2 size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No salons found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Salon Name & Code</th>
                      <th className="py-3 px-4">Subscription Plan</th>
                      <th className="py-3 px-4">SMS Status</th>
                      <th className="py-3 px-4 text-right">Available Credits</th>
                      <th className="py-3 px-4 text-right">Total Consumed</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredSalons.map((salon) => {
                      const isCovered = salon.isPlanCovered;
                      const isActive = salon.wallet.isActive;
                      const balance = salon.wallet.balance;

                      return (
                        <tr key={salon.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Name & Code */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{salon.name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{salon.code}</div>
                          </td>

                          {/* Subscription Plan */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isCovered
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {salon.planName || salon.planCode || 'Basic / Silver'}
                            </span>
                          </td>

                          {/* SMS Status */}
                          <td className="py-3.5 px-4">
                            {isCovered ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} /> Plan Included
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <PauseCircle size={11} className="text-amber-500" /> Disabled
                              </span>
                            )}
                          </td>

                          {/* Available Credits */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold">
                            {isCovered ? (
                              <span className="text-emerald-600 font-semibold text-xs">Unlimited</span>
                            ) : (
                              <span
                                className={
                                  balance === 0
                                    ? 'text-rose-600'
                                    : balance <= salon.wallet.lowBalanceThreshold
                                      ? 'text-amber-600'
                                      : 'text-slate-900'
                                }
                              >
                                {balance.toLocaleString()}
                              </span>
                            )}
                          </td>

                          {/* Total Consumed */}
                          <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                            {salon.wallet.totalConsumed.toLocaleString()}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {isCovered ? (
                                <span className="text-xs text-slate-400 italic">No action needed</span>
                              ) : !isActive ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenActivate(salon)}
                                  className="h-7 text-xs font-semibold px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-xs cursor-pointer"
                                >
                                  <PlayCircle size={13} />
                                  <span>Activate SMS</span>
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleOpenAddCredits(salon)}
                                    className="h-7 text-xs font-semibold px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white gap-1 shadow-xs cursor-pointer"
                                  >
                                    <Plus size={13} />
                                    <span>Add Credits</span>
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeactivateSalon(salon)}
                                    className="h-7 text-xs font-semibold px-2 rounded-lg text-slate-600 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                                    title="Disable SMS"
                                  >
                                    <PauseCircle size={13} />
                                  </Button>
                                </>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setHistorySalon(salon)}
                                className="h-7 text-xs px-2 text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="View History"
                              >
                                <History size={13} />
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
            {salonsData && salonsData.meta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing page {salonsData.meta.page} of {salonsData.meta.totalPages} ({salonsData.meta.total} salons)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={salonsPage <= 1}
                    onClick={() => setSalonsPage((p) => Math.max(1, p - 1))}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={salonsPage >= salonsData.meta.totalPages}
                    onClick={() => setSalonsPage((p) => p + 1)}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Salon SMS Recharge Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search requests by salon name, code, or owner notes..."
                value={requestsSearch}
                onChange={(e) => {
                  setRequestsSearch(e.target.value);
                  setRequestsPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter size={14} />
                <span>Status:</span>
              </div>
              <select
                value={requestsStatusFilter}
                onChange={(e) => {
                  setRequestsStatusFilter(e.target.value);
                  setRequestsPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetchRequests()}
                className="h-9 gap-1 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw size={13} className={isRequestsLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isRequestsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-indigo-600" />
                <span className="text-xs font-medium">Loading recharge requests…</span>
              </div>
            ) : !requestsData || requestsData.data.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <Inbox size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No recharge requests found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Salon owner admin-assisted requests will appear here for review and fulfillment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Salon Name & Code</th>
                      <th className="py-3 px-4">Requested Package / Credits</th>
                      <th className="py-3 px-4">Owner Message</th>
                      <th className="py-3 px-4">Date Requested</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Fulfillment Details</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {requestsData.data.map((req) => {
                      const isPending = req.status === 'PENDING' || req.status === 'APPROVED';
                      const creditsDisplay = req.package?.credits || req.requestedCredits;
                      const packageName = req.package?.name;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Salon */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{req.tenant?.name || 'Salon'}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {req.tenant?.code || req.tenantId.slice(0, 8)}
                            </div>
                          </td>

                          {/* Package / Credits */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-indigo-700">
                              {packageName || 'Custom Credit Request'}
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-900">
                              {creditsDisplay.toLocaleString()} credits
                              {req.package?.price && (
                                <span className="text-slate-400 font-normal ml-1">
                                  (LKR {req.package.price.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Owner Message */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {(req.ownerMessage || req.ownerNotes) ? (
                              <p className="text-xs text-slate-600 line-clamp-2 italic">
                                "{req.ownerMessage || req.ownerNotes}"
                              </p>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* Date Requested */}
                          <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(req.createdAt).toLocaleString('en-LK', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {req.status === 'PENDING' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock size={11} /> Pending Review
                              </span>
                            ) : req.status === 'APPROVED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Approved
                              </span>
                            ) : req.status === 'FULFILLED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} /> Fulfilled
                              </span>
                            ) : req.status === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle size={11} /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Cancelled
                              </span>
                            )}
                          </td>

                          {/* Fulfillment Details */}
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            {req.status === 'FULFILLED' ? (
                              <div>
                                <span className="font-semibold text-slate-800">
                                  {req.actionedBy?.name || req.processedBy?.name || 'Administrator'}
                                </span>
                                {req.adminNotes && (
                                  <div className="text-[11px] text-slate-500 italic mt-0.5">
                                    "{req.adminNotes}"
                                  </div>
                                )}
                                {req.fulfilledAt && (
                                  <div className="text-[10px] text-slate-400">
                                    {new Date(req.fulfilledAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : req.status === 'REJECTED' ? (
                              <span className="text-rose-600 text-[11px]">
                                {req.adminNotes || req.rejectionReason || 'No reason provided'}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenFulfillRequest(req)}
                                  className="h-7 text-xs font-semibold px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-xs cursor-pointer"
                                >
                                  <PlayCircle size={13} />
                                  <span>Fulfill</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenRejectRequest(req)}
                                  className="h-7 text-xs font-semibold px-2 rounded-lg text-slate-600 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                                  title="Reject Request"
                                >
                                  <X size={13} />
                                  <span>Reject</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Completed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {requestsData && requestsData.meta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing page {requestsData.meta.page} of {requestsData.meta.totalPages} ({requestsData.meta.total} requests)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={requestsPage <= 1}
                    onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={requestsPage >= requestsData.meta.totalPages}
                    onClick={() => setRequestsPage((p) => p + 1)}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Credit Adjustment History (Ledger) */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Credit Adjustment & Allocation History</h3>
            <p className="text-xs text-slate-500">
              Audit trail of all Super Admin credit allocations, activations, and deductions.
            </p>
          </div>

          {isLedgerLoading ? (
            <div className="py-16 flex items-center justify-center text-slate-400 gap-2">
              <RefreshCw size={20} className="animate-spin text-indigo-600" />
              <span className="text-xs">Loading ledger…</span>
            </div>
          ) : !ledgerData || ledgerData.data.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Coins size={36} className="mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-sm">No credit transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Salon</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerData.data.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString('en-LK', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {tx.tenant?.name || 'Salon'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            tx.type === 'ADJUSTMENT' || tx.type === 'PURCHASE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.type === 'USAGE'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{tx.description || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {tx.amount > 0 ? (
                          <span className="text-emerald-600">+{tx.amount.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-800">{tx.amount.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {tx.balanceAfter.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ledgerData && ledgerData.meta.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing page {ledgerData.meta.page} of {ledgerData.meta.totalPages} ({ledgerData.meta.total} records)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage >= ledgerData.meta.totalPages}
                  onClick={() => setLedgerPage((p) => p + 1)}
                  className="h-7 text-xs cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Global SMS Dispatch Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Global SMS Dispatch Logs</h3>
            <p className="text-xs text-slate-500">Delivery records across all salons via SMSLenz gateway.</p>
          </div>

          {isLogsLoading ? (
            <div className="py-16 flex items-center justify-center text-slate-400 gap-2">
              <RefreshCw size={20} className="animate-spin text-indigo-600" />
              <span className="text-xs">Loading logs…</span>
            </div>
          ) : !logsData || logsData.data.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Send size={36} className="mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-sm">No SMS messages logged yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Salon</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Segments</th>
                    <th className="py-3 px-4">Deducted</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsData.data.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-LK', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {log.tenantName || 'Salon'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{log.recipientMasked}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {log.purpose}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{log.segments}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.creditsDeducted > 0 ? (
                          <span className="text-rose-600">-{log.creditsDeducted}</span>
                        ) : (
                          <span className="text-slate-400">0 (Plan Quota)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {log.status === 'SUBMITTED' || log.status === 'DELIVERED' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <CheckCircle2 size={11} /> Sent
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100"
                            title={log.providerError || undefined}
                          >
                            <AlertCircle size={11} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {logsData && logsData.meta.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing page {logsData.meta.page} of {logsData.meta.totalPages} ({logsData.meta.total} logs)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logsPage <= 1}
                  onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logsPage >= logsData.meta.totalPages}
                  onClick={() => setLogsPage((p) => p + 1)}
                  className="h-7 text-xs cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Activate SMS & Add Credits */}
      {activateSalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <PlayCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Activate SMS Notifications</h3>
                  <p className="text-xs text-slate-500">Enable outgoing SMS and allocate initial credits</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivateSalon(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleActivateSubmit} className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Salon Name:</span>
                  <span className="font-bold text-slate-900">{activateSalon.name}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-500">Current Balance:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {activateSalon.wallet.balance} credits
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  SMS Credits to Allocate *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={activateCredits || ''}
                    onChange={(e) => setActivateCredits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Enter the number of credits to grant (e.g. 1,000 credits). Can be 0 if activating without initial credits.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  value={activateNotes}
                  onChange={(e) => setActivateNotes(e.target.value)}
                  placeholder="e.g. First-time onboarding, external payment handled"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-start gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Activating will enable outgoing SMS (eBills and reminders) for <strong>{activateSalon.name}</strong> and add <strong>{activateCredits.toLocaleString()} credits</strong> to their balance.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActivateSalon(null)}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={activateMutation.isPending}
                  className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  {activateMutation.isPending ? 'Activating…' : 'Activate SMS & Add Credits'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Credits Modal (For Active Salons) */}
      {addCreditsSalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add SMS Credits</h3>
                  <p className="text-xs text-slate-500">Allocate additional SMS credits to salon wallet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddCreditsSalon(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCreditsSubmit} className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Salon Name:</span>
                  <span className="font-bold text-slate-900">{addCreditsSalon.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Current Balance:</span>
                  <span className="font-mono font-bold text-indigo-600">
                    {addCreditsSalon.wallet.balance.toLocaleString()} credits
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Additional SMS Credits *
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={additionalCredits || ''}
                  onChange={(e) => setAdditionalCredits(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
                  New Balance: {(addCreditsSalon.wallet.balance + (additionalCredits || 0)).toLocaleString()} credits
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  value={addCreditsNotes}
                  onChange={(e) => setAddCreditsNotes(e.target.value)}
                  placeholder="e.g. Offline credit top-up"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddCreditsSalon(null)}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={addCreditsMutation.isPending}
                  className="h-9 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  {addCreditsMutation.isPending ? 'Allocating…' : 'Add Credits'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Deactivate SMS */}
      {deactivateSalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <PauseCircle size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Disable SMS Notifications</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeactivateSalon(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Disable SMS messaging for <span className="font-bold text-slate-900">{deactivateSalon.name}</span>?
              </p>

              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 text-xs flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Credit Balance Will Be Preserved</span>
                  <span>
                    The salon remaining balance of{' '}
                    <strong className="font-mono">{deactivateSalon.wallet.balance.toLocaleString()} credits</strong>{' '}
                    will NOT be lost. Reactivating later will restore access to these credits.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Deactivation (Optional):
                </label>
                <input
                  type="text"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder="e.g. Requested by salon owner"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeactivateSalon(null)}
                className="h-9 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={deactivateMutation.isPending}
                onClick={() =>
                  deactivateMutation.mutate({
                    tenantId: deactivateSalon.id,
                    reason: deactivateReason.trim() || undefined,
                  })
                }
                className="h-9 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                {deactivateMutation.isPending ? 'Deactivating…' : 'Confirm Deactivation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Fulfill Recharge Request */}
      {fulfillRequestItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <PlayCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Fulfill Recharge Request</h3>
                  <p className="text-xs text-slate-500">Allocate requested SMS credits to salon wallet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFulfillRequestItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFulfillSubmit} className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Salon Name:</span>
                  <span className="font-bold text-slate-900">
                    {fulfillRequestItem.tenant?.name || 'Salon'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Requested Package:</span>
                  <span className="font-semibold text-indigo-600">
                    {fulfillRequestItem.package?.name || 'Custom Credit Request'}
                  </span>
                </div>
                {(fulfillRequestItem.ownerMessage || fulfillRequestItem.ownerNotes) && (
                  <div className="pt-1 border-t border-slate-200/60 text-slate-600">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Salon Owner Note:</span>
                    <span className="italic">"{fulfillRequestItem.ownerMessage || fulfillRequestItem.ownerNotes}"</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  SMS Credits to Credit *
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={fulfillCredits || ''}
                  onChange={(e) => setFulfillCredits(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Credits will be atomically added to the tenant's authoritative SMS wallet.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Admin Fulfillment Notes (Optional)
                </label>
                <input
                  type="text"
                  value={fulfillNotes}
                  onChange={(e) => setFulfillNotes(e.target.value)}
                  placeholder="e.g. Approved via bank transfer / direct confirmation"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-start gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Confirming will link an audit transaction, update the request status to <strong>FULFILLED</strong>, and immediately credit the salon's SMS wallet.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFulfillRequestItem(null)}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={fulfillRequestMutation.isPending}
                  className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  {fulfillRequestMutation.isPending ? 'Fulfilling…' : 'Confirm & Allocate Credits'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reject Recharge Request */}
      {rejectRequestItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reject Recharge Request</h3>
                  <p className="text-xs text-slate-500">Decline salon owner's SMS credit request</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectRequestItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Salon Name:</span>
                  <span className="font-bold text-slate-900">
                    {rejectRequestItem.tenant?.name || 'Salon'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-500">Requested:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {(rejectRequestItem.package?.credits || rejectRequestItem.requestedCredits).toLocaleString()} credits
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Duplicate request, please use self-service PayHere checkout or contact billing support"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  The salon owner will see this rejection reason in their SMS management history.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectRequestItem(null)}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={rejectRequestMutation.isPending}
                  className="h-9 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                >
                  {rejectRequestMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: Salon History Drawer */}
      {historySalon && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between">
            {/* Drawer Header */}
            <div>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{historySalon.name}</h3>
                  <p className="text-xs text-slate-500">
                    SMS History • Balance: {historySalon.wallet.balance.toLocaleString()} credits
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistorySalon(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 pt-2">
                <button
                  type="button"
                  onClick={() => setHistorySubTab('transactions')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 cursor-pointer ${
                    historySubTab === 'transactions'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Credit Adjustments
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySubTab('logs')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 cursor-pointer ${
                    historySubTab === 'logs'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  SMS Message Logs
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {historySubTab === 'transactions' && (
                <div>
                  {isSalonTxLoading ? (
                    <div className="py-12 text-center text-slate-400">Loading credits…</div>
                  ) : !salonTxData?.data || salonTxData.data.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No credit transactions found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {salonTxData.data.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">
                              {tx.description || tx.type}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(tx.createdAt).toLocaleString('en-LK', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`font-mono font-bold block ${
                                tx.amount > 0 ? 'text-emerald-600' : 'text-slate-700'
                              }`}
                            >
                              {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Bal: {tx.balanceAfter.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {historySubTab === 'logs' && (
                <div>
                  {isSalonLogsLoading ? (
                    <div className="py-12 text-center text-slate-400">Loading messages…</div>
                  ) : !salonLogsData?.data || salonLogsData.data.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No messages sent yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {salonLogsData.data.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <span>{log.recipientMasked}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 rounded font-normal">
                                {log.purpose}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {log.messagePreview}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-rose-600 font-bold block">
                              -{log.creditsDeducted}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600">
                              {log.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistorySalon(null)}
                className="text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
