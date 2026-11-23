import {
  CalendarDays,
  CreditCard,
  Download,
  Mail,
  ShieldCheck,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Receipt,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatAmount,
  formatDate,
  paymentStatusBadgeClass,
  subscriptionStatusBadgeClass,
} from '@/features/billing/lib/billing-utils';
import type { AdminInvoiceItem, AdminPaymentItem } from '@/features/billing/types/billing.types';
import { usePublicPlans } from '@/features/plans/hooks/usePlans';
import { toast } from 'sonner';
import {
  billingCycleLabel,
  formatPrice,
  featureLabel,
  isPopularPlan,
  PLAN_HIGHLIGHTS,
} from '@/features/plans/lib/plan-utils';
import type { BillingCycle } from '@/features/plans/types/plan.types';
import { PlanChangeDialog } from '@/features/subscriptions/components/PlanChangeDialog';
import {
  tenantSubscriptionsApi,
  type ConfirmReturnOrderResult,
} from '@/features/subscriptions/api/tenant-subscriptions.api';
import {
  useSubscriptionMutations,
  useTenantInvoices,
  useTenantPaymentHistory,
  useTenantSubscription,
} from '@/features/subscriptions/hooks/useTenantSubscription';
import { redirectToPayHereCheckout } from '@/features/signup/lib/payhere';
import { getErrorMessage, OpsError, OpsLoading } from './salon-ops-ui';
import { hasUnrestrictedSalonAccess, isSalonAdmin as checkIsSalonAdmin } from '@/lib/salon-access';
import { SmsManagementSection } from '@/features/sms/components/SmsManagementSection';
import './subscription-page.css';



type SubTab = 'plans' | 'sms' | 'billing';



function PaginationBar({

  page,

  totalPages,

  onPrevious,

  onNext,

}: {

  page: number;

  totalPages: number;

  onPrevious: () => void;

  onNext: () => void;

}) {

  if (totalPages <= 1) return null;



  return (

    <div className="sub-pagination">

      <button type="button" className="sub-btn sub-btn-secondary" disabled={page <= 1} onClick={onPrevious}>

        Previous

      </button>

      <span className="sub-pagination-label">

        Page {page} of {totalPages}

      </span>

      <button

        type="button"

        className="sub-btn sub-btn-secondary"

        disabled={page >= totalPages}

        onClick={onNext}

      >

        Next

      </button>

    </div>

  );

}



function PaymentRecords({

  payments,

}: {

  payments: AdminPaymentItem[];

}) {

  return (

    <>

      <div className="sub-record-list">

        {payments.map((payment) => (

          <article key={payment.id} className="sub-record-card">

            <div className="sub-record-head">

              <div className="sub-record-ref">

                <div>{payment.reference}</div>

                <div>{payment.purpose}</div>

              </div>

              <span className={paymentStatusBadgeClass(payment.status)}>{payment.status}</span>

            </div>

            <div className="sub-record-grid">

              <div className="sub-record-field">

                <span>Amount</span>

                <strong>{formatAmount(payment.amount, payment.currency)}</strong>

              </div>

              <div className="sub-record-field">

                <span>Gateway</span>

                <strong>{payment.gateway}</strong>

              </div>

              <div className="sub-record-field">

                <span>Date</span>

                <strong>{formatDate(payment.payment?.paidAt ?? payment.createdAt)}</strong>

              </div>

            </div>

          </article>

        ))}

      </div>



      <div className="sub-table-wrap">

        <table className="sub-table">

          <thead>

            <tr>

              <th>Reference</th>

              <th>Amount</th>

              <th>Gateway</th>

              <th>Status</th>

              <th>Date</th>

            </tr>

          </thead>

          <tbody>

            {payments.map((payment) => (

              <tr key={payment.id}>

                <td>

                  <div className="sub-record-ref">{payment.reference}</div>

                  <div className="sub-record-ref">{payment.purpose}</div>

                </td>

                <td>{formatAmount(payment.amount, payment.currency)}</td>

                <td>{payment.gateway}</td>

                <td>

                  <span className={paymentStatusBadgeClass(payment.status)}>{payment.status}</span>

                </td>

                <td>{formatDate(payment.payment?.paidAt ?? payment.createdAt)}</td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </>

  );

}



function InvoiceRecords({
  invoices,
  downloadingInvoiceId,
  emailingInvoiceId,
  onDownload,
  onSendEmail,
}: {
  invoices: AdminInvoiceItem[];
  downloadingInvoiceId: string | null;
  emailingInvoiceId: string | null;
  onDownload: (id: string, invoiceNumber: string) => void;
  onSendEmail: (id: string, invoiceNumber: string) => void;
}) {
  return (
    <>
      <div className="sub-record-list">
        {invoices.map((invoice) => (
          <article key={invoice.id} className="sub-record-card">
            <div className="sub-record-head">
              <div>
                <div className="sub-plan-name">{invoice.invoiceNumber}</div>
                <div className="sub-plan-code">{invoice.planName}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="sub-link-btn"
                  disabled={emailingInvoiceId === invoice.id}
                  onClick={() => onSendEmail(invoice.id, invoice.invoiceNumber)}
                >
                  <Mail className="mr-1 inline h-3.5 w-3.5" />
                  {emailingInvoiceId === invoice.id ? 'Sending…' : 'Email'}
                </button>
                <button
                  type="button"
                  className="sub-link-btn"
                  disabled={downloadingInvoiceId === invoice.id}
                  onClick={() => onDownload(invoice.id, invoice.invoiceNumber)}
                >
                  {downloadingInvoiceId === invoice.id ? 'Downloading…' : 'Download'}
                </button>
              </div>
            </div>

            <div className="sub-record-grid">

              <div className="sub-record-field">

                <span>Amount</span>

                <strong>{formatAmount(invoice.total, invoice.currency)}</strong>

              </div>

              <div className="sub-record-field">

                <span>Paid</span>

                <strong>{formatDate(invoice.paidAt ?? invoice.issueDate)}</strong>

              </div>

            </div>

          </article>

        ))}

      </div>



      <div className="sub-table-wrap">

        <table className="sub-table">

          <thead>

            <tr>

              <th>Invoice #</th>

              <th>Plan</th>

              <th>Amount</th>

              <th>Paid</th>

              <th style={{ textAlign: 'right' }}>Download</th>

            </tr>

          </thead>

          <tbody>

            {invoices.map((invoice) => (

              <tr key={invoice.id}>

                <td>

                  <div className="sub-plan-name">{invoice.invoiceNumber}</div>

                </td>

                <td>{invoice.planName}</td>

                <td>{formatAmount(invoice.total, invoice.currency)}</td>

                <td>{formatDate(invoice.paidAt ?? invoice.issueDate)}</td>

                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button
                      type="button"
                      className="sub-link-btn"
                      disabled={emailingInvoiceId === invoice.id}
                      onClick={() => onSendEmail(invoice.id, invoice.invoiceNumber)}
                    >
                      <Mail className="mr-1 inline h-3.5 w-3.5" />
                      {emailingInvoiceId === invoice.id ? 'Sending…' : 'Email'}
                    </button>
                    <button
                      type="button"
                      className="sub-link-btn"
                      disabled={downloadingInvoiceId === invoice.id}
                      onClick={() => onDownload(invoice.id, invoice.invoiceNumber)}
                    >
                      <Download className="mr-1 inline h-3.5 w-3.5" />
                      {downloadingInvoiceId === invoice.id ? 'Downloading…' : 'Download'}
                    </button>
                  </div>
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </>

  );

}



export default function SubscriptionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<SubTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'sms' || window.location.hash === '#sms-addon') return 'sms';
    if (tabParam === 'billing' || tabParam === 'invoices' || tabParam === 'payments') return 'billing';
    return 'plans';
  });

  // Keep activeTab in sync with query parameter or hash changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const hash = window.location.hash;
    if (tabParam === 'sms' || hash === '#sms-addon') {
      setActiveTab('sms');
    } else if (tabParam === 'billing' || tabParam === 'invoices' || tabParam === 'payments') {
      setActiveTab('billing');
    } else if (tabParam === 'plans') {
      setActiveTab('plans');
    }
  }, [searchParams]);

  const handleTabChange = (tab: SubTab) => {
    setActiveTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'plans') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true },
    );
  };

  const [planChangeModal, setPlanChangeModal] = useState<{
    isOpen: boolean;
    mode: 'upgrade' | 'downgrade' | 'change';
    targetPlanId?: string | null;
  }>({
    isOpen: false,
    mode: 'change',
    targetPlanId: null,
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('MONTHLY');
  const [showAllPlans, setShowAllPlans] = useState(false);

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [emailingInvoiceId, setEmailingInvoiceId] = useState<string | null>(null);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);

  // Authoritative payment verification state
  const [paymentResult, setPaymentResult] = useState<{
    isOpen: boolean;
    status: 'verifying' | 'success' | 'failed' | 'cancelled' | 'delayed';
    orderRef?: string;
    data?: ConfirmReturnOrderResult | null;
    errorMessage?: string;
    pollCount?: number;
  }>({
    isOpen: false,
    status: 'verifying',
  });

  const {
    data: context,
    isLoading,
    isError,
    error,
    refetch,
  } = useTenantSubscription();

  const isSalonAdmin = checkIsSalonAdmin(user?.roles) || hasUnrestrictedSalonAccess(user?.roles, context?.features);
  const { data: publicPlans = [] } = usePublicPlans();
  const subscription = context?.subscription ?? null;
  const mutations = useSubscriptionMutations(subscription?.id);

  const { data: payments, isLoading: paymentsLoading } = useTenantPaymentHistory({
    page: paymentsPage,
    limit: 5,
  });

  const { data: invoices, isLoading: invoicesLoading, isError: invoicesError } = useTenantInvoices(
    { page: invoicesPage, limit: 5 },
    { enabled: true },
  );

  const expiryDate = useMemo(() => {
    if (!subscription) return null;
    if (subscription.status === 'TRIAL') return subscription.trialEnd ?? subscription.endDate;
    return subscription.endDate;
  }, [subscription]);

  const isTrial = subscription?.status === 'TRIAL';
  const isPaidActive = subscription?.status === 'ACTIVE';
  const isSuspended = subscription?.status === 'SUSPENDED';
  const isExpired = subscription?.status === 'EXPIRED';

  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const daysRemaining = useMemo(() => {
    if (!trialEnd) return null;
    const diff = trialEnd.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [trialEnd]);

  const isTrialExpired =
    context?.canWrite === false ||
    (isTrial && daysRemaining !== null && daysRemaining <= 0) ||
    isSuspended ||
    isExpired;

  // PayHere Return & Authoritative Verification Flow
  useEffect(() => {
    const payment = searchParams.get('payment');
    const orderRef = searchParams.get('orderRef') || searchParams.get('order_id');

    if (!payment) return;

    if (payment === 'success' && orderRef) {
      setPaymentResult({
        isOpen: true,
        status: 'verifying',
        orderRef,
        pollCount: 1,
      });

      let attempts = 0;
      const maxAttempts = 12; // 12 * 2.5s = 30s
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;

      const checkStatus = async () => {
        if (cancelled) return;
        attempts += 1;
        try {
          const res = await tenantSubscriptionsApi.confirmReturnOrder(orderRef);
          if (cancelled) return;

          if (res.status === 'paid') {
            setPaymentResult({
              isOpen: true,
              status: 'success',
              orderRef,
              data: res,
              pollCount: attempts,
            });
            void refetch();
            return;
          }

          if (res.status === 'failed') {
            setPaymentResult({
              isOpen: true,
              status: 'failed',
              orderRef,
              errorMessage: res.message || 'Payment was declined or failed at gateway.',
              pollCount: attempts,
            });
            return;
          }

          // Still pending: continue polling or mark delayed
          if (attempts >= maxAttempts) {
            setPaymentResult({
              isOpen: true,
              status: 'delayed',
              orderRef,
              data: res,
              pollCount: attempts,
            });
          } else {
            setPaymentResult((prev) => ({
              ...prev,
              pollCount: attempts,
            }));
            pollTimer = setTimeout(checkStatus, 2500);
          }
        } catch (err) {
          if (cancelled) return;
          console.warn('Poll confirm return error:', err);
          if (attempts >= maxAttempts) {
            setPaymentResult({
              isOpen: true,
              status: 'delayed',
              orderRef,
              pollCount: attempts,
            });
          } else {
            pollTimer = setTimeout(checkStatus, 2500);
          }
        }
      };

      void checkStatus();

      return () => {
        cancelled = true;
        if (pollTimer) clearTimeout(pollTimer);
      };
    } else if (payment === 'cancel') {
      setPaymentResult({
        isOpen: true,
        status: 'cancelled',
        orderRef: orderRef || undefined,
        errorMessage: 'Payment session was cancelled. No charges were made.',
      });
    }
  }, [searchParams, refetch]);

  const handleClosePaymentModal = () => {
    setPaymentResult((prev) => ({ ...prev, isOpen: false }));
    setSearchParams({}, { replace: true });
    void refetch();
  };

  const handleGoToDashboard = () => {
    setPaymentResult((prev) => ({ ...prev, isOpen: false }));
    setSearchParams({}, { replace: true });
    navigate('/salon/dashboard');
  };

  const handleRetryPayment = () => {
    setPaymentResult((prev) => ({ ...prev, isOpen: false }));
    setSearchParams({}, { replace: true });
    const plansEl = document.getElementById('subscription-plans');
    if (plansEl) {
      plansEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleManualCheckStatus = async () => {
    if (!paymentResult.orderRef) return;
    setPaymentResult((prev) => ({ ...prev, status: 'verifying' }));
    try {
      const res = await tenantSubscriptionsApi.confirmReturnOrder(paymentResult.orderRef);
      if (res.status === 'paid') {
        setPaymentResult({
          isOpen: true,
          status: 'success',
          orderRef: paymentResult.orderRef,
          data: res,
        });
        void refetch();
      } else if (res.status === 'failed') {
        setPaymentResult({
          isOpen: true,
          status: 'failed',
          orderRef: paymentResult.orderRef,
          errorMessage: res.message || 'Payment failed.',
        });
      } else {
        setPaymentResult({
          isOpen: true,
          status: 'delayed',
          orderRef: paymentResult.orderRef,
          data: res,
        });
      }
    } catch {
      toast.error('Could not verify status. Please refresh in a moment.');
      setPaymentResult((prev) => ({ ...prev, status: 'delayed' }));
    }
  };

  const handlePayHereCheckout = async (
    purpose: 'SUBSCRIPTION_ACTIVATE' | 'SUBSCRIPTION_RENEW' | 'SUBSCRIPTION_UPGRADE',
    options?: { planId?: string; planPriceId?: string; billingCycle?: 'MONTHLY' | 'YEARLY' },
  ) => {
    if (!subscription || !isSalonAdmin) return;
    setCheckoutLoading(true);
    if (options?.planId) {
      setCheckingOutPlanId(options.planId);
    }

    try {
      const result = await tenantSubscriptionsApi.createCheckout({
        subscriptionId: subscription.id,
        gateway: 'PAYHERE',
        purpose,
        planId: options?.planId,
        planPriceId: options?.planPriceId,
        billingCycle: options?.billingCycle,
      });
      redirectToPayHereCheckout(result.checkout);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setCheckoutLoading(false);
      setCheckingOutPlanId(null);
    }
  };

  const sortedPlans = useMemo(() => {
    return [...publicPlans].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [publicPlans]);

  const currentPlan = useMemo(() => {
    return publicPlans.find((p) => p.code === subscription?.planCode);
  }, [publicPlans, subscription?.planCode]);

  const hasYearlySavings = useMemo(() => {
    return sortedPlans.some((p) => {
      const m = p.prices?.find((pr) => pr.billingCycle === 'MONTHLY')?.price;
      const y = p.prices?.find((pr) => pr.billingCycle === 'YEARLY')?.price;
      return m && y && m * 12 > y;
    });
  }, [sortedPlans]);

  const handleCancel = async () => {
    if (!subscription || !isSalonAdmin) return;
    if (!window.confirm('Cancel subscription at the end of the current billing period?')) return;

    try {
      await mutations.cancel.mutateAsync();
      toast.success('Subscription will cancel at period end.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleUndoCancel = async () => {
    if (!subscription || !isSalonAdmin) return;

    try {
      await mutations.undoCancel.mutateAsync();
      toast.success('Cancellation removed. Your subscription will continue.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCancelPendingDowngrade = async () => {
    if (!subscription || !isSalonAdmin) return;

    try {
      await mutations.cancelPendingDowngrade.mutateAsync();
      toast.success('Pending downgrade cancelled. You will keep your current plan.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };



  const handleInvoiceDownload = async (id: string, invoiceNumber: string) => {
    setDownloadingInvoiceId(id);
    try {
      const { blob, filename } = await tenantSubscriptionsApi.downloadInvoice(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${invoiceNumber}.html`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleSendInvoiceEmail = async (id: string, invoiceNumber: string) => {
    setEmailingInvoiceId(id);
    try {
      const res = await tenantSubscriptionsApi.sendInvoiceEmail(id);
      toast.success(res.message || `Invoice ${invoiceNumber} emailed successfully!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEmailingInvoiceId(null);
    }
  };



  if (isLoading) return <OpsLoading />;



  if (isError || !context) {

    return (

      <OpsError

        message={getErrorMessage(error) || 'Failed to load subscription.'}

        onRetry={() => void refetch()}

      />

    );

  }



  const canRenew =
    isSalonAdmin &&
    subscription &&
    (subscription.status === 'ACTIVE' ||
      subscription.status === 'EXPIRED' ||
      subscription.status === 'SUSPENDED' ||
      subscription.status === 'PAST_DUE') &&
    !subscription.cancelAtPeriodEnd;



  const canActivate =

    isSalonAdmin &&

    subscription &&

    (subscription.status === 'PENDING' || subscription.status === 'TRIAL');



  const canUpgrade =

    isSalonAdmin &&

    subscription?.status === 'ACTIVE' &&

    !subscription.cancelAtPeriodEnd;



  const canDowngrade =

    isSalonAdmin &&

    subscription?.status === 'ACTIVE' &&

    !subscription.cancelAtPeriodEnd;



  const canCancel =

    isSalonAdmin &&

    subscription?.status === 'ACTIVE' &&

    !subscription.cancelAtPeriodEnd;



  const showActions =

    isSalonAdmin &&

    subscription &&

    (canActivate ||

      canRenew ||

      canUpgrade ||

      canDowngrade ||

      canCancel ||

      (subscription.cancelAtPeriodEnd && subscription.status === 'ACTIVE'));



  return (
    <div className="sub-page">
      {/* Payment Result Modal Overlay */}
      {paymentResult.isOpen && (
        <div className="sub-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
          <div className="sub-modal-card">
            {paymentResult.status === 'verifying' && (
              <>
                <div className="sub-modal-icon-wrap sub-modal-icon-verifying">
                  <RefreshCw className="sub-spinner-icon h-8 w-8 text-violet-600" />
                </div>
                <h3 id="payment-modal-title" className="sub-modal-title">Verifying Payment with PayHere</h3>
                <p className="sub-modal-desc">
                  We are securely confirming your transaction with PayHere. Please do not close or refresh this
                  page. (Attempt {paymentResult.pollCount ?? 1}/12)
                </p>
              </>
            )}

            {paymentResult.status === 'success' && (
              <>
                <div className="sub-modal-icon-wrap sub-modal-icon-success">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 id="payment-modal-title" className="sub-modal-title">Subscription Activated!</h3>
                <p className="sub-modal-desc">
                  Your payment was verified successfully by PayHere. Full write access and all plan features have been
                  restored immediately.
                </p>

                <div className="sub-modal-receipt">
                  <div className="sub-receipt-row">
                    <span>Plan</span>
                    <strong>{paymentResult.data?.plan?.name || subscription?.plan || 'Selected Plan'}</strong>
                  </div>
                  <div className="sub-receipt-row">
                    <span>Amount Paid</span>
                    <strong>
                      {formatAmount(
                        paymentResult.data?.amount ?? subscription?.price ?? 0,
                        paymentResult.data?.currency ?? subscription?.currency ?? 'LKR',
                      )}
                    </strong>
                  </div>
                  <div className="sub-receipt-row">
                    <span>Billing Cycle</span>
                    <strong>
                      {billingCycleLabel(
                        paymentResult.data?.billingCycle ?? subscription?.billingCycle ?? 'MONTHLY',
                      )}
                    </strong>
                  </div>
                  <div className="sub-receipt-row">
                    <span>Activation Date</span>
                    <strong>{formatDate(paymentResult.data?.paidAt ?? new Date().toISOString())}</strong>
                  </div>
                  <div className="sub-receipt-row">
                    <span>Next Renewal Date</span>
                    <strong>
                      {formatDate(
                        paymentResult.data?.subscription?.nextBillingDate ??
                        paymentResult.data?.subscription?.endDate ??
                        expiryDate,
                      )}
                    </strong>
                  </div>
                  <div className="sub-receipt-row">
                    <span>Transaction Reference</span>
                    <strong style={{ fontSize: '0.75rem' }}>{paymentResult.orderRef}</strong>
                  </div>
                </div>

                <div className="sub-modal-actions">
                  {paymentResult.data?.invoiceId && (
                    <button
                      type="button"
                      className="sub-btn sub-btn-secondary"
                      onClick={() =>
                        paymentResult.data?.invoiceId &&
                        void handleInvoiceDownload(
                          paymentResult.data.invoiceId,
                          paymentResult.data.invoiceNumber || 'receipt',
                        )
                      }
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Download Invoice ({paymentResult.data.invoiceNumber || 'Receipt'})
                    </button>
                  )}
                  <button type="button" className="sub-btn sub-btn-primary" onClick={handleGoToDashboard}>
                    Go to Salon Dashboard
                  </button>
                  <button type="button" className="sub-btn sub-btn-secondary" onClick={handleClosePaymentModal}>
                    Stay on Subscription Page
                  </button>
                </div>
              </>
            )}

            {paymentResult.status === 'delayed' && (
              <>
                <div className="sub-modal-icon-wrap sub-modal-icon-delayed">
                  <Clock className="h-8 w-8 text-amber-600" />
                </div>
                <h3 id="payment-modal-title" className="sub-modal-title">Payment Verification in Progress</h3>
                <p className="sub-modal-desc">
                  PayHere has processed your payment, and our servers are waiting for the final webhook notification.
                  Your subscription will be activated automatically as soon as it arrives. You can check again or continue.
                </p>
                <div className="sub-modal-actions">
                  <button type="button" className="sub-btn sub-btn-primary" onClick={() => void handleManualCheckStatus()}>
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Check Status Again
                  </button>
                  <button type="button" className="sub-btn sub-btn-secondary" onClick={handleGoToDashboard}>
                    Continue to Dashboard
                  </button>
                  <button type="button" className="sub-btn sub-btn-ghost" onClick={handleClosePaymentModal}>
                    Dismiss
                  </button>
                </div>
              </>
            )}

            {paymentResult.status === 'cancelled' && (
              <>
                <div className="sub-modal-icon-wrap sub-modal-icon-cancelled">
                  <XCircle className="h-8 w-8 text-rose-600" />
                </div>
                <h3 id="payment-modal-title" className="sub-modal-title">Payment Session Cancelled</h3>
                <p className="sub-modal-desc">
                  You cancelled the PayHere transaction before completing payment. No charges were made to your account and
                  all your salon records remain intact.
                </p>
                <div className="sub-modal-actions">
                  <button type="button" className="sub-btn sub-btn-primary" onClick={handleRetryPayment}>
                    Retry Payment / Select Plan
                  </button>
                  <button type="button" className="sub-btn sub-btn-secondary" onClick={handleClosePaymentModal}>
                    Dismiss
                  </button>
                </div>
              </>
            )}

            {paymentResult.status === 'failed' && (
              <>
                <div className="sub-modal-icon-wrap sub-modal-icon-failed">
                  <AlertTriangle className="h-8 w-8 text-rose-600" />
                </div>
                <h3 id="payment-modal-title" className="sub-modal-title">Payment Unsuccessful</h3>
                <p className="sub-modal-desc">
                  {paymentResult.errorMessage ||
                    'PayHere was unable to process your transaction. Please verify your payment details and try again.'}
                </p>
                <div className="sub-modal-actions">
                  <button type="button" className="sub-btn sub-btn-primary" onClick={handleRetryPayment}>
                    Retry Payment
                  </button>
                  <button type="button" className="sub-btn sub-btn-secondary" onClick={handleClosePaymentModal}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!isSalonAdmin && (
        <div className="sub-alert sub-alert-info">
          You have view-only access. Contact a Salon Admin to renew or change your plan.
        </div>
      )}

      {/* Trial Expired Hero Banner */}
      {isTrialExpired && (
        <section className="sub-trial-hero sub-trial-hero-expired" aria-label="Trial expired notice">
          <div className="sub-trial-hero-head">
            <div className="sub-trial-badge sub-trial-badge-expired">
              <span className="sub-pulse-dot sub-pulse-dot-red" />
              <span>Trial Expired — Restricted Mode</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#9f1239', fontWeight: 600 }}>
              Expired on {formatDate(subscription?.trialEnd ?? subscription?.endDate)}
            </div>
          </div>
          <h2 className="sub-trial-hero-title">Your 21-Day Free Trial Has Ended</h2>
          <p className="sub-trial-hero-desc">
            All your salon client records, appointment logs, service catalogue, employee details, and financial history
            are <strong>safely preserved</strong>. Your salon is currently in <strong>read-only mode</strong> — new
            appointments, customer additions, and checkouts are temporarily paused. Choose an official subscription plan
            below to reactivate your salon with immediate write access.
          </p>
          <div className="sub-trial-features-guarantee">
            <div className="sub-guarantee-item">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Client Database Preserved</span>
            </div>
            <div className="sub-guarantee-item">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Appointment History Intact</span>
            </div>
            <div className="sub-guarantee-item">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Services & Pricing Kept</span>
            </div>
            <div className="sub-guarantee-item">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Instant Activation via PayHere</span>
            </div>
          </div>
        </section>
      )}

      {/* Active Trial Informational Hero Banner */}
      {!isTrialExpired && isTrial && (
        <section className="sub-trial-hero sub-trial-hero-active" aria-label="Trial active notice">
          <div className="sub-trial-hero-head">
            <div className="sub-trial-badge sub-trial-badge-active">
              <span className="sub-pulse-dot sub-pulse-dot-purple" />
              <span>21-Day Free Trial ({daysRemaining ?? 0} days remaining)</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#5b21b6', fontWeight: 600 }}>
              Trial ends on {formatDate(subscription?.trialEnd ?? subscription?.endDate)}
            </div>
          </div>
          <h2 className="sub-trial-hero-title">Enjoying Salon ERP? Upgrade to a Full Plan Anytime</h2>
          <p className="sub-trial-hero-desc">
            You are currently on a 21-day unrestricted trial. You can choose your preferred subscription plan and activate
            early at any time to guarantee uninterrupted access for your entire team.
          </p>
        </section>
      )}

      {/* Pending downgrade / expired renewal alert */}
      {subscription?.pendingPlan &&
        (subscription.status === 'ACTIVE' || subscription.status === 'EXPIRED') && (
          <div
            className="sub-alert sub-alert-info"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {subscription.status === 'EXPIRED' ? (
                <>
                  Your subscription expired. Renew to switch to{' '}
                  <strong>{subscription.pendingPlan.name}</strong>
                  {subscription.pendingPlanPrice
                    ? ` (${formatAmount(subscription.pendingPlanPrice.price, subscription.pendingPlanPrice.currency)}/${billingCycleLabel(subscription.pendingPlanPrice.billingCycle)})`
                    : ''}
                  .
                </>
              ) : (
                <>
                  Downgrade to <strong>{subscription.pendingPlan.name}</strong> is scheduled for{' '}
                  <strong>{formatDate(subscription.endDate)}</strong>. Features stay on your current
                  plan until then. You will pay the new plan price when you renew.
                </>
              )}
            </span>
            {isSalonAdmin && (
              <button
                type="button"
                className="emp-btn emp-btn-secondary emp-btn-sm"
                disabled={mutations.cancelPendingDowngrade.isPending}
                onClick={() => void handleCancelPendingDowngrade()}
              >
                {mutations.cancelPendingDowngrade.isPending ? 'Cancelling…' : 'Cancel downgrade'}
              </button>
            )}
          </div>
        )}

      {/* Header bar */}
      <div className="sub-header-bar">
        <div className="sub-header-info">
          <h1 className="sub-header-title">Subscription & Billing</h1>
          <p className="sub-header-subtitle">
            Manage your salon plan tier, SMS messaging credits, and billing records.
          </p>
        </div>
      </div>

      {/* Top Tab Navigation */}
      <div className="sub-tab-nav-wrap">
        <div className="sub-tab-nav" role="tablist" aria-label="Subscription Sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'plans'}
            className={`sub-tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => handleTabChange('plans')}
          >
            <CreditCard className="h-4 w-4" />
            <span>Plan & Overview</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sms'}
            className={`sub-tab-btn ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => handleTabChange('sms')}
          >
            <MessageSquare className="h-4 w-4" />
            <span>SMS Credits & Wallet</span>
            <span className="sub-tab-badge">Add-on</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'billing'}
            className={`sub-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => handleTabChange('billing')}
          >
            <Receipt className="h-4 w-4" />
            <span>Invoices & Payments</span>
          </button>
        </div>
      </div>

      {activeTab === 'plans' && (
        <div className="sub-tab-pane">
          {/* Stats summary */}
          <section className="sub-stats" aria-label="Subscription summary">
            <article className="sub-stat-card">
              <div className="sub-stat-icon">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="sub-stat-body">
                <div className="sub-stat-label">Current Plan</div>
                <div className="sub-stat-value">{subscription?.plan ?? '—'}</div>
              </div>
            </article>

            <article className="sub-stat-card">
              <div className="sub-stat-icon">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="sub-stat-body">
                <div className="sub-stat-label">Status</div>
                <div className="sub-stat-value">
                  {subscription ? (
                    <span className={subscriptionStatusBadgeClass(subscription.status)}>
                      {subscription.status}
                    </span>
                  ) : (
                    'NONE'
                  )}
                </div>
              </div>
            </article>

            <article className="sub-stat-card">
              <div className="sub-stat-icon">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="sub-stat-body">
                <div className="sub-stat-label">
                  {subscription?.status === 'TRIAL'
                    ? 'Trial Ends'
                    : subscription?.status === 'SUSPENDED' || subscription?.status === 'EXPIRED'
                      ? 'Expired On'
                      : 'Expires'}
                </div>
                <div className="sub-stat-value">{formatDate(expiryDate)}</div>
              </div>
            </article>
          </section>

          {/* Subscription Plans Selection Grid - Shown for Trials, Expired Trials, or on Toggle */}
          {(isTrial || isTrialExpired || showAllPlans) && (
            <section id="subscription-plans" className="sub-plans-section" aria-label="Subscription plans">
              <div className="sub-plans-header">
                <div className="sub-plans-header-left">
                  <h2>{isTrialExpired ? 'Choose a Plan to Reactivate Your Salon' : 'Select a Subscription Plan'}</h2>
                  <p>
                    {isTrialExpired
                      ? 'Select an official subscription plan below. Instant write access will be restored via PayHere.'
                      : 'Explore available plans and choose your preferred billing cycle. All data transitions smoothly.'}
                  </p>
                </div>

                <div className="sub-billing-toggle-wrap">
                  <button
                    type="button"
                    className={`sub-billing-toggle-btn ${selectedCycle === 'MONTHLY' ? 'active' : ''}`}
                    onClick={() => setSelectedCycle('MONTHLY')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`sub-billing-toggle-btn ${selectedCycle === 'YEARLY' ? 'active' : ''}`}
                    onClick={() => setSelectedCycle('YEARLY')}
                  >
                    <span>Yearly</span>
                    {hasYearlySavings && <span className="sub-save-badge">Save ~20%</span>}
                  </button>
                </div>
              </div>

              <div
                className="sub-plans-grid"
                role="region"
                aria-label="Available subscription plans. Scroll horizontally to view more plans."
                tabIndex={0}
              >
                {sortedPlans.map((plan) => {
                  const activePrice =
                    plan.prices?.find((p) => p.billingCycle === selectedCycle) ??
                    plan.prices?.[0];
                  const isCurrent = plan.code === subscription?.planCode;
                  const isPopular = isPopularPlan(plan.code);
                  const isCheckingOut = checkingOutPlanId === plan.id && checkoutLoading;

                  return (
                    <article
                      key={plan.id}
                      className={`sub-plan-card ${isPopular ? 'sub-plan-card-popular' : ''} ${isCurrent ? 'sub-plan-card-current' : ''
                        }`}
                    >
                      {isPopular && <div className="sub-plan-popular-pill">Most Popular</div>}
                      {isCurrent && <div className="sub-plan-current-pill">Current Plan</div>}

                      <h3 className="sub-plan-card-name">{plan.name}</h3>
                      <p className="sub-plan-card-desc">
                        {plan.description || PLAN_HIGHLIGHTS[plan.code] || 'Comprehensive salon ERP features'}
                      </p>

                      <div className="sub-plan-card-price-area">
                        <span className="sub-plan-card-amount">
                          {formatPrice(activePrice?.price, activePrice?.currency ?? 'LKR')}
                        </span>
                        <span className="sub-plan-card-cycle">
                          / {billingCycleLabel(activePrice?.billingCycle ?? selectedCycle)}
                        </span>
                        {selectedCycle === 'YEARLY' && activePrice?.compareAtPrice && (
                          <div className="sub-plan-card-compare">
                            Regular: {formatPrice(activePrice.compareAtPrice, activePrice.currency)}
                          </div>
                        )}
                      </div>

                      <div className="sub-plan-card-features">
                        {plan.features && plan.features.length > 0 ? (
                          plan.features.slice(0, 8).map((feat) => (
                            <div key={feat.code} className="sub-plan-feature-row">
                              <Check className="sub-feature-check h-4 w-4" />
                              <span>{featureLabel(feat.code, feat.name)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="sub-plan-feature-row">
                            <Check className="sub-feature-check h-4 w-4" />
                            <span>All standard salon management modules</span>
                          </div>
                        )}
                      </div>

                      {isSalonAdmin ? (
                        isPaidActive && !isTrialExpired ? (
                          isCurrent ? (
                            <button
                              type="button"
                              className="sub-btn sub-btn-ghost sub-plan-btn-checkout"
                              disabled
                            >
                              Current Active Plan
                            </button>
                          ) : (plan.displayOrder ?? 0) > (currentPlan?.displayOrder ?? 0) ? (
                            <button
                              type="button"
                              className="sub-btn sub-btn-primary sub-plan-btn-checkout"
                              onClick={() =>
                                setPlanChangeModal({
                                  isOpen: true,
                                  mode: 'upgrade',
                                  targetPlanId: plan.id,
                                })
                              }
                            >
                              Preview Upgrade
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="sub-btn sub-btn-secondary sub-plan-btn-checkout"
                              onClick={() =>
                                setPlanChangeModal({
                                  isOpen: true,
                                  mode: 'downgrade',
                                  targetPlanId: plan.id,
                                })
                              }
                            >
                              Preview Downgrade
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            className={`sub-btn sub-plan-btn-checkout ${isPopular ? 'sub-btn-primary' : 'sub-btn-secondary'
                              }`}
                            disabled={checkoutLoading}
                            onClick={() =>
                              void handlePayHereCheckout('SUBSCRIPTION_ACTIVATE', {
                                planId: plan.id,
                                planPriceId: activePrice?.id,
                                billingCycle: selectedCycle,
                              })
                            }
                          >
                            {isCheckingOut ? 'Connecting to PayHere…' : 'Choose Plan & Pay Now'}
                          </button>
                        )
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: 'auto' }}>
                          Salon Admin permission required to subscribe
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Plan toggle button for active paying subscribers */}
          {isPaidActive && !isTrialExpired && (
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="sub-link-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => setShowAllPlans(!showAllPlans)}
              >
                {showAllPlans ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide Plan Comparison
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Compare All Subscription Plans
                  </>
                )}
              </button>
            </div>
          )}

          <div className="sub-layout">
            <section className="sub-panel">
              <div className="sub-panel-head">
                <h2 className="sub-panel-title">Current Subscription</h2>
                <p className="sub-panel-desc">{context.tenant.name}</p>
              </div>

              <div className="sub-panel-body">
                {!subscription ? (
                  <div className="sub-empty">No subscription found for this salon.</div>
                ) : (
                  <dl className="sub-detail-list">
                    <div className="sub-detail-item">
                      <dt>Plan</dt>
                      <dd>
                        <div className="sub-plan-name">{subscription.plan}</div>
                        <div className="sub-plan-code">{subscription.planCode}</div>
                      </dd>
                    </div>

                    <div className="sub-detail-item">
                      <dt>Status</dt>
                      <dd>
                        <span className={subscriptionStatusBadgeClass(subscription.status)}>
                          {subscription.status}
                        </span>
                        {subscription.cancelAtPeriodEnd && (
                          <span className="emp-badge emp-type-out" style={{ marginLeft: 8 }}>
                            Cancels at period end
                          </span>
                        )}
                      </dd>
                    </div>

                    <div className="sub-detail-item">
                      <dt>Billing Cycle</dt>
                      <dd>{billingCycleLabel(subscription.billingCycle)}</dd>
                    </div>

                    <div className="sub-detail-item">
                      <dt>Base Plan Price</dt>
                      <dd>
                        {formatAmount(subscription.price, subscription.currency)} /{' '}
                        {billingCycleLabel(subscription.billingCycle)}
                      </dd>
                    </div>

                    {subscription.totals && subscription.totals.activeAddonsTotal > 0 && (
                      <>
                        <div className="sub-detail-item">
                          <dt>Active Add-ons</dt>
                          <dd style={{ color: '#2563eb' }}>
                            + {formatAmount(subscription.totals.activeAddonsTotal, subscription.currency)} /{' '}
                            {billingCycleLabel(subscription.billingCycle)}
                          </dd>
                        </div>

                        <div className="sub-detail-item">
                          <dt>Next Renewal Total</dt>
                          <dd style={{ color: '#16a34a', fontWeight: 700 }}>
                            {formatAmount(subscription.totals.nextRenewalTotal, subscription.currency)} /{' '}
                            {billingCycleLabel(subscription.billingCycle)}
                          </dd>
                        </div>
                      </>
                    )}

                    {subscription.trialStart && (
                      <div className="sub-detail-item">
                        <dt>Trial Period</dt>
                        <dd>
                          {formatDate(subscription.trialStart)} – {formatDate(subscription.trialEnd)}
                        </dd>
                      </div>
                    )}

                    <div className="sub-detail-item">
                      <dt>{subscription.trialStart && !subscription.startDate ? 'Trial Started' : 'Start Date'}</dt>
                      <dd>{formatDate(subscription.startDate ?? subscription.trialStart)}</dd>
                    </div>

                    <div className="sub-detail-item">
                      <dt>
                        {subscription.status === 'SUSPENDED' || subscription.status === 'EXPIRED'
                          ? 'Last Period Ended'
                          : 'Expiry Date'}
                      </dt>
                      <dd>{formatDate(expiryDate)}</dd>
                    </div>

                    {subscription.status !== 'SUSPENDED' && subscription.status !== 'EXPIRED' && (
                      <div className="sub-detail-item">
                        <dt>Next Billing Date</dt>
                        <dd>{formatDate(subscription.nextBillingDate ?? subscription.endDate)}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {subscription?.addOns && subscription.addOns.length > 0 && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Subscription Add-ons</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {subscription.addOns.map((addon) => {
                        const isCancelling = addon.status === 'CANCEL_AT_PERIOD_END' || (addon.cancelAtPeriodEnd && addon.status === 'ACTIVE');
                        return (
                          <div
                            key={addon.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem',
                              borderRadius: '0.375rem',
                              backgroundColor: 'var(--muted, #f8fafc)',
                              border: '1px solid var(--border, #e2e8f0)',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{addon.name}</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground, #64748b)' }}>
                                {formatAmount(addon.recurringAmount, subscription.currency)} / {billingCycleLabel(subscription.billingCycle)}
                              </div>
                              {isCancelling && (
                                <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.25rem' }}>
                                  Feature remains active until {formatDate(addon.cancellationEffectiveAt ?? subscription.endDate)}. Excluded from next renewal.
                                </div>
                              )}
                            </div>
                            <div>
                              {isCancelling ? (
                                <span className="emp-badge emp-type-out" style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                  Cancels on {formatDate(addon.cancellationEffectiveAt ?? subscription.endDate)}
                                </span>
                              ) : addon.status === 'ACTIVE' ? (
                                <span className="emp-badge emp-type-in" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                                  Active
                                </span>
                              ) : addon.status === 'PENDING_PAYMENT' ? (
                                <span className="emp-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                  Pending Payment
                                </span>
                              ) : (
                                <span className="emp-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                  Cancelled
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {subscription.totals && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                          <span>Current Services Value:</span>
                          <strong>{formatAmount(subscription.totals.currentServiceTotal, subscription.currency)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#166534', fontWeight: 600 }}>
                          <span>Next Renewal Total:</span>
                          <strong>{formatAmount(subscription.totals.nextRenewalTotal, subscription.currency)}</strong>
                        </div>
                        {subscription.totals.scheduledCancellationAddonsTotal > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.25rem' }}>
                            * Next renewal excludes {formatAmount(subscription.totals.scheduledCancellationAddonsTotal, subscription.currency)} of add-ons scheduled for cancellation.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </section>



            {showActions && (

              <section className="sub-panel sub-actions-panel">

                <div className="sub-panel-head">

                  <h2 className="sub-panel-title">Actions</h2>

                  <p className="sub-panel-desc">Manage billing and plan changes</p>

                </div>

                <div className="sub-panel-body">

                  {canActivate && (
                    <button
                      type="button"
                      className="sub-btn sub-btn-primary"
                      disabled={checkoutLoading}
                      onClick={() => {
                        const el = document.getElementById('subscription-plans');
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          void handlePayHereCheckout('SUBSCRIPTION_ACTIVATE');
                        }
                      }}
                    >
                      {checkoutLoading ? 'Redirecting…' : 'Select Plan & Activate'}
                    </button>
                  )}

                  {canRenew && (

                    <button

                      type="button"

                      className="sub-btn sub-btn-primary"

                      disabled={checkoutLoading}

                      onClick={() => void handlePayHereCheckout('SUBSCRIPTION_RENEW')}

                    >

                      {checkoutLoading
                        ? 'Redirecting…'
                        : subscription.status === 'SUSPENDED' || subscription.status === 'EXPIRED'
                          ? `Pay Now / Renew (${formatAmount(subscription.totals?.nextRenewalTotal ?? subscription.price, subscription.currency)})`
                          : subscription.pendingPlanPrice
                            ? `Renew (${formatAmount(subscription.pendingPlanPrice.price, subscription.pendingPlanPrice.currency)})`
                            : `Renew Subscription (${formatAmount(subscription.totals?.nextRenewalTotal ?? subscription.price, subscription.currency)})`}

                    </button>
                  )}

                  {canUpgrade && (
                    <button
                      type="button"
                      className="sub-btn sub-btn-primary"
                      onClick={() => setPlanChangeModal({ isOpen: true, mode: 'upgrade' })}
                    >
                      Upgrade Plan (Preview)
                    </button>
                  )}

                  {canDowngrade && (
                    <button
                      type="button"
                      className="sub-btn sub-btn-primary"
                      onClick={() => setPlanChangeModal({ isOpen: true, mode: 'downgrade' })}
                    >
                      Downgrade Plan (Preview)
                    </button>
                  )}

                  {!canUpgrade && !canDowngrade && subscription && (
                    <button
                      type="button"
                      className="sub-btn sub-btn-primary"
                      onClick={() => setPlanChangeModal({ isOpen: true, mode: 'change' })}
                    >
                      Change Plan (Preview)
                    </button>
                  )}

                  {canCancel && (

                    <button

                      type="button"

                      className="sub-btn sub-btn-ghost"

                      disabled={mutations.cancel.isPending}

                      onClick={() => void handleCancel()}

                    >

                      Cancel Subscription

                    </button>

                  )}

                  {subscription?.cancelAtPeriodEnd && subscription.status === 'ACTIVE' && (

                    <button

                      type="button"

                      className="sub-btn sub-btn-secondary"

                      disabled={mutations.undoCancel.isPending}

                      onClick={() => void handleUndoCancel()}

                    >

                      Undo Cancellation

                    </button>

                  )}

                </div>

              </section>

            )}

          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="sub-tab-pane">
          <div className="sub-section-stack" style={{ marginTop: 0 }}>
            <section className="sub-panel">
              <div className="sub-panel-head">
                <h2 className="sub-panel-title">Payment History</h2>
                <p className="sub-panel-desc">Verified payments through PayHere and other gateways</p>
              </div>

              <div className="sub-panel-body">
                {paymentsLoading ? (
                  <div className="sub-empty">Loading payments…</div>
                ) : !payments?.data.length ? (
                  <div className="sub-empty">No payments recorded yet.</div>
                ) : (
                  <>
                    <PaymentRecords payments={payments.data} />
                    <PaginationBar
                      page={paymentsPage}
                      totalPages={payments.meta.totalPages ?? 1}
                      onPrevious={() => setPaymentsPage((p) => p - 1)}
                      onNext={() => setPaymentsPage((p) => p + 1)}
                    />
                  </>
                )}
              </div>
            </section>

            <section className="sub-panel">
              <div className="sub-panel-head">
                <h2 className="sub-panel-title">Invoices</h2>
                <p className="sub-panel-desc">Download invoices for completed payments</p>
              </div>

              <div className="sub-panel-body">
                {!isSalonAdmin ? (
                  <div className="sub-empty">Invoice access requires Salon Admin permissions.</div>
                ) : invoicesLoading ? (
                  <div className="sub-empty">Loading invoices…</div>
                ) : invoicesError ? (
                  <div className="sub-empty">Failed to load invoices.</div>
                ) : !invoices?.data.length ? (
                  <div className="sub-empty">No invoices available yet.</div>
                ) : (
                  <>
                    <InvoiceRecords
                      invoices={invoices.data}
                      downloadingInvoiceId={downloadingInvoiceId}
                      emailingInvoiceId={emailingInvoiceId}
                      onDownload={(id, invoiceNumber) => void handleInvoiceDownload(id, invoiceNumber)}
                      onSendEmail={(id, invoiceNumber) => void handleSendInvoiceEmail(id, invoiceNumber)}
                    />
                    <PaginationBar
                      page={invoicesPage}
                      totalPages={invoices.meta.totalPages ?? 1}
                      onPrevious={() => setInvoicesPage((p) => p - 1)}
                      onNext={() => setInvoicesPage((p) => p + 1)}
                    />
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'sms' && (
        <div className="sub-tab-pane">
          <SmsManagementSection />
        </div>
      )}

      <PlanChangeDialog
        open={planChangeModal.isOpen}
        onOpenChange={(open) => setPlanChangeModal((prev) => ({ ...prev, isOpen: open }))}
        subscriptionId={subscription?.id}
        salonName={context?.tenant.name}
        plans={publicPlans}
        currentPlanCode={subscription?.planCode ?? ''}
        currentBillingCycle={(subscription?.billingCycle as 'MONTHLY' | 'YEARLY') ?? 'MONTHLY'}
        initialTargetPlanId={planChangeModal.targetPlanId}
        mode={planChangeModal.mode}
        onPayHereCheckout={(options) => handlePayHereCheckout('SUBSCRIPTION_UPGRADE', options)}
        onPlanChanged={() => void refetch()}
      />

    </div>

  );

}


