import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, MessageSquare, Sparkles, X } from 'lucide-react';
import { smsApi } from '../api/sms.api';
import { Button } from '@/components/ui/button';

interface LowBalanceWarningBannerProps {
  className?: string;
}

export function LowBalanceWarningBanner({ className = '' }: LowBalanceWarningBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ['sms-wallet'],
    queryFn: smsApi.getWallet,
    staleTime: 30_000,
  });

  // Do not show if plan covers unlimited SMS quota or dismissed
  if (!wallet || wallet.isPlanCovered || dismissed) {
    return null;
  }

  const isInactive = !wallet.isActive;
  const isZero = wallet.balance === 0;
  const isLow = wallet.isLowBalance;

  // If active and healthy balance, don't show any warning
  if (!isInactive && !isZero && !isLow) {
    return null;
  }

  const handleRedirectToSms = () => {
    navigate('/salon/subscription?tab=sms#sms-addon');
    setTimeout(() => {
      const el = document.getElementById('sms-addon');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // 1. INACTIVE SMS SERVICE (Basic / Silver Plan before Super Admin activates)
  if (isInactive) {
    return (
      <div
        className={`mx-3 sm:mx-4 md:mx-6 mb-4 p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs bg-gradient-to-r from-sky-50/90 via-indigo-50/80 to-purple-50/90 border-indigo-200/80 text-indigo-950 transition-all duration-200 ${className}`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg shrink-0 bg-indigo-100 text-indigo-600">
            <Sparkles size={20} className="text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold tracking-tight text-indigo-950">
                SMS Feature Available for Your Salon
              </h4>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100/90 text-indigo-700 border border-indigo-200/60">
                Contact Super Admin
              </span>
            </div>
            <p className="text-xs text-indigo-900/80 mt-0.5 leading-relaxed">
              SMS notifications and digital eBills are currently disabled for your salon. Contact the Super Admin to activate SMS and allocate credits to your wallet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
          <Button
            type="button"
            size="sm"
            onClick={handleRedirectToSms}
            className="w-full sm:w-auto h-8 text-xs font-semibold px-3.5 rounded-lg shadow-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
          >
            <MessageSquare size={13} />
            <span>Activation Info</span>
            <ChevronRight size={13} />
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md transition-colors cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // 2. EXHAUSTED OR LOW BALANCE (Active, but 0 or running low)
  return (
    <div
      className={`mx-3 sm:mx-4 md:mx-6 mb-4 p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs transition-all duration-200 ${
        isZero
          ? 'bg-rose-50/90 border-rose-200/80 text-rose-950'
          : 'bg-amber-50/90 border-amber-200/80 text-amber-950'
      } ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg shrink-0 ${
            isZero ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          <AlertTriangle size={20} className="animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold tracking-tight">
              {isZero
                ? 'Your SMS Credits Are Exhausted!'
                : 'Your SMS Credits Are Running Low!'}
            </h4>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                isZero
                  ? 'bg-rose-200/80 text-rose-800'
                  : 'bg-amber-200/80 text-amber-800'
              }`}
            >
              {isZero ? '0 Credits Left' : `${wallet.balance} Credits Left`}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            {isZero
              ? 'Outgoing customer SMS messages and eBills are paused. Contact the Super Admin to add more SMS credits.'
              : `You have only ${wallet.balance} SMS credit${
                  wallet.balance === 1 ? '' : 's'
                } remaining. Contact the Super Admin to add more credits.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
        <Button
          type="button"
          size="sm"
          onClick={handleRedirectToSms}
          className={`w-full sm:w-auto h-8 text-xs font-semibold px-3.5 rounded-lg shadow-xs gap-1.5 cursor-pointer ${
            isZero
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          <MessageSquare size={13} />
          <span>Top Up Info</span>
          <ChevronRight size={13} />
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md transition-colors cursor-pointer"
          title="Dismiss warning"
          aria-label="Dismiss warning"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
