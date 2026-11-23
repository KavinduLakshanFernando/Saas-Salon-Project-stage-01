import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  UserCheck,
  Package,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';
import { tenantApi } from '@/api/tenant.api';
import { useAuth } from '@/contexts/AuthContext';
import { resolveNavAccess } from '@/lib/salon-access';

interface ReportCardItem {
  id: string;
  name: string;
  description: string;
  to: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  borderHover: string;
  feature?: string;
  anyFeature?: string[];
  module?: string;
}

const REPORT_CARDS: ReportCardItem[] = [
  {
    id: 'profit-loss',
    name: 'P & L Report',
    description: 'Profit & Loss statement...',
    to: '/salon/reports?tab=profit-loss',
    icon: TrendingUp,
    iconBg: 'bg-[#f0fdf4]',
    iconColor: 'text-[#16a34a]',
    borderHover: 'hover:border-[#bbf7d0]',
  },
  {
    id: 'sales',
    name: 'Sales Report',
    description: 'Detailed sales & transactions...',
    to: '/salon/reports?tab=sales',
    icon: CreditCard,
    iconBg: 'bg-[#eff6ff]',
    iconColor: 'text-[#2563eb]',
    borderHover: 'hover:border-[#bfdbfe]',
    feature: 'SALES_REPORTS',
    module: 'POS',
  },
  {
    id: 'employee-performance',
    name: 'Employee Performance',
    description: 'Staff commissions & services...',
    to: '/salon/reports?tab=employee-performance',
    icon: UserCheck,
    iconBg: 'bg-[#fffbeb]',
    iconColor: 'text-[#ea580c]',
    borderHover: 'hover:border-[#fed7aa]',
    feature: 'EMPLOYEE_REPORTS',
    module: 'POS',
  },
  {
    id: 'inventory',
    name: 'Inventory Report',
    description: 'Stock valuation & adjustments...',
    to: '/salon/reports?tab=inventory',
    icon: Package,
    iconBg: 'bg-[#faf5ff]',
    iconColor: 'text-[#9333ea]',
    borderHover: 'hover:border-[#ddd6fe]',
    feature: 'INVENTORY_REPORTS',
    module: 'INVENTORY',
  },
  {
    id: 'payroll',
    name: 'Payroll Report',
    description: 'Export PDF & Excel statements...',
    to: '/salon/payroll/runs',
    icon: FileSpreadsheet,
    iconBg: 'bg-[#fff1f2]',
    iconColor: 'text-[#e11d48]',
    borderHover: 'hover:border-[#fecdd3]',
    feature: 'PAYROLL',
    module: 'PAYROLL',
  },
];

export default function ReportsHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: features = [] } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantApi.features,
    staleTime: 60_000,
  });

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  const visibleCards = REPORT_CARDS.filter((card) => {
    if (card.anyFeature && !card.anyFeature.some((f) => features.includes(f))) {
      return false;
    }
    const access = resolveNavAccess({
      feature: card.feature,
      module: card.module,
      enabledFeatures: features,
      roles,
      permissions,
    });
    return access !== 'hidden';
  });

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
        <div className="w-12 h-12 rounded-2xl bg-[#faf5ff] border border-[#f3e8ff] flex items-center justify-center shrink-0">
          <BarChart3 className="w-6 h-6 text-[#9333ea]" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tracking-tight">
            Reports &amp; Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Financial statements, sales trends, staff performance, inventory, and payroll exports.
          </p>
        </div>
      </div>

      {/* Sub-Report Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {visibleCards.map((card) => {
          const IconComp = card.icon;
          return (
            <Link
              key={card.id}
              to={card.to}
              className={`flex flex-col justify-between p-4 sm:p-5 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md ${card.borderHover} transition-all group min-h-[116px] sm:min-h-[124px]`}
            >
              <div className="flex items-center justify-between mb-3 w-full">
                <div
                  className={`w-11 h-11 rounded-2xl ${card.iconBg} border border-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}
                >
                  <IconComp className={`w-5 h-5 ${card.iconColor}`} strokeWidth={2.2} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-primary transition-colors leading-tight">
                  {card.name} &gt;
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
