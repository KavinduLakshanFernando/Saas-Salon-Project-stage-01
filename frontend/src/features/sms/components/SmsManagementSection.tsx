import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Info,
  Lock,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { smsApi } from '../api/sms.api';
import type { SmsTransactionItem } from '../types/sms.types';
import { redirectToPayHereCheckout } from '@/features/signup/lib/payhere';

const QUICK_RECHARGE_AMOUNTS = [100, 250, 500, 1000, 1500, 2500];
const QUICK_ADMIN_CREDITS = [100, 250, 500, 1000, 1500];

export function SmsManagementSection() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'recharge' | 'requests' | 'ledger' | 'usage' | 'calculator'>('recharge');
  const [usagePage, setUsagePage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');

  // Custom Amount Recharge state (Authoritative: 1 SMS credit = LKR 1)
  const [rechargeAmount, setRechargeAmount] = useState<number | ''>(500);
  const [isPayHereLoading, setIsPayHereLoading] = useState(false);

  // Admin Request Modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [customCredits, setCustomCredits] = useState<number>(500);
  const [ownerMessage, setOwnerMessage] = useState<string>('');

  // Live Calculator State
  const [sampleText, setSampleText] = useState(
    'Dear Customer, your appointment is confirmed at Salon Elegance for tomorrow at 2:30 PM. Thank you!',
  );
  const { data: calcResult, isLoading: isCalculating } = useQuery({
    queryKey: ['sms-calculate', sampleText],
    queryFn: () => smsApi.calculate(sampleText),
    enabled: sampleText.length > 0,
    staleTime: 5_000,
  });

  // 1. Fetch SMS Wallet Overview
  const {
    data: wallet,
    isLoading: isWalletLoading,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ['sms-wallet'],
    queryFn: smsApi.getWallet,
    staleTime: 15_000,
  });


  // 3. Fetch Salon's Recharge Requests
  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['sms-recharge-requests', requestsPage, requestStatusFilter],
    queryFn: () =>
      smsApi.getRechargeRequests(
        requestsPage,
        10,
        requestStatusFilter === 'ALL' ? undefined : requestStatusFilter,
      ),
  });

  // 4. Fetch Usage Logs (paginated)
  const { data: usageData, isLoading: isUsageLoading } = useQuery({
    queryKey: ['sms-logs', usagePage],
    queryFn: () => smsApi.getLogs(usagePage, 10),
    enabled: activeTab === 'usage',
  });

  // 5. Fetch Transaction History / Ledger (paginated)
  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['sms-transactions', ledgerPage],
    queryFn: () => smsApi.getTransactions(ledgerPage, 10),
    enabled: activeTab === 'ledger',
  });

  // PayHere Self-Service Custom Recharge Handler
  const handlePayHereCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amountNum =
      typeof rechargeAmount === 'number'
        ? rechargeAmount
        : parseInt(String(rechargeAmount).trim(), 10);

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid recharge amount in LKR.');
      return;
    }
    if (amountNum < 50) {
      toast.error('Minimum recharge amount is LKR 50.');
      return;
    }
    if (amountNum > 500000) {
      toast.error('Maximum recharge amount is LKR 500,000.');
      return;
    }

    try {
      setIsPayHereLoading(true);
      const session = await smsApi.createCheckout({ amount: amountNum, gateway: 'PAYHERE' });
      if (session?.checkout) {
        toast.info(
          `Redirecting to PayHere secure checkout for LKR ${amountNum.toLocaleString()} (${amountNum.toLocaleString()} SMS credits)…`,
        );
        redirectToPayHereCheckout(session.checkout);
      } else {
        toast.error('Could not initiate checkout session. Please try again.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Payment initiation failed';
      toast.error(msg);
    } finally {
      setIsPayHereLoading(false);
    }
  };

  // Submit Admin Assistance Request Mutation
  const submitRequestMutation = useMutation({
    mutationFn: (data: { requestedCredits: number; ownerMessage?: string }) =>
      smsApi.createRechargeRequest(data),
    onSuccess: (newReq) => {
      toast.success(
        `Recharge request for ${newReq.requestedCredits.toLocaleString()} credits submitted! Platform administrators will review and fulfill your request.`,
      );
      setIsRequestModalOpen(false);
      setOwnerMessage('');
      queryClient.invalidateQueries({ queryKey: ['sms-recharge-requests'] });
      setActiveTab('requests');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to submit request';
      toast.error(msg);
    },
  });

  // Cancel Pending Request Mutation
  const cancelRequestMutation = useMutation({
    mutationFn: (requestId: string) => smsApi.cancelRechargeRequest(requestId),
    onSuccess: () => {
      toast.success('Recharge request cancelled.');
      queryClient.invalidateQueries({ queryKey: ['sms-recharge-requests'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel request';
      toast.error(msg);
    },
  });

  const handleOpenRequestModal = (initialCredits?: number) => {
    if (initialCredits && initialCredits > 0) {
      setCustomCredits(initialCredits);
    } else if (typeof rechargeAmount === 'number' && rechargeAmount > 0) {
      setCustomCredits(rechargeAmount);
    } else {
      setCustomCredits(500);
    }
    setIsRequestModalOpen(true);
  };

  const handleConfirmRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const creditsNum = Math.floor(customCredits);
    if (!creditsNum || creditsNum < 1) {
      toast.error('Please enter a valid credit quantity (minimum 1 credit).');
      return;
    }
    if (creditsNum > 100000) {
      toast.error('Maximum request limit is 100,000 credits.');
      return;
    }
    submitRequestMutation.mutate({
      requestedCredits: creditsNum,
      ownerMessage: ownerMessage.trim() || undefined,
    });
  };

  const isPlanCovered = wallet?.isPlanCovered ?? false;
  const isActive = wallet?.isActive ?? false;
  const isLow = (wallet?.isLowBalance ?? false) && !isPlanCovered;
  const isEmpty = (wallet?.isOutOfCredits ?? false) && !isPlanCovered;

  const pendingRequestsCount =
    requestsData?.data?.filter((r) => r.status === 'PENDING').length ?? 0;

  // Helper to categorize transaction source
  const getTransactionSource = (tx: SmsTransactionItem) => {
    if (tx.paymentOrder || tx.type === 'PURCHASE') {
      return { label: 'PayHere Self-Service', icon: CreditCard, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    }
    if (tx.description?.toLowerCase().includes('request') || tx.description?.toLowerCase().includes('assisted')) {
      return { label: 'Admin Request Fulfillment', icon: UserCheck, color: 'text-sky-700 bg-sky-50 border-sky-100' };
    }
    if (tx.type === 'ADJUSTMENT' || tx.description?.toLowerCase().includes('admin')) {
      return { label: 'Admin Allocation', icon: ShieldCheck, color: 'text-indigo-700 bg-indigo-50 border-indigo-100' };
    }
    if (tx.type === 'USAGE') {
      return { label: 'SMS Dispatched', icon: Send, color: 'text-slate-700 bg-slate-100 border-slate-200' };
    }
    if (tx.type === 'REFUND') {
      return { label: 'System Refund', icon: RefreshCw, color: 'text-purple-700 bg-purple-50 border-purple-100' };
    }
    return { label: tx.type, icon: Coins, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  };

  return (
    <div id="sms-addon" className="pt-1">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shadow-sm">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                SMS Notifications & Credit Management
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Purchase SMS packages instantly via PayHere or request platform administrator assistance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchWallet();
              void refetchRequests();
            }}
            className="h-9 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw size={13} className={isWalletLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenRequestModal()}
            className="h-9 gap-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer"
          >
            <PhoneCall size={13} />
            <span>Request Admin Assistance</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Available Balance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Available SMS Credits
            </span>
            <div
              className={`p-2 rounded-xl ${
                isPlanCovered
                  ? 'bg-emerald-50 text-emerald-600'
                  : !isActive
                    ? 'bg-slate-100 text-slate-500'
                    : isEmpty
                      ? 'bg-rose-50 text-rose-600'
                      : isLow
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Coins size={18} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {isPlanCovered
                ? 'Included'
                : wallet?.balance !== undefined
                  ? wallet.balance.toLocaleString()
                  : '0'}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {isPlanCovered ? 'in Subscription Plan' : 'Credits'}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {isPlanCovered ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                <CheckCircle2 size={11} /> Plan Quota Active
              </span>
            ) : !isActive ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                <ShieldAlert size={11} className="text-amber-500" /> Service Ready for First Recharge
              </span>
            ) : isEmpty ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
                <AlertTriangle size={11} /> Exhausted (0 left)
              </span>
            ) : isLow ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                <AlertTriangle size={11} /> Low Balance (≤{wallet?.lowBalanceThreshold})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                <CheckCircle2 size={11} /> Active & Ready
              </span>
            )}
          </div>
        </div>

        {/* Total Credits Added */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Credits Added
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {wallet?.totalPurchased !== undefined ? wallet.totalPurchased.toLocaleString() : '0'}
            </span>
            <span className="text-xs font-medium text-slate-500">Credits</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-500 shrink-0" />
            <span>Never expires across billing cycles</span>
          </p>
        </div>

        {/* Total Consumed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Consumed
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Send size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {wallet?.totalConsumed !== undefined ? wallet.totalConsumed.toLocaleString() : '0'}
            </span>
            <span className="text-xs font-medium text-slate-500">Credits</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
            <Clock size={11} className="text-purple-500 shrink-0" />
            <span>1 credit per 160-char English SMS segment</span>
          </p>
        </div>
      </div>

      {/* Low / Out of Credits Warning Banner */}
      {!isPlanCovered && (isEmpty || isLow) && (
        <div
          className={`mb-6 p-4 rounded-2xl border shadow-xs ${
            isEmpty
              ? 'bg-rose-50/90 border-rose-200 text-rose-950'
              : 'bg-amber-50/90 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isEmpty ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <AlertTriangle size={20} className={isEmpty ? 'animate-pulse' : ''} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold">
                    {isEmpty
                      ? 'SMS Credits Exhausted (0 Credits Remaining)'
                      : `Low SMS Credit Balance (${wallet?.balance} Credits Left)`}
                  </h4>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isEmpty ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {isEmpty ? 'SMS Paused' : 'Action Needed'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isEmpty
                    ? 'Customer eBills and reminder SMS messages are temporarily paused until credits are added. POS checkout and billing continue normally. Recharge below via PayHere or request admin assistance.'
                    : 'Your SMS credits are running low. Top up below via PayHere instant checkout or request admin assistance to prevent interruption.'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setActiveTab('recharge')}
              className={`shrink-0 font-semibold text-xs h-9 rounded-xl ${
                isEmpty
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              Recharge Now
            </Button>
          </div>
        </div>
      )}

      {/* Plan-Covered Notice */}
      {isPlanCovered && (
        <div className="mb-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Unlimited SMS Notifications Included in Your Subscription
              </h3>
              <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed">
                Your current plan includes full automated customer notifications (eBills, confirmations, and appointment reminders). You can also purchase additional credit packages below whenever needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('recharge')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
            activeTab === 'recharge'
              ? 'text-sky-600 border-b-2 border-sky-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <CreditCard size={15} /> Buy & Recharge Credits
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
            activeTab === 'requests'
              ? 'text-sky-600 border-b-2 border-sky-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <UserCheck size={15} /> Admin Requests
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {pendingRequestsCount}
              </span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
            activeTab === 'ledger'
              ? 'text-sky-600 border-b-2 border-sky-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Coins size={15} /> Credit Ledger & History
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('usage')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
            activeTab === 'usage'
              ? 'text-sky-600 border-b-2 border-sky-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Send size={15} /> Usage History
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
            activeTab === 'calculator'
              ? 'text-sky-600 border-b-2 border-sky-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Calculator size={15} /> Cost Estimator
          </span>
        </button>
      </div>

      {/* TAB 1: Custom-Amount SMS Recharge */}
      {activeTab === 'recharge' && (
        <div className="space-y-6">
          {/* Main Custom Amount Recharge Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Side: Form & Controls */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100">
                      <Sparkles size={13} className="text-sky-600" />
                      1 SMS Credit = LKR 1.00
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Lock size={12} className="text-emerald-600" />
                      PayHere 256-Bit SSL
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    Recharge SMS Credits
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                    Enter your preferred recharge amount in LKR. Every LKR 1 gives you 1 SMS credit. Pay securely via PayHere with zero hidden fees.
                  </p>
                </div>

                <form onSubmit={handlePayHereCheckout} className="space-y-5">
                  {/* Custom Amount Input Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Enter Recharge Amount (LKR)
                    </label>
                    <div className="relative rounded-2xl shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-base sm:text-lg">
                        LKR
                      </div>
                      <input
                        type="number"
                        min="50"
                        max="500000"
                        step="1"
                        value={rechargeAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRechargeAmount(val === '' ? '' : parseInt(val, 10));
                        }}
                        placeholder="e.g. 500"
                        className="w-full pl-16 pr-4 py-3.5 text-lg sm:text-xl font-extrabold text-slate-900 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
                      <span>Minimum: LKR 50</span>
                      <span>Maximum: LKR 500,000</span>
                    </div>
                  </div>

                  {/* Quick-Select Amount Chips */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2.5">
                      Or Select Quick Amount (LKR):
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {QUICK_RECHARGE_AMOUNTS.map((amt) => {
                        const isSelected = rechargeAmount === amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setRechargeAmount(amt)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-600 shadow-sm ring-2 ring-sky-300/60'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            LKR {amt.toLocaleString()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-3">
                    <Button
                      type="submit"
                      disabled={isPayHereLoading || !((typeof rechargeAmount === 'number' ? rechargeAmount : parseInt(String(rechargeAmount).trim(), 10)) >= 50)}
                      className="w-full h-12 text-sm font-bold rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPayHereLoading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw size={16} className="animate-spin text-sky-400" />
                          <span>Connecting to PayHere Secure Gateway…</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <CreditCard size={17} />
                          <span>
                            Continue with PayHere • LKR{' '}
                            {typeof rechargeAmount === 'number' && rechargeAmount > 0
                              ? rechargeAmount.toLocaleString()
                              : '0'}
                          </span>
                        </span>
                      )}
                    </Button>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleOpenRequestModal(
                            typeof rechargeAmount === 'number' && rechargeAmount > 0
                              ? rechargeAmount
                              : 500,
                          )
                        }
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 h-9 px-3 rounded-xl hover:bg-slate-100 cursor-pointer gap-1.5"
                      >
                        <PhoneCall size={14} className="text-sky-600" />
                        <span>Request Admin Assistance Instead</span>
                      </Button>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        Instant 24/7 delivery
                      </span>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Side: Live Calculation & Wallet Projection */}
              <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Live Recharge Calculation
                  </h4>
                  <div className="text-xs text-slate-600">
                    Calculated authoritatively at 1 SMS credit = LKR 1.00.
                  </div>
                </div>

                {/* Calculation Breakdown Rows */}
                {(() => {
                  const currentBal = wallet?.balance ?? 0;
                  const validAmt =
                    typeof rechargeAmount === 'number' && rechargeAmount > 0 ? rechargeAmount : 0;
                  const addedCredits = validAmt;
                  const newBal = currentBal + addedCredits;

                  return (
                    <div className="space-y-3 bg-white rounded-xl p-4 border border-slate-100 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Recharge Amount</span>
                        <span className="font-bold text-slate-900">
                          LKR {validAmt.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Unit Price</span>
                        <span className="font-semibold text-sky-600">LKR 1.00 / SMS</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">SMS Credits to Add</span>
                        <span className="font-extrabold text-emerald-600">
                          +{addedCredits.toLocaleString()} Credits
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Current Balance</span>
                        <span className="font-medium text-slate-700">
                          {currentBal.toLocaleString()} Credits
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">Projected Balance</span>
                        <span className="font-extrabold text-slate-900 bg-sky-50 px-2 py-0.5 rounded-md text-sky-800 border border-sky-100">
                          {newBal.toLocaleString()} Credits
                        </span>
                      </div>

                      <div className="pt-3 border-t-2 border-slate-100 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-slate-900">Total Payable</span>
                        <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                          LKR {validAmt.toLocaleString()}.00
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Wallet Balance Highlight */}
                <div className="p-3.5 rounded-xl bg-white/80 border border-slate-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <Wallet size={18} />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-900">Existing Tenant Wallet</div>
                    <div className="text-slate-500 text-[11px]">
                      Recharged credits are added to your existing {wallet?.balance?.toLocaleString() ?? '0'} balance. Credits never expire.
                    </div>
                  </div>
                </div>

                {/* Dual Method Alternative Banner */}
                <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 text-xs text-sky-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-sky-900">
                    <UserCheck size={14} className="text-sky-600" />
                    <span>Prefer Admin-Assisted Allocation?</span>
                  </div>
                  <p className="text-[11px] text-sky-900/80 leading-relaxed">
                    Have an existing bank transfer, offline invoice, or direct platform arrangement? Click &quot;Request Admin Assistance&quot; to submit a custom credit request without paying through PayHere.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Admin Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Your Admin Assistance Requests
              </h3>
              <p className="text-xs text-slate-500">
                Track the status of your submitted credit requests to the platform administrator.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenRequestModal()}
                className="h-8 gap-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              >
                <PhoneCall size={12} />
                <span>New Request</span>
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {isRequestsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-sky-600" />
                <span className="text-xs font-medium">Loading requests…</span>
              </div>
            ) : !requestsData?.data || requestsData.data.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <UserCheck size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium">No assistance requests found.</p>
                <p className="text-xs text-slate-400 mt-1">Submit a request to have credits allocated by an administrator.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenRequestModal()}
                  className="mt-4 text-xs font-semibold rounded-xl"
                >
                  Create First Request
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                      <th className="py-3 px-4">Requested Date</th>
                      <th className="py-3 px-4">Credits / Package</th>
                      <th className="py-3 px-4">Est. Amount</th>
                      <th className="py-3 px-4">Your Message</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Admin Response / Note</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {requestsData.data.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleString('en-LK', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            +{req.requestedCredits.toLocaleString()} Credits
                          </div>
                          {req.package && (
                            <span className="text-[11px] text-slate-500 font-normal">
                              ({req.package.name})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                          {req.amount ? `LKR ${Number(req.amount).toLocaleString()}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={req.ownerMessage || undefined}>
                          {req.ownerMessage || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'FULFILLED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : req.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : req.status === 'APPROVED'
                                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                    : req.status === 'CANCELLED'
                                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {req.status === 'FULFILLED' && <CheckCircle2 size={10} />}
                            {req.status === 'PENDING' && <Clock size={10} />}
                            {req.status === 'REJECTED' && <XCircle size={10} />}
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={req.adminNotes || undefined}>
                          {req.adminNotes ? (
                            <div>
                              <span>{req.adminNotes}</span>
                              {req.fulfilledAt && (
                                <div className="text-[10px] text-slate-400">
                                  Fulfilled {new Date(req.fulfilledAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Awaiting admin review</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.status === 'PENDING' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => cancelRequestMutation.mutate(req.id)}
                              disabled={cancelRequestMutation.isPending}
                              className="h-7 text-[11px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer"
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {requestsData.meta.totalPages > 1 && (
                  <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Page {requestsData.meta.page} of {requestsData.meta.totalPages} ({requestsData.meta.total} requests)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestsPage <= 1}
                        onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                        className="h-7 text-xs px-2.5 cursor-pointer"
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestsPage >= requestsData.meta.totalPages}
                        onClick={() => setRequestsPage((p) => p + 1)}
                        className="h-7 text-xs px-2.5 cursor-pointer"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Credit Ledger & Recharge History */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Credit Ledger & Recharge History</h3>
              <p className="text-xs text-slate-500">
                Authoritative record of all balance changes, PayHere purchases, admin allocations, and SMS consumption.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {isLedgerLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-sky-600" />
                <span className="text-xs font-medium">Loading credit ledger…</span>
              </div>
            ) : !ledgerData?.data || ledgerData.data.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Coins size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium">No credit transactions recorded yet.</p>
                <p className="text-xs text-slate-400 mt-1">Recharge credits above to fund your SMS wallet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Source / Type</th>
                      <th className="py-3 px-4">Credits</th>
                      <th className="py-3 px-4">Balance After</th>
                      <th className="py-3 px-4">Description / Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {ledgerData.data.map((tx) => {
                      const source = getTransactionSource(tx);
                      const SourceIcon = source.icon;

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString('en-LK', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${source.color}`}
                            >
                              <SourceIcon size={11} />
                              {source.label}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 font-bold whitespace-nowrap ${
                              tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {tx.balanceAfter.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div>{tx.description || '—'}</div>
                            {tx.reference && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Ref: {tx.reference}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {ledgerData.meta.totalPages > 1 && (
                  <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Page {ledgerData.meta.page} of {ledgerData.meta.totalPages} ({ledgerData.meta.total} records)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={ledgerPage <= 1}
                        onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                        className="h-7 text-xs px-2.5 cursor-pointer"
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={ledgerPage >= ledgerData.meta.totalPages}
                        onClick={() => setLedgerPage((p) => p + 1)}
                        className="h-7 text-xs px-2.5 cursor-pointer"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Usage History */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {isUsageLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-sky-600" />
              <span className="text-xs font-medium">Loading usage history…</span>
            </div>
          ) : !usageData?.data || usageData.data.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Send size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium">No SMS messages sent yet.</p>
              <p className="text-xs text-slate-400 mt-1">Dispatched eBills and reminders will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Message Preview</th>
                    <th className="py-3 px-4">Segments</th>
                    <th className="py-3 px-4">Credits Consumed</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {usageData.data.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-LK', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {log.purpose}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{log.recipientMasked}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={log.messagePreview}>
                        {log.messagePreview || '—'}
                      </td>
                      <td className="py-3 px-4">{log.segments}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {log.creditsDeducted > 0 ? `-${log.creditsDeducted}` : '0 (Plan Quota)'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'SUBMITTED' || log.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : log.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {usageData.meta.totalPages > 1 && (
                <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Page {usageData.meta.page} of {usageData.meta.totalPages} ({usageData.meta.total} records)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={usagePage <= 1}
                      onClick={() => setUsagePage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs px-2.5 cursor-pointer"
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={usagePage >= usageData.meta.totalPages}
                      onClick={() => setUsagePage((p) => p + 1)}
                      className="h-7 text-xs px-2.5 cursor-pointer"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Live Calculator */}
      {activeTab === 'calculator' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Live SMS Segment & Credit Estimator
              </h3>
              <p className="text-xs text-slate-500">
                Type or paste a sample SMS message to test character encoding, segment breakdown, and credit deductions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Sample SMS Content
              </label>
              <textarea
                rows={5}
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                placeholder="Enter sample message here..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 leading-relaxed font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Characters: {sampleText.length}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSampleText(
                      'ඔබගේ වේලාව වෙන් කර ඇත. Salon Elegance වෙතින් ස්තූතියි!',
                    )
                  }
                  className="text-sky-600 hover:underline cursor-pointer"
                >
                  Load Sinhala Unicode example
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Calculation Result
                </h4>
                {isCalculating ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <RefreshCw size={14} className="animate-spin text-sky-600" />
                    <span>Calculating segments…</span>
                  </div>
                ) : calcResult ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Encoding:</span>
                      <span className="font-semibold text-slate-900 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px]">
                        {calcResult.encoding === 'UNICODE'
                          ? 'Unicode (Sinhala/Tamil/Emoji)'
                          : 'GSM-7 (Standard English)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Segment Count:</span>
                      <span className="font-bold text-slate-900">
                        {calcResult.segmentCount || calcResult.segments || 1} segment(s)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Max per Segment:</span>
                      <span className="font-medium text-slate-700">
                        {calcResult.maxCharsPerSegment} chars
                      </span>
                    </div>

                    <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                      <span className="font-bold text-slate-900">Credits Required:</span>
                      <span className="text-base font-extrabold text-sky-600">
                        {calcResult.creditsRequired || calcResult.creditsNeeded || 1} Credit(s)
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-start gap-1.5">
                <Info size={13} className="shrink-0 text-sky-600 mt-0.5" />
                <span>Standard English messages up to 160 characters consume 1 credit.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Assistance Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                <PhoneCall size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Request Admin Credit Allocation
                </h3>
                <p className="text-xs text-slate-500">
                  Submit a request to the platform administrator to allocate SMS credits.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Preferred SMS Credit Quantity
                </label>
                <div className="relative rounded-2xl shadow-xs">
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={customCredits}
                    onChange={(e) =>
                      setCustomCredits(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    placeholder="e.g. 500"
                    className="w-full px-4 py-3 text-base font-extrabold text-slate-900 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    SMS Credits
                  </div>
                </div>

                {/* Quick Chips for Admin Request */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Quick:</span>
                  {QUICK_ADMIN_CREDITS.map((credits) => (
                    <button
                      key={credits}
                      type="button"
                      onClick={() => setCustomCredits(credits)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        customCredits === credits
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {credits.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="mt-2 p-2.5 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Standard Conversion Rate:</span>
                  <span className="font-bold text-sky-800">
                    LKR {customCredits.toLocaleString()} (1 SMS = LKR 1.00)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message / Payment Details for Admin (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ownerMessage}
                  onChange={(e) => setOwnerMessage(e.target.value)}
                  placeholder="e.g., Bank transfer reference BOC-98765, cash settlement at salon, or urgent weekend top-up..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/70 text-[11px] text-amber-900 flex items-start gap-2">
                <Info size={14} className="shrink-0 mt-0.5 text-amber-700" />
                <span>
                  <strong>Important:</strong> Admin-assisted requests do not require online payment through PayHere. Credits will be allocated to your wallet once confirmed by the platform administrator.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold rounded-xl border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitRequestMutation.isPending || !customCredits || customCredits < 1}
                  className="h-9 px-5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitRequestMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={13} className="animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    `Submit Request for ${customCredits.toLocaleString()} Credits`
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
