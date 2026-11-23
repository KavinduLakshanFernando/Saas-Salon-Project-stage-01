import {
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock,
  Coins,
  CreditCard,
  FileText,
  GitBranch,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Receipt,
  Scissors,
  Globe,
  Settings,
  Shirt,
  Tag,
  ArrowLeftRight,
  ShoppingCart,
  Sparkles,
  Truck,
  TrendingUp,
  User,
  Users,
  UserSquare2,
  Wallet,
  Calendar,
  Grid2X2,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant.api';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/salon/NotificationBell';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SalonBranchProvider, useSalonBranch } from '@/contexts/SalonBranchContext';
import { TenantThemeProvider, useTenantTheme } from '@/contexts/TenantThemeContext';
import { PageTitleProvider, usePageTitle } from '@/contexts/PageTitleContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveUploadUrl } from '@/lib/upload-url';
import { cn } from '@/lib/utils';
import { resolveNavAccess, type NavAccessState } from '@/lib/salon-access';
import SalonPermissionGate from '@/routes/SalonPermissionGate';
import { formatRoleLabel } from '@/pages/salon/settings-feature-modules';
import { HeaderSubscriptionPill } from '@/components/salon/SubscriptionBanner';
import { DemoBanner } from '@/components/salon/DemoBanner';
import { LowBalanceWarningBanner } from '@/features/sms/components/LowBalanceWarningBanner';
import { APP_NAME } from '@/config/brand';
import './salon-admin-sidebar.css';
import './salon-brand-overrides.css';

function primaryRoleLabel(roles: string[] | undefined | null): string | null {
  if (!roles?.length) return null;
  const preferred =
    roles.find((role) => role === 'SALON_ADMIN') ??
    roles.find((role) => role !== 'SUPER_ADMIN') ??
    roles[0];
  return formatRoleLabel(preferred);
}

function SalonLogo({
  logoUrl,
  size = 'md',
}: {
  logoUrl: string | null;
  size?: 'sm' | 'md';
}) {
  const logoSrc = resolveUploadUrl(logoUrl);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
      )}
    >
      {logoSrc ? (
        <img src={logoSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <Scissors className={cn('text-muted-foreground', size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')} />
      )}
    </div>
  );
}

function SalonBrand({
  salonName,
  logoUrl,
  collapsed = false,
}: {
  salonName: string;
  logoUrl: string | null;
  collapsed?: boolean;
}) {
  return (
    <div
      title={collapsed ? salonName : undefined}
      className={cn('flex min-w-0 items-center', collapsed ? 'justify-center' : 'gap-3')}
    >
      <SalonLogo logoUrl={logoUrl} />
      {!collapsed && (
        <div className="salon-brand-text-wrap min-w-0">
          <p className="text-xs text-muted-foreground">{APP_NAME}</p>
          <p className="truncate text-base font-semibold leading-tight">{salonName}</p>
        </div>
      )}
    </div>
  );
}

type NavLinkItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  feature?: string;
  module?: string;
  adminOnly?: boolean;
  disabled?: boolean;
  badge?: string;
};

type NavGroup = {
  label?: string;
  to?: string;
  icon?: LucideIcon;
  feature?: string;
  module?: string;
  adminOnly?: boolean;
  disabled?: boolean;
  badge?: string;
  children?: NavLinkItem[];
};

const navGroups: NavGroup[] = [
  { to: '/salon/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'POS' },
  {
    label: 'Sales',
    icon: ShoppingCart,
    module: 'POS',
    children: [
      { to: '/salon/pos', label: 'POS', icon: ShoppingCart, feature: 'POS', module: 'POS' },
      { to: '/salon/sales', label: 'Transactions', icon: Receipt, module: 'POS' },
      {
        to: '/salon/quotations',
        label: 'Quotations',
        icon: FileText,
        feature: 'QUOTATIONS',
        module: 'QUOTATIONS',
      },
      {
        to: '/salon/reports?tab=sales',
        label: 'Sales Report',
        icon: BarChart3,
        feature: 'POS',
        module: 'POS',
      },
    ],
  },
  {
    label: 'Appointments',
    icon: CalendarDays,
    feature: 'APPOINTMENTS',
    module: 'APPOINTMENTS',
    children: [
      {
        to: '/salon/appointments',
        label: 'Calendar & Bookings',
        icon: CalendarDays,
        feature: 'APPOINTMENTS',
        module: 'APPOINTMENTS',
      },
    ],
  },
  {
    label: 'Customers',
    icon: Users,
    feature: 'CUSTOMERS',
    module: 'CUSTOMERS',
    children: [
      {
        to: '/salon/customers',
        label: 'Customer List',
        icon: Users,
        feature: 'CUSTOMERS',
        module: 'CUSTOMERS',
      },
    ],
  },
  {
    label: 'Services',
    icon: Scissors,
    feature: 'SERVICES',
    module: 'SERVICES',
    children: [
      {
        to: '/salon/services',
        label: 'Service Catalog',
        icon: Scissors,
        feature: 'SERVICES',
        module: 'SERVICES',
      },
      {
        to: '/salon/service-categories',
        label: 'Categories',
        icon: Sparkles,
        feature: 'SERVICES',
        module: 'SERVICES',
      },
    ],
  },
  {
    label: 'Rentals',
    icon: Shirt,
    feature: 'RENTALS',
    module: 'RENTALS',
    children: [
      {
        to: '/salon/rentals/overview',
        label: 'Overview',
        icon: LayoutDashboard,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/items',
        label: 'Rental Items',
        icon: Tag,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/categories',
        label: 'Categories',
        icon: Layers,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/bookings',
        label: 'Bookings',
        icon: CalendarDays,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/bookings?status=RESERVED',
        label: 'Pickup / Handover',
        icon: PackageCheck,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/returns',
        label: 'Returns & Settlement',
        icon: ArrowLeftRight,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/payments',
        label: 'Payments',
        icon: CreditCard,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/reports?tab=history',
        label: 'Rental History',
        icon: Clock,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
      {
        to: '/salon/rentals/reports',
        label: 'Reports',
        icon: BarChart3,
        feature: 'RENTALS',
        module: 'RENTALS',
      },
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    feature: 'INVENTORY',
    module: 'INVENTORY',
    children: [
      {
        to: '/salon/products',
        label: 'Products',
        icon: Package,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
      {
        to: '/salon/stock',
        label: 'Stock Management',
        icon: Boxes,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
      {
        to: '/salon/product-categories',
        label: 'Categories',
        icon: Sparkles,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
    ],
  },
  {
    label: 'Suppliers & GRN',
    icon: Truck,
    feature: 'INVENTORY',
    module: 'INVENTORY',
    children: [
      {
        to: '/salon/suppliers',
        label: 'Suppliers',
        icon: Truck,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
      {
        to: '/salon/grns',
        label: 'GRN / Purchases',
        icon: FileText,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
      {
        to: '/salon/supplier-payments',
        label: 'Supplier Payments',
        icon: CreditCard,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
      {
        to: '/salon/supplier-outstanding',
        label: 'Outstanding / Credit',
        icon: Coins,
        feature: 'INVENTORY',
        module: 'INVENTORY',
      },
    ],
  },
  {
    label: 'Expenses',
    icon: Coins,
    feature: 'EXPENSES',
    module: 'EXPENSES',
    children: [
      {
        to: '/salon/expenses',
        label: 'Expense List',
        icon: Coins,
        feature: 'EXPENSES',
        module: 'EXPENSES',
      },
      {
        to: '/salon/expense-categories',
        label: 'Categories',
        icon: Sparkles,
        feature: 'EXPENSES',
        module: 'EXPENSES',
      },
    ],
  },
  {
    label: 'Payroll',
    icon: Wallet,
    feature: 'PAYROLL',
    module: 'PAYROLL',
    children: [
      {
        to: '/salon/payroll/runs',
        label: 'Run Payroll',
        icon: Wallet,
        feature: 'PAYROLL',
        module: 'PAYROLL',
      },
      {
        to: '/salon/payroll/advances',
        label: 'Advance Payments',
        icon: Wallet,
        feature: 'PAYROLL',
        module: 'PAYROLL',
      },
      {
        to: '/salon/payroll/loans',
        label: 'Employee Loans',
        icon: Wallet,
        feature: 'PAYROLL',
        module: 'PAYROLL',
      },
      {
        to: '/salon/payroll/payslips',
        label: 'Payslips',
        icon: Wallet,
        feature: 'PAYROLL',
        module: 'PAYROLL',
      },
    ],
  },
  {
    label: 'Employees',
    icon: UserSquare2,
    feature: 'EMPLOYEES',
    children: [
      {
        to: '/salon/employees',
        label: 'Staff Management',
        icon: UserSquare2,
        feature: 'EMPLOYEES',
      },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      {
        to: '/salon/reports?tab=profit-loss',
        label: 'Profit & Loss',
        icon: TrendingUp,
      },
      {
        to: '/salon/reports?tab=sales',
        label: 'Sales Report',
        icon: Receipt,
        feature: 'SALES_REPORTS',
        module: 'POS',
      },
      {
        to: '/salon/reports?tab=employee-performance',
        label: 'Employee Performance',
        icon: UserSquare2,
        feature: 'EMPLOYEE_REPORTS',
        module: 'POS',
      },
      {
        to: '/salon/reports?tab=inventory',
        label: 'Inventory Report',
        icon: Package,
        feature: 'INVENTORY_REPORTS',
        module: 'INVENTORY',
      },
    ],
  },
  {
    to: '/salon/branches',
    label: 'Branches',
    icon: GitBranch,
    module: 'MULTI_BRANCH',
  },
  {
    label: 'Subscription',
    icon: CreditCard,
    adminOnly: true,
    children: [
      {
        to: '/salon/subscription?tab=plans',
        label: 'Plan & Overview',
        icon: CreditCard,
        adminOnly: true,
      },
      {
        to: '/salon/subscription?tab=sms',
        label: 'SMS Credits & Wallet',
        icon: MessageSquare,
        adminOnly: true,
      },
      {
        to: '/salon/subscription?tab=billing',
        label: 'Invoices & Payments',
        icon: Receipt,
        adminOnly: true,
      },
    ],
  },
  {
    to: '/salon/website',
    label: 'Website Builder',
    icon: Globe,
    feature: 'WEBSITE',
    module: 'WEBSITE',
    adminOnly: true,
  },
  {
    to: '/salon/settings',
    label: 'Settings',
    icon: Settings,
    adminOnly: true,
  },
];

function SidebarLink({
  to,
  label,
  icon: Icon,
  onNavigate,
  access = 'allowed',
  collapsed = false,
  disabled = false,
  badge,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
  access?: NavAccessState;
  collapsed?: boolean;
  disabled?: boolean;
  badge?: string;
}) {
  const location = useLocation();

  if (access === 'disabled' || disabled) {
    return (
      <div
        className="salon-sidebar-link salon-sidebar-link-disabled cursor-not-allowed select-none"
        title={disabled ? `${label} (Coming soon in Phase 2)` : `${label} (No access)`}
        aria-disabled="true"
      >
        <Icon className="salon-sidebar-link-icon opacity-40" strokeWidth={2} />
        {!collapsed && (
          <span className="salon-sidebar-link-label flex flex-1 items-center justify-between text-slate-400">
            <span>{label}</span>
            {badge && (
              <span className="text-[10px] font-semibold tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {badge}
              </span>
            )}
          </span>
        )}
      </div>
    );
  }

  const currentUrl = location.pathname + location.search;
  const isQueryLink = to.includes('?');
  const isActive = isQueryLink
    ? currentUrl === to ||
      (to === '/salon/reports?tab=sales' && location.pathname === '/salon/reports' && !location.search) ||
      (to === '/salon/subscription?tab=plans' && location.pathname === '/salon/subscription' && (!location.search || location.search === '?tab=plans')) ||
      (to === '/salon/rentals/reports?tab=history' && location.pathname === '/salon/rentals/reports' && location.search.includes('tab=history')) ||
      (to === '/salon/rentals/bookings?status=RESERVED' && location.pathname === '/salon/rentals/bookings' && location.search.includes('status=RESERVED'))
    : location.pathname === to
      ? to === '/salon/rentals/bookings'
        ? !location.search.includes('status=')
        : to === '/salon/rentals/reports'
          ? !location.search.includes('tab=history')
          : true
      : to !== '/salon/dashboard' && location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={label}
      aria-label={label}
      className={() => cn('salon-sidebar-link', isActive && 'active')}
    >
      <Icon className="salon-sidebar-link-icon" strokeWidth={2} />
      {!collapsed && <span className="salon-sidebar-link-label">{label}</span>}
    </NavLink>
  );
}

function itemAccess(
  item: Pick<NavLinkItem, 'feature' | 'module' | 'adminOnly'>,
  enabledFeatures: string[],
  roles: string[],
  permissions: string[],
): NavAccessState {
  return resolveNavAccess({
    feature: item.feature,
    module: item.module,
    adminOnly: item.adminOnly,
    enabledFeatures,
    roles,
    permissions,
  });
}

function NavItems({
  enabledFeatures,
  roles,
  permissions,
  onNavigate,
  collapsed = false,
  onExpandSidebar,
}: {
  enabledFeatures: string[];
  roles: string[];
  permissions: string[];
  onNavigate?: () => void;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}) {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    const activeGroup = navGroups.find(
      (group) => group.label && group.children?.some(
        (item) => {
          const itemPath = item.to.split('?')[0];
          return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
        },
      ),
    );
    if (activeGroup?.label) {
      setExpandedGroups((current) =>
        current.includes(activeGroup.label!) ? current : [...current, activeGroup.label!],
      );
    }
  }, [location.pathname]);

  return (
    <nav className="salon-sidebar">
      {navGroups.map((group) => {
        if (group.to && group.icon) {
          const access = itemAccess(group, enabledFeatures, roles, permissions);
          if (access === 'hidden') return null;
          return (
            <SidebarLink
              key={group.to}
              to={group.to}
              label={group.label ?? ''}
              icon={group.icon}
              onNavigate={onNavigate}
              access={access}
              collapsed={collapsed}
            />
          );
        }

        const childrenWithAccess = (group.children ?? [])
          .map((c) => ({
            item: c,
            access: itemAccess(c, enabledFeatures, roles, permissions),
          }))
          .filter((entry) => entry.access !== 'hidden');

        if (childrenWithAccess.length === 0) return null;

        const GroupIcon = group.icon ?? LayoutDashboard;
        const isChildActive = childrenWithAccess.some(
          (entry) =>
            entry.access === 'allowed' &&
            location.pathname.startsWith(entry.item.to.split('?')[0]),
        );
        const canCollapse = childrenWithAccess.length > 1;
        const isExpanded = !collapsed && (
          !canCollapse || expandedGroups.includes(group.label ?? '')
        );

        if (!canCollapse) {
          const [{ item, access }] = childrenWithAccess;
          return (
            <SidebarLink
              key={group.label}
              to={item.to}
              label={group.label ?? item.label}
              icon={GroupIcon}
              onNavigate={onNavigate}
              access={access}
              collapsed={collapsed}
              disabled={item.disabled}
              badge={item.badge}
            />
          );
        }

        return (
          <div key={group.label} title={collapsed ? group.label : undefined}>
            <button
              type="button"
              className={cn('salon-sidebar-section', isChildActive && 'active')}
              aria-expanded={isExpanded}
              onClick={() => {
                const label = group.label ?? '';
                if (collapsed) {
                  onExpandSidebar?.();
                  setExpandedGroups((current) =>
                    current.includes(label) ? current : [...current, label],
                  );
                  return;
                }
                setExpandedGroups((current) =>
                  current.includes(label)
                    ? current.filter((entry) => entry !== label)
                    : [...current, label],
                );
              }}
            >
              <GroupIcon className="salon-sidebar-section-icon" strokeWidth={2.25} />
              <span>{group.label}</span>
              <ChevronDown
                className={cn('salon-sidebar-chevron', isExpanded && 'expanded')}
                aria-hidden="true"
              />
            </button>
            {isExpanded && (
              <div className="salon-sidebar-children">
                {childrenWithAccess.map(({ item, access }) => (
                  <SidebarLink
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    onNavigate={onNavigate}
                    access={access}
                    collapsed={collapsed}
                    disabled={item.disabled}
                    badge={item.badge}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SalonAdminHeader({
  salonName,
  salonLogoUrl,
  onLogout,
  enabledFeatures: _enabledFeatures,
  roles,
  permissions: _permissions,
  collapsed = false,
  onToggleCollapse,
  onOpenMobileDrawer,
}: {
  salonName: string;
  salonLogoUrl: string | null;
  onLogout: () => void;
  enabledFeatures: string[];
  roles: string[];
  permissions: string[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenMobileDrawer?: () => void;
}) {
  const { title } = usePageTitle();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { branchId, branches } = useSalonBranch();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentBranch = branches.find((b: { id: string; name: string }) => b.id === branchId);
  const branchName = branchId === 'all' || !currentBranch ? 'All Branches' : currentBranch.name;
  const isSubPage = location.pathname !== '/salon/dashboard' && location.pathname !== '/salon/more';

  const roleLabel = primaryRoleLabel(roles);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const headerActions = (
    <>
      <HeaderSubscriptionPill />
      <NotificationBell />

      <div className="relative" ref={profileRef}>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:h-auto sm:w-auto sm:gap-2 sm:pl-1 sm:pr-2"
          onClick={() => setProfileOpen((v) => !v)}
        >
          <div className="salon-brand-avatar flex h-8 w-8 items-center justify-center rounded-full">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden min-w-0 flex-col items-start text-left sm:flex">
            <span className="max-w-[140px] truncate text-sm font-medium leading-tight">
              {user?.name ?? 'Profile'}
            </span>
            {roleLabel && (
              <span className="max-w-[140px] truncate text-[11px] font-normal text-muted-foreground leading-tight">
                {roleLabel}
              </span>
            )}
          </span>
        </Button>

        {profileOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              {roleLabel && (
                <p className="salon-brand-text truncate text-xs font-medium">{roleLabel}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                setProfileOpen(false);
                navigate('/salon/settings');
              }}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
              onClick={() => {
                setProfileOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <header className="salon-app-header flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 md:h-16 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        {/* Mobile header with Back, Menu, and Branch context */}
        <div className="flex min-w-0 flex-1 items-center justify-between md:hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenMobileDrawer}
              className="w-9 h-9 rounded-xl border border-slate-200/80 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {isSubPage && (
              <button
                type="button"
                onClick={() => {
                  const event = new CustomEvent('app:back', { cancelable: true });
                  const notPrevented = window.dispatchEvent(event);
                  if (notPrevented) {
                    navigate(-1);
                  }
                }}
                className="w-9 h-9 rounded-xl border border-slate-200/80 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="Back"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Centered Brand: Salon Logo + Name + All Branches ⌵ dropdown */}
          <div className="flex flex-col items-center justify-center min-w-0 px-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <SalonLogo logoUrl={salonLogoUrl} size="sm" />
              <span className="font-bold text-sm text-slate-900 leading-tight truncate">{salonName}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-0.5 leading-none mt-0.5">
              <span className="truncate max-w-[120px]">{branchName}</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* Spacer to balance left button */}
          <div className="w-9 shrink-0" />
        </div>

        {/* Desktop: left side of top header */}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          {collapsed && onToggleCollapse && (
            <button
              type="button"
              className="salon-header-expand-btn"
              title="Expand sidebar"
              aria-label="Expand sidebar"
              onClick={onToggleCollapse}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          {title ? (
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 truncate select-none">
              {title}
            </h1>
          ) : null}
        </div>
      </div>

      <div className="salon-header-actions flex shrink-0 items-center gap-1 md:gap-2">
        {headerActions}
      </div>
    </header>
  );
}

function SalonAdminLayoutInner() {
  const { user, logout } = useAuth();
  const { palette } = useTenantTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [compactDesktop, setCompactDesktop] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine) and (max-width: 1279px)').matches,
  );
  const [compactSidebarExpanded, setCompactSidebarExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('salon_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine) and (max-width: 1279px)');
    const onChange = () => {
      setCompactDesktop(media.matches);
      if (!media.matches) setCompactSidebarExpanded(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const sidebarCollapsed = collapsed || (compactDesktop && !compactSidebarExpanded);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem('salon_sidebar_collapsed', String(next));
      } catch {
        // Keep the in-memory preference if storage is unavailable.
      }
      return next;
    });
  };

  const expandSidebar = () => {
    if (compactDesktop) setCompactSidebarExpanded(true);
    setCollapsed(false);
    try {
      localStorage.setItem('salon_sidebar_collapsed', 'false');
    } catch {
      // Keep the in-memory preference if storage is unavailable.
    }
  };

  const { data: features = [] } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantApi.features,
  });

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: tenantApi.settings.get,
    staleTime: 60_000,
  });

  const salonName = settings?.salon.name ?? 'Salon Admin';
  const salonLogoUrl = settings?.salon.logoUrl ?? null;
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const roleLabel = primaryRoleLabel(roles);

  const handleLogout = async () => {
    await logout();
    navigate('/salon/login');
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          'salon-sidebar-aside h-dvh shrink-0 flex-col border-r border-border',
          compactDesktop ? 'flex' : 'hidden md:flex',
          sidebarCollapsed ? 'is-collapsed w-[72px]' : 'w-[260px]',
        )}
      >
        <div
          className={cn(
            'salon-sidebar-brand flex h-16 shrink-0 items-center border-b border-border',
            sidebarCollapsed ? 'flex-col justify-center gap-0 px-2' : 'justify-between px-4',
          )}
        >
          <SalonBrand salonName={salonName} logoUrl={salonLogoUrl} collapsed={sidebarCollapsed} />
          {!sidebarCollapsed && (
            <button
              type="button"
              className="salon-collapse-btn"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              onClick={toggleCollapsed}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="salon-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          <NavItems
            enabledFeatures={features}
            roles={roles}
            permissions={permissions}
            collapsed={sidebarCollapsed}
            onExpandSidebar={expandSidebar}
          />
        </div>
        <div className="salon-sidebar-footer shrink-0 p-2 sm:p-3">
          <Separator className="salon-sidebar-separator mb-4" />
          {!sidebarCollapsed && (
            <div className="mb-3 px-3">
              {roleLabel && (
                <div className="salon-sidebar-user-role truncate text-xs font-medium">{roleLabel}</div>
              )}
              <div className="salon-sidebar-user-email truncate text-xs">{user?.email}</div>
            </div>
          )}
          {sidebarCollapsed ? (
            <Button
              variant="outline"
              size="icon"
              className="salon-sidebar-logout is-icon mx-auto h-10 w-10"
              title={`Logout (${user?.email})`}
              aria-label="Logout"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              className="salon-sidebar-logout w-full justify-start gap-2"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SalonAdminHeader
          salonName={salonName}
          salonLogoUrl={salonLogoUrl}
          onLogout={() => void handleLogout()}
          enabledFeatures={features}
          roles={roles}
          permissions={permissions}
          collapsed={sidebarCollapsed}
          onToggleCollapse={expandSidebar}
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
        />
        <DemoBanner />
        <LowBalanceWarningBanner />

        <main
          ref={mainRef}
          className={cn(
            'salon-admin-main min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc]',
            compactDesktop
              ? 'p-3 pb-6 sm:p-4 md:p-6'
              : 'p-3 pb-24 sm:p-4 sm:pb-28 md:p-6 md:pb-6',
          )}
        >
          <SalonPermissionGate>
            <div className="admin-page-content">
              <Outlet />
            </div>
          </SalonPermissionGate>
        </main>

        {/* Mobile App Bottom Dock - Floating Pill with Curved Circle Active Indicator */}
        <nav
          className={cn(
            'fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 max-w-lg mx-auto z-40 bg-white/95 backdrop-blur-md rounded-[32px] sm:rounded-full border border-slate-200/80 px-2 sm:px-4 py-2 sm:py-2.5 flex items-center justify-around shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
            compactDesktop ? 'hidden' : 'md:hidden',
          )}
          aria-label="Mobile Navigation"
        >
          {[
            { to: '/salon/dashboard', label: 'Home', icon: Home, module: 'POS' },
            { to: '/salon/pos', label: 'POS', icon: Printer, feature: 'POS', module: 'POS' },
            { to: '/salon/appointments', label: 'Bookings', icon: Calendar, feature: 'APPOINTMENTS', module: 'APPOINTMENTS' },
            { to: '/salon/sales', label: 'Sales', icon: Receipt, module: 'POS' },
            { to: '/salon/more', label: 'More', icon: Grid2X2 },
          ]
            .filter(({ to, feature, module }) => {
              if (to === '/salon/more' || to === '/salon/dashboard') return true;
              const access = resolveNavAccess({
                feature,
                module,
                enabledFeatures: features,
                roles,
                permissions,
              });
              return access !== 'hidden';
            })
            .map(({ to, label, icon: NavIcon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center justify-center flex-1 transition-all group select-none"
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? 'scale-105'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: palette.primary,
                            color: palette.foreground,
                            boxShadow: `0 4px 14px ${palette.primary}55`,
                          }
                        : undefined
                    }
                  >
                    <NavIcon
                      className={`w-5 h-5 transition-transform ${
                        isActive ? 'stroke-[2.2]' : 'text-slate-500 stroke-[1.8]'
                      }`}
                      style={isActive ? { color: palette.foreground } : undefined}
                    />
                  </div>
                  <span
                    className={`text-[10px] sm:text-[11px] mt-1 transition-colors leading-tight text-center ${
                      isActive ? 'font-bold' : 'text-slate-500 font-medium'
                    }`}
                    style={isActive ? { color: palette.primary } : undefined}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Mobile Slide-Over Navigation Drawer */}
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0 flex flex-col h-full bg-white z-[100]">
            <SheetHeader className="h-16 shrink-0 flex flex-row items-center justify-between border-b border-border px-4 py-0 space-y-0 text-left">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SalonBrand salonName={salonName} logoUrl={salonLogoUrl} collapsed={false} />
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
              <NavItems
                enabledFeatures={features}
                roles={roles}
                permissions={permissions}
                collapsed={false}
                onNavigate={() => setMobileDrawerOpen(false)}
              />
            </div>
            <div className="shrink-0 p-3 border-t border-border bg-slate-50/50">
              {roleLabel && (
                <div className="truncate text-xs font-semibold text-slate-700">{roleLabel}</div>
              )}
              <div className="truncate text-xs text-muted-foreground mb-3">{user?.email}</div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  void handleLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export default function SalonAdminLayout() {
  return (
    <TenantThemeProvider>
      <SalonBranchProvider>
        <PageTitleProvider>
          <SalonAdminLayoutInner />
        </PageTitleProvider>
      </SalonBranchProvider>
    </TenantThemeProvider>
  );
}
