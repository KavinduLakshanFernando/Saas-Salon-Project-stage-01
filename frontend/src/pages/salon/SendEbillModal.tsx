import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantApi } from '@/api/tenant.api';
import { smsApi } from '@/features/sms/api/sms.api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SendEbillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  customerName?: string | null;
  defaultPhone?: string | null;
}

function formatStatusBadge(status: 'NOT_SENT' | 'PENDING' | 'SENT' | 'FAILED') {
  switch (status) {
    case 'SENT':
      return {
        label: 'SMS Delivered / Sent',
        bg: '#ecfdf5',
        color: '#059669',
        border: '#a7f3d0',
        icon: <CheckCircle2 size={13} />,
      };
    case 'PENDING':
      return {
        label: 'SMS Pending',
        bg: '#fffbeb',
        color: '#d97706',
        border: '#fde68a',
        icon: <RefreshCw size={13} className="animate-spin" />,
      };
    case 'FAILED':
      return {
        label: 'SMS Failed',
        bg: '#fef2f2',
        color: '#dc2626',
        border: '#fecaca',
        icon: <XCircle size={13} />,
      };
    case 'NOT_SENT':
    default:
      return {
        label: 'SMS Not Sent',
        bg: '#f8fafc',
        color: '#64748b',
        border: '#e2e8f0',
        icon: null,
      };
  }
}

export default function SendEbillModal({
  open,
  onOpenChange,
  saleId,
  customerName,
  defaultPhone,
}: SendEbillModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const { data: enabledFeatures = [] } = useQuery<string[]>({
    queryKey: ['tenant-features'],
    queryFn: tenantApi.features.listEnabled,
    enabled: open,
  });

  const { data: smsWallet, refetch: refetchWallet } = useQuery({
    queryKey: ['sms-wallet'],
    queryFn: smsApi.getWallet,
    enabled: open,
  });

  const { data: invoiceLink, refetch: refetchLink } = useQuery({
    queryKey: ['invoice-link', saleId],
    queryFn: () => tenantApi.sales.getInvoiceLink(saleId),
    enabled: open,
  });

  // Sync phone input when invoiceLink or defaultPhone resolves
  const resolvedInitialPhone = invoiceLink?.customerPhone || defaultPhone || '';
  useEffect(() => {
    if (resolvedInitialPhone && !phoneInput) {
      setPhoneInput(resolvedInitialPhone);
    }
  }, [resolvedInitialPhone]);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPhoneInput(invoiceLink?.customerPhone || defaultPhone || '');
      setStatusMsg(null);
    }
  }, [open, saleId, defaultPhone]);

  const hasSmsFeature = enabledFeatures.includes('SMS_NOTIFICATIONS');
  const hasWhatsappFeature =
    enabledFeatures.includes('WHATSAPP_NOTIFICATIONS') ||
    enabledFeatures.includes('WHATSAPP') ||
    enabledFeatures.includes('WHATSAPP_INVOICES');

  const isPlanCovered = Boolean(smsWallet?.isPlanCovered);
  const isWalletActive = Boolean(smsWallet?.isActive);
  const availableCredits = smsWallet?.balance ?? 0;
  const canSendSms =
    isPlanCovered ||
    (isWalletActive && availableCredits > 0) ||
    (hasSmsFeature && availableCredits > 0);
  const activePhone = phoneInput.trim();

  const smsMutation = useMutation({
    mutationFn: () => tenantApi.sales.resendEbillSms(saleId, activePhone),
    onSuccess: (res) => {
      setStatusMsg({
        type: res.success ? 'success' : 'error',
        text: res.message || (res.success ? 'eBill SMS sent successfully!' : 'SMS dispatch failed'),
      });
      void refetchLink();
      void refetchWallet();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to send SMS';
      setStatusMsg({ type: 'error', text: msg });
      void refetchLink();
      void refetchWallet();
    },
  });

  const whatsappMutation = useMutation({
    mutationFn: () => tenantApi.sales.sendEbillWhatsapp(saleId, activePhone),
    onSuccess: (res) => {
      setStatusMsg({
        type: 'success',
        text: 'Opening WhatsApp with digital eBill link…',
      });
      if (res?.externalUrl) {
        window.open(res.externalUrl, '_blank', 'noopener,noreferrer');
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to open WhatsApp';
      setStatusMsg({ type: 'error', text: msg });
    },
  });

  const handleCopyLink = () => {
    if (invoiceLink?.ebillUrl) {
      void navigator.clipboard.writeText(invoiceLink.ebillUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const smsStatusBadge = invoiceLink ? formatStatusBadge(invoiceLink.smsStatus) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="pos-ebill-dialog w-[calc(100%-1.5rem)] max-w-[480px] p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto box-border"
        style={{ margin: 'auto' }}
      >
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
            <Send size={18} className="text-emerald-600 shrink-0" />
            <span>Send Digital E-Bill</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 mt-2 w-full box-border">
          {/* Customer Info Card */}
          <div className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col gap-2">
            {customerName && (
              <p className="m-0 text-xs sm:text-sm font-semibold text-slate-900 truncate">
                {customerName}
              </p>
            )}

            <div className="flex flex-col gap-1 w-full box-border">
              <label
                htmlFor="ebill-phone-input"
                className="text-[11px] font-bold text-slate-500 uppercase tracking-wide"
              >
                Mobile Number for WhatsApp / SMS:
              </label>
              <div className="relative flex items-center w-full box-border">
                <Phone
                  size={14}
                  className="absolute left-3 text-slate-500 pointer-events-none"
                />
                <input
                  id="ebill-phone-input"
                  type="tel"
                  placeholder="e.g. 0771234567 or +94771234567"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full box-border pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              {!activePhone && (
                <p className="m-0 text-[11px] text-amber-600 font-medium leading-tight pt-0.5">
                  ⚠ No phone number entered. Enter a mobile number above to send via WhatsApp or SMS.
                </p>
              )}
            </div>
          </div>

          {/* E-Bill Link Card */}
          {invoiceLink && (
            <div className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-600">
                  SMS eBill Status:
                </span>
                {smsStatusBadge && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: smsStatusBadge.bg,
                      color: smsStatusBadge.color,
                      border: `1px solid ${smsStatusBadge.border}`,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {smsStatusBadge.icon} {smsStatusBadge.label}
                  </span>
                )}
              </div>

              {invoiceLink.smsSentAt && (
                <div className="text-[11px] text-slate-500">
                  Last Sent: {new Date(invoiceLink.smsSentAt).toLocaleString('en-LK')}
                  {invoiceLink.smsAttempts > 0 && ` (Attempts: ${invoiceLink.smsAttempts})`}
                </div>
              )}

              {invoiceLink.smsStatus === 'FAILED' && invoiceLink.smsFailureReason && (
                <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                  Failure Reason: {invoiceLink.smsFailureReason}
                </div>
              )}

              {/* Copyable eBill URL */}
              {invoiceLink.ebillUrl && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1 pt-2.5 border-t border-dashed border-slate-200 w-full box-border">
                  <input
                    readOnly
                    value={invoiceLink.ebillUrl}
                    className="flex-1 min-w-0 box-border text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono select-all truncate"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                      className="h-8 gap-1.5 text-xs font-semibold rounded-lg flex-1 sm:flex-initial"
                    >
                      <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(invoiceLink.ebillUrl, '_blank')}
                      className="h-8 w-8 p-0 rounded-lg shrink-0"
                      title="Open link in new tab"
                    >
                      <ExternalLink size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                background: statusMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                color: statusMsg.type === 'success' ? '#047857' : '#b91c1c',
                border: `1px solid ${statusMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              }}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Delivery Channels */}
          <div className="flex flex-col gap-3">
            {/* WhatsApp Channel */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <MessageCircle size={15} className="text-emerald-600" />
                  WhatsApp E-Bill
                </span>
                {hasWhatsappFeature ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                    Not In Plan
                  </span>
                )}
              </div>

              {hasWhatsappFeature ? (
                <>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg p-2.5 text-[11px] text-slate-700 leading-relaxed">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                      Message & Bill Link:
                    </span>
                    <p className="m-0 font-mono text-[11px] text-emerald-950 truncate select-all">
                      {invoiceLink?.ebillUrl || 'Loading E-Bill Link…'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    disabled={whatsappMutation.isPending || !activePhone}
                    onClick={() => {
                      setStatusMsg(null);
                      whatsappMutation.mutate();
                    }}
                    className="w-full h-10 font-semibold gap-2 text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors"
                  >
                    <MessageCircle size={16} />
                    {whatsappMutation.isPending ? 'Preparing WhatsApp…' : 'Send via WhatsApp'}
                  </Button>
                </>
              ) : (
                <div className="text-[11px] text-emerald-900/80 leading-relaxed bg-white/70 border border-emerald-100 rounded-lg p-2.5">
                  <p className="m-0 font-medium">
                    WhatsApp invoice delivery is not enabled for your salon. Contact Super Admin to enable the <strong>WhatsApp Notifications</strong> feature.
                  </p>
                </div>
              )}
            </div>

            {/* SMS Channel */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                  <Smartphone size={15} className="text-sky-600" />
                  SMS E-Bill
                </span>
                {hasSmsFeature || isPlanCovered || isWalletActive ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-300">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                    Not In Plan
                  </span>
                )}
              </div>

              {canSendSms && (isPlanCovered || availableCredits > 0) ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                    <span>Estimated: 1 credit (1 SMS segment)</span>
                    <span className="font-semibold text-slate-700">
                      {isPlanCovered
                        ? 'Included in plan quota'
                        : `${availableCredits} credit${availableCredits === 1 ? '' : 's'} available`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    disabled={smsMutation.isPending || !activePhone}
                    onClick={() => {
                      setStatusMsg(null);
                      smsMutation.mutate();
                    }}
                    className="w-full h-10 font-semibold gap-2 text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg shadow-sm transition-colors"
                  >
                    <Smartphone size={16} />
                    {smsMutation.isPending
                      ? 'Dispatching SMS…'
                      : invoiceLink?.smsStatus === 'SENT'
                        ? 'Resend eBill SMS'
                        : 'Send eBill SMS'}
                  </Button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex flex-col gap-1.5 text-[11px] text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <AlertTriangle size={13} className="text-amber-600" />
                    {!isWalletActive && !isPlanCovered
                      ? 'SMS Not Activated'
                      : 'SMS Credits Required'}
                  </div>
                  <p className="m-0 leading-relaxed text-amber-800">
                    {!isWalletActive && !isPlanCovered
                      ? 'SMS notifications are not activated for your salon. Contact Super Admin to activate SMS or upgrade your plan.'
                      : 'You have 0 SMS credits remaining. Contact Super Admin to recharge SMS credits.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/salon/subscription?tab=sms#sms-addon');
                    }}
                    className="mt-1 h-7 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md self-start"
                  >
                    View SMS Status
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
