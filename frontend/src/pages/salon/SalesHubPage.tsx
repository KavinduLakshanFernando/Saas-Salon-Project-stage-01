import { useNavigate, Link } from 'react-router-dom';
import {
  Receipt,
  FileText,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Banknote,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant.api';
import { useAuth } from '@/contexts/AuthContext';
import { resolveNavAccess } from '@/lib/salon-access';
import { formatMoneyAmount } from '@/lib/money';

interface SalesCardItem {
  id: string;
  name: string;
  description: string;
  to: string;
  icon: LucideIcon;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  hoverBorder: string;
  feature?: string;
  module?: string;
}

const SALES_CARDS: SalesCardItem[] = [
  {
    id: 'quotations',
    name: 'Quotations >',
    description: 'Customer quotes & proposals...',
    to: '/salon/quotations',
    icon: FileText,
    iconBg: 'bg-[#fff7ed]',
    iconBorder: 'border-[#ffedd5]',
    iconColor: 'text-[#f97316]',
    hoverBorder: 'hover:border-[#fed7aa]',
    feature: 'QUOTATIONS',
    module: 'QUOTATIONS',
  },
  {
    id: 'transactions',
    name: 'Transactions >',
    description: 'Completed sales & POS drafts...',
    to: '/salon/sales',
    icon: Receipt,
    iconBg: 'bg-[#f0fdf4]',
    iconBorder: 'border-[#dcfce7]',
    iconColor: 'text-[#10b981]',
    hoverBorder: 'hover:border-[#bbf7d0]',
    module: 'POS',
  },
  {
    id: 'sales-report',
    name: 'Sales Report >',
    description: 'Sales revenue & analytics...',
    to: '/salon/reports?tab=sales',
    icon: BarChart3,
    iconBg: 'bg-[#faf5ff]',
    iconBorder: 'border-[#f3e8ff]',
    iconColor: 'text-[#8b5cf6]',
    hoverBorder: 'hover:border-[#ddd6fe]',
    feature: 'SALES_REPORTS',
    module: 'POS',
  },
];

export default function SalesHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: features = [] } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantApi.features,
    staleTime: 60_000,
  });

  const { data: salesResponse } = useQuery({
    queryKey: ['sales-hub-stats'],
    queryFn: () => tenantApi.sales.listPaginated({ limit: '10' }),
  });

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  const visibleCards = SALES_CARDS.filter((card) => {
    const access = resolveNavAccess({
      feature: card.feature,
      module: card.module,
      enabledFeatures: features,
      roles,
      permissions,
    });
    return access !== 'hidden';
  });

  const canAccessReports = resolveNavAccess({
    feature: 'SALES_REPORTS',
    module: 'POS',
    enabledFeatures: features,
    roles,
    permissions,
  }) !== 'hidden';

  const sales = salesResponse?.data ?? [];
  const totalTransactions = salesResponse?.meta?.total ?? sales.length;
  const recentTotalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-4 px-2 sm:px-4 space-y-6">
      {/* Back button link */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/salon/more')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to More</span>
        </button>
      </div>

      {/* Hero Banner */}
      <div className="flex items-center gap-3.5 p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#dcfce7] flex items-center justify-center shrink-0">
          <Receipt className="w-6 h-6 text-[#10b981]" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tracking-tight">
            Sales
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Manage quotations, view transactions history and sales reporting.
          </p>
        </div>
      </div>

      {/* Sub-Feature Tabs / Cards - Dynamically filtered by tenant plan features */}
      <div className={`grid gap-3 sm:gap-4 ${visibleCards.length === 1 ? 'grid-cols-1' : visibleCards.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              to={card.to}
              className={`flex flex-col justify-between p-4 sm:p-5 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md ${card.hoverBorder} transition-all group min-h-[116px] sm:min-h-[124px]`}
            >
              <div className="flex items-center justify-between mb-3 w-full">
                <div className={`w-11 h-11 rounded-2xl ${card.iconBg} border ${card.iconBorder} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={2.2} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-slate-700 transition-colors leading-tight">
                  {card.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Summary Overview */}
      <div className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Sales Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Receipt className="w-4 h-4 text-[#10b981]" />
              <span className="text-xs font-medium">Total Transactions</span>
            </div>
            <div className="text-xl font-black text-slate-900">{totalTransactions}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Banknote className="w-4 h-4 text-[#2563eb]" />
              <span className="text-xs font-medium">Recent Volume</span>
            </div>
            <div className="text-xl font-black text-slate-900">
              LKR {formatMoneyAmount(recentTotalRevenue)}
            </div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium">
                {canAccessReports ? 'Analytics' : 'Transactions'}
              </span>
            </div>
            <Link
              to={canAccessReports ? '/salon/reports?tab=sales' : '/salon/sales'}
              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 mt-1"
            >
              {canAccessReports ? 'View Sales Analytics >' : 'View Transactions >'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
