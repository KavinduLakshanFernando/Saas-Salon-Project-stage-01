import api from '@/api/axios';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

function unwrapPaginatedList<T>(payload: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

// --- Branches ---
export interface Branch {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isMain: boolean;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- Employees ---
export interface Employee {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  designation: string | null;
  photoUrl?: string | null;
  branchId: string;
  branchName: string;
  userId: string | null;
  systemRoles: string[];
  status: string;
  basicSalary?: number;
  commissionRate?: number;
  epfEnabled?: boolean;
  etfEnabled?: boolean;
  maxAdvancePercentage?: number;
}

export interface AssignableEmployeeRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Array<{ code: string; name: string }>;
}

export interface EmployeePerformance {
  id: string;
  name: string;
  code: string;
  designation: string | null;
  photoUrl: string | null;
  branchId: string;
  branchName: string;
  status: string;
  systemRoles: string[];
  servicesDone: number;
  salesGenerated: number;
  customersServed: number;
  topService: {
    name: string;
    count: number;
  } | null;
}

export interface EmployeePerformanceDetail {
  employee: {
    id: string;
    name: string;
    code: string;
    designation: string | null;
    photoUrl: string | null;
    branchId: string;
    branchName: string;
    status: string;
    systemRoles: string[];
  };
  range: {
    from: string;
    to: string;
    preset: string;
  };
  kpis: {
    salesGenerated: number;
    servicesDone: number;
    customersServed: number;
    averageRevenuePerService: number;
  };
  topService: {
    name: string;
    count: number;
    revenue: number;
  } | null;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    count: number;
    revenue: number;
  }>;
  dailyTrend: Array<{
    date: string;
    sales: number;
    services: number;
  }>;
  recentCompletedServices: Array<{
    saleId: string;
    invoiceNumber: string;
    completedAt: string;
    customerName: string;
    serviceName: string;
    quantity: number;
    price: number;
    netAmount: number;
  }>;
}

// --- Customers ---
export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface CustomerLoyaltyItem {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  visitCount: number;
  servicesTaken: number;
  totalSpend: number;
  lastVisit: string | null;
  favouriteService: {
    name: string;
    count: number;
  } | null;
}

export interface TopCustomersSummary {
  topByVisits: {
    customer: CustomerLoyaltyItem | null;
    metric: number;
  };
  topByServices: {
    customer: CustomerLoyaltyItem | null;
    metric: number;
  };
  topBySpending: {
    customer: CustomerLoyaltyItem | null;
    metric: number;
  };
}

export interface CustomerDetailAnalytics {
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    birthday: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
  };
  range: {
    from: string | null;
    to: string | null;
    preset: string;
  };
  kpis: {
    totalVisits: number;
    totalServicesTaken: number;
    totalSpend: number;
    averageSpendPerVisit: number;
    lastVisit: string | null;
  };
  favouriteService: {
    id: string;
    name: string;
    count: number;
    revenue: number;
  } | null;
  favouriteEmployee: {
    id: string;
    name: string;
    count: number;
  } | null;
  favouriteServices?: Array<{
    serviceName: string;
    count: number;
    revenue: number;
  }>;
  topServices?: Array<{
    serviceId?: string;
    serviceName: string;
    count: number;
    revenue: number;
  }>;
  recentVisits: Array<{
    saleId: string;
    invoiceNumber?: string;
    saleNumber?: string;
    completedAt?: string;
    date?: string;
    branchName?: string;
    itemCount?: number;
    total: number;
  }>;
}

export interface CustomerBookingHistoryItem {
  id: string;
  code: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  branchName: string;
  employeeName: string | null;
  totalPrice: number;
  services: Array<{
    id: string;
    name: string;
    price: number;
    durationMinutes: number | null;
  }>;
}

// --- Appointments ---
export interface AppointmentServiceItem {
  id: string;
  name: string;
  price: number;
  durationMinutes: number | null;
}

export interface Appointment {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  branchId: string;
  branchName: string;
  employeeId: string | null;
  employeeName: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes: string | null;
  services: AppointmentServiceItem[];
  totalPrice: number;
  totalDuration: number | null;
  createdAt: string;
}

export interface AppointmentCalendarDay {
  date: string;
  appointments: Appointment[];
}

// --- Services ---
export interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  isActive?: boolean;
  branchIds?: string[];
  branches?: Array<{ id: string; name: string; code?: string }>;
  servicesCount?: number;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIsActive?: boolean;
  status: string;
}

// --- Products ---
export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  isActive?: boolean;
  productsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ModuleAccessLevel = 'none' | 'view' | 'manage';

export interface TenantAccessControl {
  roleManagementEnabled?: boolean;
  enabledFeatures: Array<{
    code: string;
    name: string;
    description: string | null;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    roles: Array<{ code: string; name: string }>;
    hasCustomPermissions: boolean;
    permissionCodes: string[];
    moduleAccess: Record<string, ModuleAccessLevel>;
  }>;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem?: boolean;
    permissions: Array<{ code: string; name: string }>;
  }>;
}

export interface TenantSettings {
  salon: {
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    primaryColor?: string;
    openingBankBalance: number | null;
    lowStockThreshold?: number | null;
    status: string;
    createdAt: string;
  };
  account: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    roles: Array<{ code: string; name: string }>;
  };
  subscription: {
    id: string;
    planId: string;
    plan: string;
    planCode: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    price: number;
    currency: string;
  } | null;
  features: Array<{ code: string; name: string; description: string | null }>;
}

export interface AppearanceSettings {
  primaryColor: string;
  isDefault: boolean;
  defaultPrimaryColor: string;
}

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  notes: string | null;
  status: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  supplierPaymentId?: string | null;
  isSystemGenerated?: boolean;
}

export interface ExpensesListResponse {
  data: Expense[];
  meta: PaginationMeta;
  summary: { totalAmount: number };
}

export interface PayrollSettings {
  id: string;
  employeeEpfRate: number;
  employerEpfRate: number;
  employerEtfRate: number;
  maxSalaryAdvancePercentage?: number;
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  loanType: string;
  originalAmount: number;
  remainingBalance: number;
  monthlyInstallment: number;
  startDate: string;
  status: string;
  notes: string | null;
}

export interface EmployeeAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  basicSalary?: number;
  maxAdvancePercentage?: number;
  originalAmount: number;
  remainingBalance: number;
  monthlyInstallment: number;
  startDate: string;
  status: string;
  notes: string | null;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  payrollItemId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paidAt: string;
  payrollYear: number | null;
  payrollMonth: number | null;
}

export interface AdvanceRepayment {
  id: string;
  advanceId: string;
  payrollItemId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paidAt: string;
  payrollYear: number | null;
  payrollMonth: number | null;
}

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string | null;
  basicSalary: number;
  commissionPercentage: number;
  commissionBase: number;
  commissionAmount: number;
  bonus: number;
  grossSalary: number;
  employeeEpf: number;
  employerEpf: number;
  employerEtf: number;
  loanDeduction: number;
  advanceDeduction?: number;
  otherDeduction: number;
  totalDeductions: number;
  netSalary: number;
  epfEnabled?: boolean;
  etfEnabled?: boolean;
  commissionInvoiceCount?: number;
  commissionPeriodFrom?: string;
  commissionPeriodTo?: string;
  branchName?: string | null;
}

export interface PayrollRun {
  id: string;
  year: number;
  month: number;
  status: string;
  totalBasic: number;
  totalCommission: number;
  totalBonus: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdAt: string;
  finalizedAt: string | null;
  paidAt: string | null;
  items?: PayrollItem[];
}

export interface PayslipListItem {
  id: string;
  payrollRunId: string;
  year: number;
  month: number;
  status: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string | null;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

export interface PayslipDetail extends PayrollItem {
  year: number;
  month: number;
  status: string;
  finalizedAt: string | null;
  paidAt: string | null;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  imageUrl?: string | null;
  branchIds?: string[];
  sellingPrice: number;
  costPrice: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryIsActive?: boolean;
  stockQuantity?: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockLevel {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
}

export interface StockMovement {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  notes: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export type StockReceiptPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface StockCreditSummary {
  totalPurchases: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface StockCreditListItem {
  id: string;
  branchId: string;
  branchName: string;
  referenceNo: string | null;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: StockReceiptPaymentStatus;
  notes: string | null;
  createdAt: string;
}

export interface StockCreditPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface StockCreditDetail extends StockCreditListItem {
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>;
  payments: StockCreditPayment[];
}

export interface StockCreditsResponse extends PaginatedResponse<StockCreditListItem> {
  summary: StockCreditSummary;
}

export interface QuotationListItem {
  id: string;
  quotationNo: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  quotationDate: string;
  validUntil: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  displayStatus: string;
  salonNameSnapshot: string;
  convertedSaleId: string | null;
  createdAt: string;
}

export interface QuotationDetail extends QuotationListItem {
  taxAmount: number;
  customerNotes: string | null;
  internalNotes: string | null;
  publicToken: string;
  publicUrl: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  items: Array<{
    id: string;
    serviceId: string | null;
    descriptionSnapshot: string;
    quantity: number;
    originalServicePrice: number;
    quotationUnitPrice: number;
    discountAmount: number;
    lineTotal: number;
    employeeId: string | null;
  }>;
  messages: Array<{
    id: string;
    channel: string;
    recipient: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
    failureReason: string | null;
  }>;
  salon: {
    name: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  platformName: string;
}

export interface PublicQuotationView {
  quotationNo: string;
  quotationDate: string;
  validUntil: string | null;
  customerName: string;
  customerNotes: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  canRespond: boolean;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  salon: {
    name: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  platformAttribution: string;
}

// --- Sales ---
export interface SaleListItem {
  id: string;
  saleNumber: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone?: string | null;
  cashierId: string | null;
  cashierName: string | null;
  createdAt: string;
}

// --- Sales Analytics ---
export type SalesAnalyticsPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface SalesAnalyticsQueryParams {
  preset?: string;
  from?: string;
  to?: string;
  branchId?: string;
  employeeId?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
}

export interface SalesAnalyticsRange {
  from: string;
  to: string;
}

export interface SalesAnalyticsOverviewSummary {
  totalSales: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  employeesGeneratedSales: number;
  grossSales: number;
  refundAmount: number;
  netSales: number;
  todaySales: number;
  monthSales: number;
}

export interface SalesAnalyticsOverview {
  range: SalesAnalyticsRange;
  summary: SalesAnalyticsOverviewSummary;
}

export interface SalesAnalyticsInvoiceEmployee {
  employeeId: string;
  employeeName: string;
  assignmentType: string;
  allocationPercentage: number;
  commissionableAmount: number;
}

export interface SalesAnalyticsInvoice {
  id: string;
  saleNumber: string;
  createdAt: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoiceTotal: number;
  refundedAmount: number;
  netAmount: number;
  status: string;
  employees: SalesAnalyticsInvoiceEmployee[];
}

export interface SalesAnalyticsEmployeeRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string | null;
  branchId: string;
  branchName: string;
  commissionRate: number;
  attendedInvoiceCount: number;
  allocatedSales: number;
  commissionableSales: number;
  commissionAmount: number;
}

export interface SalesAnalyticsEmployeeDetailSummary extends SalesAnalyticsEmployeeRow {
  invoiceCount: number;
  averageInvoice: number;
}

export interface SalesAnalyticsEmployeeInvoice {
  id: string;
  saleNumber: string;
  createdAt: string;
  branchName: string;
  customerName: string | null;
  serviceName?: string;
  invoiceTotal: number;
  employeeSales: number;
  allocationPercentage: number;
  assignmentType: string;
  status: string;
}

export interface SalesAnalyticsEmployeeDetail {
  range: SalesAnalyticsRange;
  summary: SalesAnalyticsEmployeeDetailSummary;
  data: SalesAnalyticsEmployeeInvoice[];
  meta: PaginationMeta;
}

export interface SalesAnalyticsBranchRow {
  branchId: string;
  branchName: string;
  invoiceCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
}

export interface SalesAnalyticsBranchDetail {
  branch: { id: string; name: string };
  range: SalesAnalyticsRange;
  summary: SalesAnalyticsOverviewSummary;
  employees: SalesAnalyticsEmployeeRow[];
  daily: SalesAnalyticsDayRow[];
  invoices: SalesAnalyticsInvoice[];
}

export interface SalesAnalyticsDayRow {
  date: string;
  invoiceCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
}

export type SalonDashboardPeriod = 'today' | 'week' | 'month' | 'year';

export interface DashboardData {
  period: SalonDashboardPeriod;
  paymentMethodBreakdown?: {
    sales: Array<{ paymentMethod: string; amount: number }>;
    expenses: Array<{ paymentMethod: string; amount: number }>;
  };
  kpis: {
    periodRevenue: number;
    periodSalesCount: number;
    todayRevenue: number;
    todaySalesCount: number;
    monthlyRevenue: number;
    todayAppointments: number;
    periodAppointments: number;
    totalCustomers: number;
    newCustomers: number;
    servicesCompleted: number;
    lowStockCount: number;
    employeeCount: number;
    expenses?: number;
    expensesGrowth?: number;
    salaries?: number;
    salariesGrowth?: number;
    netProfit?: number;
    profitGrowth?: number;
    revenueGrowth?: number;
  };
  financials?: {
    revenue: number;
    revenueGrowth: number;
    expenses: number;
    expensesGrowth: number;
    salaries: number;
    salariesGrowth: number;
    netProfit: number;
    currentNetProfit?: number;
    currentBankBalance?: number | null;
    profitGrowth: number;
    openingBankBalance?: number | null;
    weeklyComparison: Array<{
      week: string;
      revenue: number;
      expenses: number;
      salaries: number;
    }>;
  };
  appointmentOverview?: {
    total: number;
    completed: number;
    completedPct: number;
    confirmed: number;
    confirmedPct: number;
    pending: number;
    cancelled: number;
    cancelledPct: number;
    noShow: number;
    noShowPct: number;
    trend: Array<{
      name?: string;
      date: string;
      completed: number;
      confirmed: number;
      pending: number;
      cancelled: number;
      noShow: number;
    }>;
  };
  topEmployees?: Array<{
    id: string;
    rank: number;
    name: string;
    avatarUrl: string | null;
    revenue: number;
    servicesDone: number;
    progressPct: number;
  }>;
  inventoryOverview?: {
    totalProducts: number;
    inStock: number;
    inStockPct: number;
    lowStock: number;
    lowStockPct: number;
    outOfStock: number;
    outOfStockPct: number;
    stockValue: number;
  };
  employeeLoans?: {
    activeCount: number;
    totalOutstanding: number;
    recentLoans: Array<{
      id: string;
      employeeName: string;
      avatarUrl: string | null;
      amount: number;
      remainingBalance: number;
      status: string;
    }>;
  };
  recentOrders?: Array<{
    id: string;
    saleNumber: string;
    customerName: string;
    amount: number;
    status: string;
    date: string;
  }>;
  todaySales: { total: number; count: number };
  monthlySales: { total: number; count: number };
  totalCustomers: number;
  lowStockProducts: Array<{
    branchId: string;
    productId: string;
    productName: string;
    quantity: number;
  }>;
  topServices: Array<{ id: string; name: string; saleCount: number; revenue: number }>;
  weeklySales: Array<{ date: string; saleCount: number; total: number }>;
  charts: {
    salesTrend: Array<{ name: string; revenue: number; sales: number }>;
    revenueByService: Array<{ name: string; value: number }>;
    topServices: Array<{ name: string; bookings: number; revenue: number }>;
    employeePerformance: Array<{ name: string; services: number; revenue: number }>;
    appointmentAnalytics: Array<{
      name: string;
      completed: number;
      confirmed: number;
      cancelled: number;
    }>;
    inventoryOverview: { available: number; low: number; outOfStock: number };
    customerGrowth: Array<{ name: string; count: number }>;
  };
  recentTransactions: Array<{
    id: string;
    invoiceNo?: string;
    customer?: string | null;
    service?: string | null;
    employee?: string | null;
    amount: number;
    paymentStatus?: string;
    type?: string;
    category?: string;
    status?: string;
    date: string;
  }>;
  upcomingAppointments: Array<{
    id: string;
    time: string;
    date: string;
    customer: string;
    service: string | null;
    employee: string | null;
  }>;
}

// --- Rentals ---
export interface RentalUnit {
  id: string;
  rentalItemId: string;
  branchId: string;
  branchName?: string;
  unitNumber: number;
  unitCode: string;
  status: 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'CLEANING' | 'MAINTENANCE' | 'INACTIVE';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RentalCategory = string;

export interface RentalCategoryItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentalCategoryPayload {
  name: string;
  code?: string;
  description?: string;
}

export interface UpdateRentalCategoryPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface ListRentalCategoriesParams {
  search?: string;
  status?: string;
}

export interface RentalItem {
  id: string;
  branchId: string;
  branchName?: string;
  code: string;
  name: string;
  category: RentalCategory;
  size: string | null;
  color: string | null;
  rentPrice: number;
  deposit: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string | null;
  imageUrl: string | null;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  cleaningUnits: number;
  maintenanceUnits: number;
  inactiveUnits: number;
  createdAt: string;
  updatedAt: string;
  units?: RentalUnit[];
}

export interface CreateRentalItemPayload {
  name: string;
  category: string;
  code?: string;
  size?: string;
  color?: string;
  rentPrice: number;
  deposit?: number;
  quantity: number;
  branchId: string;
  notes?: string;
  imageUrl?: string;
}

export interface UpdateRentalItemPayload {
  name?: string;
  category?: string;
  size?: string;
  color?: string;
  rentPrice?: number;
  deposit?: number;
  branchId?: string;
  notes?: string;
  imageUrl?: string;
}

export interface AddRentalUnitsPayload {
  quantity: number;
  branchId?: string;
  notes?: string;
}

export interface UpdateRentalUnitPayload {
  status?: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE' | 'INACTIVE';
  notes?: string;
  branchId?: string;
}

export type RentalBookingStatus =
  | 'RESERVED'
  | 'PICKED_UP'
  | 'PARTIALLY_RETURNED'
  | 'RETURNED'
  | 'CANCELLED';

export interface RentalBookingItem {
  id: string;
  bookingId?: string;
  rentalItemId: string;
  itemName: string;
  itemCode: string;
  itemCategory?: string;
  rentalUnitId: string;
  unitCode: string;
  unitNumber?: number;
  rentPrice: number;
  deposit: number;
  notes?: string | null;
  handedOverAt?: string | null;
  conditionOut?: string | null;
  createdAt?: string;
}

export type RentalPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
export type RentalAllocationType = 'RENT' | 'SECURITY_DEPOSIT' | 'DAMAGE_CHARGE' | 'REFUND';

export interface RentalBookingFinancials {
  totalRent: number;
  paidRent: number;
  remainingRent: number;
  totalDeposit: number;
  heldDeposit: number;
  remainingDeposit: number;
  grandTotal: number;
  totalPaid: number;
  totalBalance: number;
  isFullyPaid: boolean;
  isRentFullyPaid: boolean;
  isDepositFullyPaid: boolean;
}

export interface RentalPaymentAllocation {
  id: string;
  paymentId: string;
  bookingId: string;
  allocationType: RentalAllocationType;
  amount: number;
  notes?: string | null;
  createdAt: string;
}

export interface RentalPayment {
  id: string;
  branchId: string;
  branchName?: string;
  bookingId: string;
  bookingReference?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerCode?: string;
  paymentNumber: string;
  idempotencyKey?: string | null;
  amount: number;
  paymentMethod: RentalPaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  receivedBy?: string | null;
  receiverName?: string | null;
  rentAmount: number;
  depositAmount: number;
  bookingTotalRent?: number;
  bookingTotalDeposit?: number;
  allocations?: RentalPaymentAllocation[];
  booking?: {
    id: string;
    reference: string;
    pickupDate: string;
    returnDate: string;
    status: RentalBookingStatus;
    totalRent: number;
    totalDeposit: number;
    financials?: RentalBookingFinancials;
    items?: Array<{
      id: string;
      itemName: string;
      itemCode: string;
      category?: string;
      unitCode: string;
      rentPrice: number;
      deposit: number;
    }>;
  };
  branch?: {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentalPaymentPayload {
  bookingId: string;
  amount: number;
  paymentMethod: RentalPaymentMethod;
  rentAmount?: number;
  depositAmount?: number;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ConfirmRentalPickupPayload {
  actualPickupDate?: string;
  pickupNotes?: string;
  conditionOut?: string;
  allowPendingDeposit?: boolean;
  payment?: {
    amount: number;
    paymentMethod?: RentalPaymentMethod;
    referenceNumber?: string;
    notes?: string;
  };
}

export interface RentalPaymentsSummary {
  totalTransactions: number;
  totalAmountCollected: number;
  totalCollectedRent: number;
  totalSecurityDepositHeld: number;
}

export interface RentalBooking {
  id: string;
  branchId: string;
  branchName?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerCode?: string;
  bookingId?: string;
  bookingReference: string;
  pickupDate: string;
  returnDate: string;
  status: RentalBookingStatus;
  totalRent: number;
  totalDeposit: number;
  notes?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancellerName?: string | null;
  cancellationReason?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  actualPickupAt?: string | null;
  pickedUpByUserId?: string | null;
  pickedUpByName?: string | null;
  pickupNotes?: string | null;
  financials?: RentalBookingFinancials;
  payments?: RentalPayment[];
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items?: RentalBookingItem[];
}

export interface RentalAvailabilityUnit {
  id: string;
  unitNumber: number;
  unitCode: string;
  status: RentalUnit['status'];
  isAvailable: boolean;
  conflictReason?: string | null;
}

export interface RentalAvailabilityItem {
  id: string;
  code: string;
  name: string;
  category: RentalCategory;
  size: string | null;
  color: string | null;
  rentPrice: number;
  deposit: number;
  status: string;
  notes: string | null;
  imageUrl: string | null;
  totalCopiesCount: number;
  availableCopiesCount: number;
  units: RentalAvailabilityUnit[];
}

export interface CreateRentalBookingPayload {
  branchId: string;
  customerId: string;
  pickupDate: string;
  returnDate: string;
  unitIds: string[];
  notes?: string;
  securityDeposit?: number;
  advancePayment?: {
    rentAmount?: number;
    depositAmount?: number;
    paymentMethod?: RentalPaymentMethod;
    referenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
  };
}

export interface RentalBookingSummary {
  totalBookings: number;
  reservedBookings: number;
  pickedUpBookings?: number;
  cancelledBookings: number;
  totalRentReserved: number;
  totalDepositReserved: number;
  totalSecurityDepositHeld?: number;
  totalCollectedRent?: number;
}


export type RentalItemCondition = 'GOOD' | 'MINOR_DAMAGE' | 'DAMAGED' | 'REQUIRES_REPAIR';

export interface PendingRentalReturn {
  id: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerCode: string;
  bookingReference: string;
  pickupDate: string;
  returnDate: string;
  status: string;
  settlementStatus: string;
  totalRent: number;
  totalDeposit: number;
  totalLateFees: number;
  totalDamageCharges: number;
  actualPickupAt: string | null;
  paidRent?: number;
  heldDeposit?: number;
  remainingRent?: number;
  totalUnits: number;
  returnedUnits: number;
  outstandingUnits: number;
  isOverdue: boolean;
  overdueDays: number;
  createdAt: string;
}

export interface RentalReturnsSummary {
  totalPending: number;
  totalOverdue: number;
  totalPartiallyReturned: number;
  totalAwaitingSettlement: number;
  totalLateFees: number;
  totalDamageCharges: number;
}

export interface ProcessReturnItemPayload {
  bookingItemId: string;
  conditionIn?: RentalItemCondition;
  inspectionNotes?: string;
  lateFee?: number;
  damageCharge?: number;
  requiresMaintenance?: boolean;
}

export interface ProcessRentalReturnPayload {
  actualReturnAt?: string;
  returnNotes?: string;
  idempotencyKey?: string;
  items: ProcessReturnItemPayload[];
  collectPayment?: boolean;
  paymentAmount?: number;
  paymentMethod?: RentalPaymentMethod;
  referenceNumber?: string;
  paymentNotes?: string;
}

export interface SettleRentalDepositPayload {
  notes?: string;
  idempotencyKey?: string;
  refundMethod?: RentalPaymentMethod;
}

export interface RecordRentalRefundPayload {
  amount: number;
  paymentMethod?: RentalPaymentMethod;
  notes?: string;
  idempotencyKey?: string;
}

export interface RentalDepositSettlementSummary {
  bookingId: string;
  depositCollected: number;
  totalLateFees: number;
  totalDamageCharges: number;
  totalCharges: number;
  depositDeducted: number;
  refundableBalance: number;
  additionalAmountDue: number;
  allItemsReturned: boolean;
  totalItems: number;
  returnedItems: number;
  isSettled: boolean;
  settlement?: any;
  refunds?: any[];
}

export interface RentalReturnReceipt {
  salonName: string;
  returnNumber: string;
  actualReturnAt: string;
  returnNotes: string | null;
  bookingReference: string;
  pickupDate: string;
  expectedReturnDate: string;
  branch: {
    name: string;
    phone: string | null;
    address: string | null;
  };
  customer: {
    name: string;
    phone: string | null;
    code: string;
  };
  inspectorName: string | null;
  items: Array<{
    id: string;
    unitCode: string;
    itemName: string;
    itemCode: string;
    conditionOut: string | null;
    conditionIn: RentalItemCondition;
    inspectionNotes: string | null;
    lateFee: number;
    damageCharge: number;
  }>;
  totalLateFees: number;
  totalDamageCharges: number;
  totalCharges: number;
}

export interface RentalOverviewKPIs {
  totalBookings: number;
  activeReservations: number;
  currentlyRentedUnits: number;
  overdueRentalUnits: number;
  availableUnits: number;
  rentalRevenue: number;
  outstandingRentalPayments: number;
  securityDepositsHeld: number;
  maintenanceUnits?: number;
  cleaningUnits?: number;
}

export interface RentalUpcomingPickup {
  id: string;
  bookingReference: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerCode: string;
  pickupDate: string;
  returnDate: string;
  itemCount: number;
  totalRent: number;
  totalDeposit: number;
  rentPaid: number;
  depositPaid: number;
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
}

export interface RentalExpectedReturn {
  id: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string | null;
  pickupDate: string;
  returnDate: string;
  totalUnits: number;
  returnedUnits: number;
  outstandingUnits: number;
}

export interface RentalOverdueBooking {
  id: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string | null;
  returnDate: string;
  overdueDays: number;
  outstandingUnits: number;
  totalRent: number;
  totalDeposit: number;
}

export interface RentalRecentActivityItem {
  id: string;
  type: 'BOOKING' | 'PICKUP' | 'RETURN' | 'PAYMENT';
  title: string;
  subtitle: string;
  timestamp: string;
  referenceNumber: string;
  amount?: number | null;
}

export interface RentalHistoryItem {
  id: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerCode: string;
  bookingReference: string;
  pickupDate: string;
  returnDate: string;
  status: RentalBookingStatus;
  settlementStatus: string;
  totalRent: number;
  totalDeposit: number;
  totalLateFees: number;
  totalDamageCharges: number;
  actualPickupAt: string | null;
  rentPaid: number;
  depositPaid: number;
  totalRefunded: number;
  totalCharges: number;
  netBalance: number;
  heldDepositBalance: number;
  isFullyPaid: boolean;
  itemCount: number;
  items: Array<{
    itemName: string;
    itemCode: string;
    unitCode: string;
    unitNumber: number;
    rentPrice: number;
    deposit: number;
    returnStatus: string;
    conditionOut: string | null;
    conditionIn: string | null;
  }>;
  createdAt: string;
}

export interface CustomerRentalHistoryData {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    customerCode: string;
  };
  summary: {
    totalBookings: number;
    totalSpent: number;
    totalRefunded: number;
    activeRentalsCount: number;
  };
  bookings: Array<{
    id: string;
    bookingReference: string;
    branchName: string;
    pickupDate: string;
    returnDate: string;
    status: RentalBookingStatus;
    settlementStatus: string;
    totalRent: number;
    totalDeposit: number;
    totalLateFees: number;
    totalDamageCharges: number;
    rentPaid: number;
    depositPaid: number;
    createdAt: string;
  }>;
}

export interface UnitRentalHistoryData {
  unit: {
    id: string;
    unitCode: string;
    unitNumber: number;
    status: string;
    branchName: string;
    itemId: string;
    itemName: string;
    itemCode: string;
    category: string;
    rentPrice: number;
    deposit: number;
  };
  totalRentalsCount: number;
  history: Array<{
    bookingId: string;
    bookingReference: string;
    customerName: string;
    customerPhone: string | null;
    pickupDate: string;
    returnDate: string;
    actualPickupAt: string | null;
    returnedAt: string | null;
    conditionOut: string | null;
    conditionIn: string | null;
    inspectionNotes: string | null;
    lateFee: number;
    damageCharge: number;
    requiresMaintenance: boolean;
    bookingStatus: string;
  }>;
}

export interface RentalReportsSummary {
  totalRentals: number;
  confirmedBookings: number;
  cancelledBookings: number;
  rentalRevenue: number;
  rentalCharges: number;
  totalLateFees: number;
  totalDamageCharges: number;
  cashCollected: number;
  depositsRefunded: number;
  outstandingReceivables: number;
  currentlyRentedCount: number;
  availableItemsCount: number;
  overdueItemsCount: number;
}

export interface RentalActivityTrendItem {
  date: string;
  confirmedBookings: number;
  cancelledBookings: number;
  pickedUpCount: number;
}

export interface RentalRevenueTrendItem {
  date: string;
  rentalCharges: number;
  additionalFees: number;
  totalRevenue: number;
}

export interface RentalCategoryBreakdownItem {
  category: string;
  bookingCount: number;
  unitsRented: number;
  rentalRevenue: number;
  percentage: number;
}

export interface RentalUnitStatusItem {
  status: string;
  count: number;
  percentage: number;
}


export type CatalogSelectionType = 'ALL' | 'CATEGORY' | 'SELECTED_ITEMS';

export interface RentalCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
  rentPrice: number | null;
  deposit?: number | null;
  imageUrl: string | null;
  notes: string | null;
}

export interface PreviewRentalCatalogPayload {
  branchId?: string;
  selectionType: CatalogSelectionType;
  categoryId?: string;
  categoryName?: string;
  selectedItemIds?: string[];
}

export interface CreateRentalCatalogSharePayload {
  title: string;
  branchId?: string;
  selectionType: CatalogSelectionType;
  categoryId?: string;
  categoryName?: string;
  selectedItemIds?: string[];
  showPrices?: boolean;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  expiresInDays?: number;
}

export interface RentalCatalogShareRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  title: string;
  shareToken: string;
  selectionType: CatalogSelectionType;
  categoryId: string | null;
  categoryName: string | null;
  selectedItemIds?: string[] | null;
  showPrices: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  shareUrl: string;
}

export interface ListRentalCatalogSharesParams {
  branchId?: string;
  page?: number;
  limit?: number;
  status?: 'ALL' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export interface PublicRentalCatalogResponse {
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  message?: string;
  catalog?: {
    id: string;
    title: string;
    shareToken: string;
    selectionType: CatalogSelectionType;
    categoryName?: string | null;
    showPrices: boolean;
    notes?: string | null;
    createdAt: string;
    expiresAt?: string | null;
  };
  salon?: {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    phone?: string | null;
    email?: string | null;
    branchName?: string | null;
    branchAddress?: string | null;
  };
  items?: RentalCatalogItem[];
  categories?: string[];
  totalItems?: number;
}

export const tenantApi = {
  rentals: {
    listItems: (params?: Record<string, string | number | undefined>) =>
      api.get<PaginatedResponse<RentalItem>>('/tenant/rentals/items', { params }).then((r) => r.data),
    getItem: (id: string) =>
      api.get<RentalItem>(`/tenant/rentals/items/${id}`).then((r) => r.data),
    suggestCode: () =>
      api.get<{ code: string }>('/tenant/rentals/items/suggest-code').then((r) => r.data),
    createItem: (data: CreateRentalItemPayload) =>
      api
        .post<{ id: string; code: string; unitsCount: number; units: RentalUnit[] }>(
          '/tenant/rentals/items',
          data,
        )
        .then((r) => r.data),
    updateItem: (id: string, data: UpdateRentalItemPayload) =>
      api.patch<{ id: string; success: boolean }>(`/tenant/rentals/items/${id}`, data).then((r) => r.data),
    updateItemStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
      api
        .patch<{ id: string; status: string }>(`/tenant/rentals/items/${id}/status`, { status })
        .then((r) => r.data),
    addUnits: (id: string, data: AddRentalUnitsPayload) =>
      api
        .post<{ itemId: string; addedCount: number; units: RentalUnit[] }>(
          `/tenant/rentals/items/${id}/units`,
          data,
        )
        .then((r) => r.data),
    updateUnit: (unitId: string, data: UpdateRentalUnitPayload) =>
      api
        .patch<{ id: string; unitCode: string; status: string; success: boolean }>(
          `/tenant/rentals/units/${unitId}`,
          data,
        )
        .then((r) => r.data),
    deactivateItem: (id: string) =>
      api.delete<{ id: string; status: string }>(`/tenant/rentals/items/${id}`).then((r) => r.data),
    listCategories: (params?: ListRentalCategoriesParams) =>
      api.get<RentalCategoryItem[]>('/tenant/rentals/categories', { params }).then((r) => r.data),
    getCategory: (id: string) =>
      api.get<RentalCategoryItem>(`/tenant/rentals/categories/${id}`).then((r) => r.data),
    suggestCategoryCode: () =>
      api.get<{ code: string }>('/tenant/rentals/categories/suggest-code').then((r) => r.data),
    createCategory: (data: CreateRentalCategoryPayload) =>
      api.post<RentalCategoryItem>('/tenant/rentals/categories', data).then((r) => r.data),
    updateCategory: (id: string, data: UpdateRentalCategoryPayload) =>
      api.patch<RentalCategoryItem>(`/tenant/rentals/categories/${id}`, data).then((r) => r.data),
    deleteCategory: (id: string) =>
      api.delete<{ success: boolean; message: string }>(`/tenant/rentals/categories/${id}`).then((r) => r.data),
    listBookings: (params?: Record<string, string | number | undefined>) =>
      api
        .get<PaginatedResponse<RentalBooking>>('/tenant/rentals/bookings', { params })
        .then((r) => r.data),
    getBooking: (id: string) =>
      api.get<RentalBooking>(`/tenant/rentals/bookings/${id}`).then((r) => r.data),
    getBookingSummary: (branchId?: string) =>
      api
        .get<RentalBookingSummary>('/tenant/rentals/bookings/summary', { params: { branchId } })
        .then((r) => r.data),
    checkAvailability: (params: {
      branchId: string;
      pickupDate: string;
      returnDate: string;
      category?: string;
      search?: string;
    }) =>
      api
        .get<RentalAvailabilityItem[]>('/tenant/rentals/availability', { params })
        .then((r) => r.data),
    createBooking: (data: CreateRentalBookingPayload) =>
      api.post<RentalBooking>('/tenant/rentals/bookings', data).then((r) => r.data),
    cancelBooking: (id: string, reason?: string) =>
      api
        .post<{ id: string; bookingReference: string; status: string; success: boolean }>(
          `/tenant/rentals/bookings/${id}/cancel`,
          { reason },
        )
        .then((r) => r.data),
    listPayments: (params?: Record<string, string | number | undefined>) =>
      api
        .get<PaginatedResponse<RentalPayment>>('/tenant/rentals/payments', { params })
        .then((r) => r.data),
    getPayment: (id: string) =>
      api.get<RentalPayment>(`/tenant/rentals/payments/${id}`).then((r) => r.data),
    getPaymentsSummary: (branchId?: string) =>
      api
        .get<RentalPaymentsSummary>('/tenant/rentals/payments/summary', { params: { branchId } })
        .then((r) => r.data),
    collectPayment: (data: CreateRentalPaymentPayload) =>
      api.post<RentalPayment>('/tenant/rentals/payments', data).then((r) => r.data),
    confirmPickup: (bookingId: string, data?: ConfirmRentalPickupPayload) =>
      api
        .post<RentalBooking>(`/tenant/rentals/bookings/${bookingId}/pickup`, data ?? {})
        .then((r) => r.data),
    listReturns: (params?: Record<string, string | number | boolean | undefined>) =>
      api
        .get<PaginatedResponse<PendingRentalReturn>>('/tenant/rentals/returns', { params })
        .then((r) => r.data),
    getReturnsSummary: (branchId?: string) =>
      api
        .get<RentalReturnsSummary>('/tenant/rentals/returns/summary', { params: { branchId } })
        .then((r) => r.data),
    getReturnDetails: (bookingId: string) =>
      api.get<any>(`/tenant/rentals/bookings/${bookingId}/return-details`).then((r) => r.data),
    processReturn: (bookingId: string, data: ProcessRentalReturnPayload) =>
      api.post<any>(`/tenant/rentals/bookings/${bookingId}/returns`, data).then((r) => r.data),
    getBookingReturns: (bookingId: string) =>
      api.get<any[]>(`/tenant/rentals/bookings/${bookingId}/returns`).then((r) => r.data),
    getDepositSettlement: (bookingId: string) =>
      api
        .get<RentalDepositSettlementSummary>(`/tenant/rentals/bookings/${bookingId}/deposit-settlement`)
        .then((r) => r.data),
    settleDeposit: (bookingId: string, data: SettleRentalDepositPayload) =>
      api
        .post<any>(`/tenant/rentals/bookings/${bookingId}/deposit-settlement`, data)
        .then((r) => r.data),
    recordRefund: (bookingId: string, data: RecordRentalRefundPayload) =>
      api
        .post<any>(`/tenant/rentals/bookings/${bookingId}/refunds`, data)
        .then((r) => r.data),
    getReturnReceipt: (returnId: string) =>
      api
        .get<RentalReturnReceipt>(`/tenant/rentals/returns/${returnId}/receipt`)
        .then((r) => r.data),
    updateUnitClearance: (
      unitId: string,
      data: { status: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE'; notes?: string },
    ) =>
      api
        .patch<any>(`/tenant/rentals/units/${unitId}/clearance`, data)
        .then((r) => r.data),
    getOverview: (params?: { branchId?: string; startDate?: string; endDate?: string }) =>
      api.get<RentalOverviewKPIs>('/tenant/rentals/overview', { params }).then((r) => r.data),
    getUpcomingPickups: (params?: { branchId?: string; limit?: number }) =>
      api.get<RentalUpcomingPickup[]>('/tenant/rentals/overview/upcoming-pickups', { params }).then((r) => r.data),
    getExpectedReturns: (params?: { branchId?: string; limit?: number }) =>
      api.get<RentalExpectedReturn[]>('/tenant/rentals/overview/expected-returns', { params }).then((r) => r.data),
    getOverdueBookings: (params?: { branchId?: string; limit?: number }) =>
      api.get<RentalOverdueBooking[]>('/tenant/rentals/overview/overdue', { params }).then((r) => r.data),
    getRecentActivity: (params?: { branchId?: string; limit?: number }) =>
      api.get<RentalRecentActivityItem[]>('/tenant/rentals/overview/recent-activity', { params }).then((r) => r.data),
    getHistory: (params?: Record<string, string | number | undefined>) =>
      api.get<PaginatedResponse<RentalHistoryItem>>('/tenant/rentals/history', { params }).then((r) => r.data),
    getCustomerHistory: (customerId: string) =>
      api.get<CustomerRentalHistoryData>(`/tenant/rentals/history/customers/${customerId}`).then((r) => r.data),
    getUnitHistory: (unitId: string) =>
      api.get<UnitRentalHistoryData>(`/tenant/rentals/history/units/${unitId}`).then((r) => r.data),
    getReportsSummary: (params?: { branchId?: string; startDate?: string; endDate?: string }) =>
      api.get<RentalReportsSummary>('/tenant/rentals/reports/summary', { params }).then((r) => r.data),
    getActivityTrend: (params?: { branchId?: string; startDate?: string; endDate?: string }) =>
      api.get<RentalActivityTrendItem[]>('/tenant/rentals/reports/activity', { params }).then((r) => r.data),
    getRevenueTrend: (params?: { branchId?: string; startDate?: string; endDate?: string }) =>
      api.get<RentalRevenueTrendItem[]>('/tenant/rentals/reports/revenue', { params }).then((r) => r.data),
    getCategoryBreakdown: (params?: { branchId?: string; startDate?: string; endDate?: string }) =>
      api.get<RentalCategoryBreakdownItem[]>('/tenant/rentals/reports/categories', { params }).then((r) => r.data),
    getUnitStatusDistribution: (branchId?: string) =>
      api.get<RentalUnitStatusItem[]>('/tenant/rentals/reports/unit-status', { params: { branchId } }).then((r) => r.data),
    exportReportsCsv: (params?: { branchId?: string; startDate?: string; endDate?: string; reportType?: string }) =>
      api.get<string>('/tenant/rentals/reports/export', { params, responseType: 'text' as any }).then((r) => r.data),
    catalogs: {
      preview: (data: PreviewRentalCatalogPayload) =>
        api
          .post<{ items: RentalCatalogItem[]; total: number }>(
            '/tenant/rentals/catalogs/preview',
            data,
          )
          .then((r) => r.data),
      create: (data: CreateRentalCatalogSharePayload) =>
        api.post<RentalCatalogShareRecord>('/tenant/rentals/catalogs', data).then((r) => r.data),
      list: (params?: ListRentalCatalogSharesParams) =>
        api
          .get<PaginatedResponse<RentalCatalogShareRecord>>('/tenant/rentals/catalogs', { params })
          .then((r) => r.data),
      revoke: (id: string) =>
        api
          .delete<{ message: string; share: RentalCatalogShareRecord }>(
            `/tenant/rentals/catalogs/${id}`,
          )
          .then((r) => r.data),
    },

  },
  demo: {
    reset: () =>
      api
        .post<{ success: boolean; message: string; lastDemoResetAt: string }>('/tenant/demo/reset')
        .then((r) => r.data),
  },

  features: Object.assign(
    () => api.get<string[]>('/tenant/features').then((r) => r.data),
    {
      listEnabled: () => api.get<string[]>('/tenant/features').then((r) => r.data),
    },
  ),

  branches: {
    list: () => api.get<Branch[]>('/tenant/branches').then((r) => r.data),
    suggestCode: (name?: string) =>
      api.get<{ code: string }>('/tenant/branches/suggest-code', { params: { name } }).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<Branch>('/tenant/branches', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<Branch>(`/tenant/branches/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch<Branch>(`/tenant/branches/${id}/status`, { status }).then((r) => r.data),
  },

  employees: {
    list: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<Employee> | Employee[]>('/tenant/employees', { params })
        .then((r) => unwrapPaginatedList(r.data)),
    performance: (params?: Record<string, string | number | undefined>) =>
      api
        .get<PaginatedResponse<EmployeePerformance>>('/tenant/employees/performance', { params })
        .then((r) => r.data),
    performanceDetail: (id: string, params?: Record<string, string | undefined>) =>
      api
        .get<EmployeePerformanceDetail>(`/tenant/employees/${id}/performance`, { params })
        .then((r) => r.data),
    assignableRoles: () =>
      api
        .get<AssignableEmployeeRole[]>('/tenant/employees/assignable-roles')
        .then((r) => r.data),
    get: (id: string) => api.get<Employee>(`/tenant/employees/${id}`).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<Employee>('/tenant/employees', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<Employee>(`/tenant/employees/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch<Employee>(`/tenant/employees/${id}/status`, { status }).then((r) => r.data),
    uploadPhoto: (file: File, employeeId?: string) => {
      const formData = new FormData();
      formData.append('image', file);
      const path = employeeId
        ? `/tenant/employees/${employeeId}/upload-photo`
        : '/tenant/employees/upload-photo';
      return api
        .post<{ photoUrl: string }>(path, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    delete: (id: string) =>
      api.delete<{ id: string; success: boolean }>(`/tenant/employees/${id}`).then((r) => r.data),
  },

  appointments: {
    list: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<Appointment> | Appointment[]>('/tenant/appointments', { params })
        .then((r) => unwrapPaginatedList(r.data)),
    listPaginated: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<Appointment>>('/tenant/appointments', { params })
        .then((r) => r.data),
    getById: (id: string) =>
      api.get<Appointment>(`/tenant/appointments/${id}`).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<Appointment>('/tenant/appointments', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<Appointment>(`/tenant/appointments/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch<Appointment>(`/tenant/appointments/${id}/status`, { status }).then((r) => r.data),
    cancel: (id: string) =>
      api.delete<Appointment>(`/tenant/appointments/${id}`).then((r) => r.data),
    calendar: (params?: Record<string, string>) =>
      api
        .get<AppointmentCalendarDay[]>('/tenant/appointments/calendar', { params })
        .then((r) => r.data),
  },

  customers: {
    list: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<Customer> | Customer[]>('/tenant/customers', { params })
        .then((r) => unwrapPaginatedList(r.data)),
    search: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<Customer> | Customer[]>('/tenant/customers/search', { params })
        .then((r) => unwrapPaginatedList(r.data)),
    analytics: (params?: Record<string, string | number | undefined>) =>
      api
        .get<PaginatedResponse<CustomerLoyaltyItem>>('/tenant/customers/analytics', { params })
        .then((r) => r.data),
    top: (params?: Record<string, string | undefined>) =>
      api
        .get<TopCustomersSummary>('/tenant/customers/top', { params })
        .then((r) => r.data),
    detailAnalytics: (id: string, params?: Record<string, string | undefined>) =>
      api
        .get<CustomerDetailAnalytics>(`/tenant/customers/${id}/analytics`, { params })
        .then((r) => r.data),
    get: (id: string) => api.get<Customer>(`/tenant/customers/${id}`).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<Customer>('/tenant/customers', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<Customer>(`/tenant/customers/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch<Customer>(`/tenant/customers/${id}/status`, { status }).then((r) => r.data),
    delete: (id: string) =>
      api.delete<{ id: string; success: boolean }>(`/tenant/customers/${id}`).then((r) => r.data),
    bookingHistory: (id: string) =>
      api
        .get<CustomerBookingHistoryItem[]>(`/tenant/customers/${id}/booking-history`)
        .then((r) => r.data),
  },

  serviceCategories: {
    list: (params?: Record<string, string | number | boolean | undefined>) =>
      api
        .get<PaginatedResponse<ServiceCategory> | ServiceCategory[]>('/tenant/service-categories', {
          params,
        })
        .then((r) => unwrapPaginatedList(r.data)),
    create: (data: Record<string, unknown>) =>
      api.post('/tenant/service-categories', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch(`/tenant/service-categories/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch(`/tenant/service-categories/${id}/status`, { status }).then((r) => r.data),
    delete: (id: string) =>
      api.delete(`/tenant/service-categories/${id}`).then((r) => r.data),
  },

  services: {
    list: (params?: Record<string, string | number | boolean | undefined> | string): Promise<Service[]> => {
      const queryParams = typeof params === 'string' ? { categoryId: params } : params;
      return api
        .get<PaginatedResponse<Service> | Service[]>('/tenant/services', { params: queryParams })
        .then((r) => unwrapPaginatedList(r.data));
    },
    listPaginated: (params?: Record<string, string | number | boolean | undefined>) =>
      api
        .get<PaginatedResponse<Service> | Service[]>('/tenant/services', { params })
        .then((r) => {
          const payload = r.data;
          if (!Array.isArray(payload) && payload?.meta) return payload;
          const rows = unwrapPaginatedList(payload);
          return {
            data: rows,
            meta: {
              page: 1,
              limit: rows.length || 1,
              total: rows.length,
              totalPages: rows.length ? 1 : 0,
            },
          };
        }),
    create: (data: Record<string, unknown>) =>
      api.post('/tenant/services', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch(`/tenant/services/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch(`/tenant/services/${id}/status`, { status }).then((r) => r.data),
    delete: (id: string) =>
      api.delete(`/tenant/services/${id}`).then((r) => r.data),
  },

  productCategories: {
    list: (params?: Record<string, string | number | boolean | undefined>) =>
      api
        .get<PaginatedResponse<ProductCategory> | ProductCategory[]>('/tenant/product-categories', {
          params,
        })
        .then((r) => unwrapPaginatedList(r.data)),
    create: (data: Record<string, unknown>) =>
      api.post('/tenant/product-categories', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch(`/tenant/product-categories/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch(`/tenant/product-categories/${id}/status`, { status }).then((r) => r.data),
    delete: (id: string) =>
      api.delete(`/tenant/product-categories/${id}`).then((r) => r.data),
  },

  products: {
    list: (params?: Record<string, string | number | boolean | undefined> | string) => {
      const queryParams = typeof params === 'string' ? { categoryId: params } : params;
      return api
        .get<PaginatedResponse<Product> | Product[]>('/tenant/products', { params: queryParams })
        .then((r) => unwrapPaginatedList(r.data));
    },
    uploadImage: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return api
        .post<{ imageUrl: string }>('/tenant/products/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    create: (data: Record<string, unknown>) =>
      api.post('/tenant/products', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch(`/tenant/products/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch(`/tenant/products/${id}/status`, { status }).then((r) => r.data),
    delete: (id: string) =>
      api.delete(`/tenant/products/${id}`).then((r) => r.data),
  },

  stock: {
    list: (branchId?: string) =>
      api.get<StockLevel[]>('/tenant/stock', { params: { branchId } }).then((r) => r.data),
    stockIn: (data: Record<string, unknown>) =>
      api.post('/tenant/stock/in', data).then((r) => r.data),
    adjustment: (data: Record<string, unknown>) =>
      api.post('/tenant/stock/adjustment', data).then((r) => r.data),
    movements: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<StockMovement> | StockMovement[]>('/tenant/stock/movements', {
          params,
        })
        .then((r) => unwrapPaginatedList(r.data)),
    credits: (params?: Record<string, string | number | undefined>) =>
      api.get<StockCreditsResponse>('/tenant/stock/credits', { params }).then((r) => r.data),
    credit: (id: string) =>
      api.get<StockCreditDetail>(`/tenant/stock/credits/${id}`).then((r) => r.data),
    payCredit: (id: string, data: Record<string, unknown>) =>
      api.post(`/tenant/stock/credits/${id}/payments`, data).then((r) => r.data),
  },

  quotations: {
    list: (params?: Record<string, string | number | undefined>) =>
      api
        .get<PaginatedResponse<QuotationListItem>>('/tenant/quotations', { params })
        .then((r) => r.data),
    get: (id: string) =>
      api.get<QuotationDetail>(`/tenant/quotations/${id}`).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post('/tenant/quotations', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch(`/tenant/quotations/${id}`, data).then((r) => r.data),
    cancel: (id: string, data?: { reason?: string; notifyCustomer?: boolean }) =>
      api.post(`/tenant/quotations/${id}/cancel`, data).then((r) => r.data),
    whatsapp: (id: string) =>
      api.post<{ externalUrl: string; salonName: string }>(`/tenant/quotations/${id}/whatsapp`).then((r) => r.data),
    sms: (id: string) => api.post(`/tenant/quotations/${id}/sms`).then((r) => r.data),
    convert: (id: string, data: Record<string, unknown>) =>
      api.post(`/tenant/quotations/${id}/convert`, data).then((r) => r.data),
    printUrl: (id: string) => `${api.defaults.baseURL}/tenant/quotations/${id}/print`,
  },

  publicQuotations: {
    get: (token: string) =>
      api.get<PublicQuotationView>(`/public/quotations/${token}`).then((r) => r.data),
    accept: (token: string) =>
      api.post(`/public/quotations/${token}/accept`).then((r) => r.data),
    decline: (token: string, reason?: string) =>
      api.post(`/public/quotations/${token}/decline`, { reason }).then((r) => r.data),
  },

  pos: {
    getPerformers: (params?: { branchId?: string }) =>
      api
        .get<{ performers: Employee[]; autoProvisioned: boolean }>('/tenant/pos/performers', {
          params,
        })
        .then((r) => r.data),
    createSale: (data: Record<string, unknown>) =>
      api.post('/tenant/pos/sales', data).then((r) => r.data),
  },

  sales: {
    list: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<SaleListItem> | SaleListItem[]>('/tenant/sales', { params })
        .then((r) => unwrapPaginatedList(r.data)),
    listPaginated: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<SaleListItem> | SaleListItem[]>('/tenant/sales', { params })
        .then((r) => {
          const payload = r.data;
          if (!Array.isArray(payload) && payload?.meta) return payload;
          const rows = unwrapPaginatedList(payload);
          return {
            data: rows,
            meta: { page: 1, limit: rows.length || 1, total: rows.length, totalPages: rows.length ? 1 : 0 },
          };
        }),
    get: (id: string) => api.get(`/tenant/sales/${id}`).then((r) => r.data),
    sendEbillSms: (id: string, phone?: string) =>
      api
        .post<{ success: boolean; message: string; ebillUrl: string }>(
          `/tenant/sales/${id}/send-ebill-sms`,
          { phone },
        )
        .then((r) => r.data),
    sendEbillWhatsapp: (id: string, phone?: string) =>
      api
        .post<{ success: boolean; externalUrl: string; ebillUrl: string; message?: string }>(
          `/tenant/sales/${id}/send-ebill-whatsapp`,
          { phone, origin: window.location.origin },
        )
        .then((r) => r.data),
    sendEbillEmail: (id: string, email?: string) =>
      api
        .post<{ success: boolean; message: string; email: string; ebillUrl: string }>(
          `/tenant/sales/${id}/send-ebill-email`,
          { email },
        )
        .then((r) => r.data),
    getInvoiceLink: (id: string) =>
      api
        .get<{
          id: string;
          token: string;
          ebillUrl: string;
          customerPhone: string | null;
          smsStatus: 'NOT_SENT' | 'PENDING' | 'SENT' | 'FAILED';
          smsSentAt: string | null;
          smsAttempts: number;
          smsFailureReason: string | null;
          expiresAt: string | null;
        }>(`/tenant/sales/${id}/invoice-link`)
        .then((r) => r.data),
    resendEbillSms: (id: string, phone?: string) =>
      api
        .post<{
          success: boolean;
          status: 'NOT_SENT' | 'PENDING' | 'SENT' | 'FAILED';
          ebillUrl: string;
          sentAt?: string | null;
          attempts: number;
          failureReason?: string | null;
          message: string;
        }>(`/tenant/sales/${id}/resend-ebill-sms`, { phone })
        .then((r) => r.data),
  },

  publicSales: {
    getEbill: (id: string) =>
      api.get(`/public/sales/${id}/ebill`).then((r) => r.data),
  },

  publicRentals: {
    getCatalog: (shareToken: string) =>
      api
        .get<PublicRentalCatalogResponse>(`/public/rentals/catalogs/${shareToken}`)
        .then((r) => r.data),
  },

  publicInvoices: {
    getByToken: (token: string) =>
      api.get(`/public/invoices/${token}`).then((r) => r.data),
  },

  salesAnalytics: {
    overview: (params?: SalesAnalyticsQueryParams) =>
      api
        .get<SalesAnalyticsOverview>('/tenant/sales-analytics/overview', { params })
        .then((r) => r.data),
    invoices: (params?: SalesAnalyticsQueryParams) =>
      api
        .get<PaginatedResponse<SalesAnalyticsInvoice>>('/tenant/sales-analytics/invoices', {
          params,
        })
        .then((r) => r.data),
    byEmployee: (params?: SalesAnalyticsQueryParams) =>
      api
        .get<PaginatedResponse<SalesAnalyticsEmployeeRow> & { range: SalesAnalyticsRange }>(
          '/tenant/sales-analytics/by-employee',
          { params },
        )
        .then((r) => r.data),
    employeeDetail: (employeeId: string, params?: SalesAnalyticsQueryParams) =>
      api
        .get<SalesAnalyticsEmployeeDetail>(`/tenant/sales-analytics/by-employee/${employeeId}`, {
          params,
        })
        .then((r) => r.data),
    byBranch: (params?: SalesAnalyticsQueryParams) =>
      api
        .get<PaginatedResponse<SalesAnalyticsBranchRow> & { range: SalesAnalyticsRange }>(
          '/tenant/sales-analytics/by-branch',
          { params },
        )
        .then((r) => r.data),
    branchDetail: (branchId: string, params?: SalesAnalyticsQueryParams) =>
      api
        .get<SalesAnalyticsBranchDetail>(`/tenant/sales-analytics/by-branch/${branchId}`, {
          params,
        })
        .then((r) => r.data),
    byDay: (params?: SalesAnalyticsQueryParams) =>
      api
        .get<PaginatedResponse<SalesAnalyticsDayRow> & { range: SalesAnalyticsRange }>(
          '/tenant/sales-analytics/by-day',
          { params },
        )
        .then((r) => r.data),
  },

  expenseCategories: {
    list: () => api.get<ExpenseCategory[]>('/tenant/expense-categories').then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<ExpenseCategory>('/tenant/expense-categories', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<ExpenseCategory>(`/tenant/expense-categories/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      api
        .delete<{ id: string; success: boolean }>(`/tenant/expense-categories/${id}`)
        .then((r) => r.data),
  },

  expenses: {
    list: (params?: Record<string, string>) =>
      api.get<ExpensesListResponse>('/tenant/expenses', { params }).then((r) => r.data),
    get: (id: string) => api.get<Expense>(`/tenant/expenses/${id}`).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<Expense>('/tenant/expenses', data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<Expense>(`/tenant/expenses/${id}`, data).then((r) => r.data),
    updateStatus: (id: string, status: string) =>
      api.patch<Expense>(`/tenant/expenses/${id}/status`, { status }).then((r) => r.data),
    delete: (id: string) =>
      api.delete<{ id: string; success: boolean }>(`/tenant/expenses/${id}`).then((r) => r.data),
  },

  payroll: {
    getSettings: () =>
      api.get<PayrollSettings>('/tenant/payroll/settings').then((r) => r.data),
    updateSettings: (data: Partial<PayrollSettings>) =>
      api.patch<PayrollSettings>('/tenant/payroll/settings', data).then((r) => r.data),
    listLoans: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<EmployeeLoan> | EmployeeLoan[]>('/tenant/payroll/loans', { params })
        .then((r) => r.data),
    getLoan: (id: string) =>
      api.get<EmployeeLoan & { repayments: LoanRepayment[] }>(`/tenant/payroll/loans/${id}`).then((r) => r.data),
    createLoan: (data: Record<string, unknown>) =>
      api.post<EmployeeLoan>('/tenant/payroll/loans', data).then((r) => r.data),
    updateLoan: (id: string, data: Record<string, unknown>) =>
      api.patch<EmployeeLoan>(`/tenant/payroll/loans/${id}`, data).then((r) => r.data),
    listAdvances: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<EmployeeAdvance> | EmployeeAdvance[]>(
          '/tenant/payroll/advances',
          { params },
        )
        .then((r) => r.data),
    getAdvance: (id: string) =>
      api
        .get<EmployeeAdvance & { repayments: AdvanceRepayment[] }>(
          `/tenant/payroll/advances/${id}`,
        )
        .then((r) => r.data),
    createAdvance: (data: Record<string, unknown>) =>
      api.post<EmployeeAdvance>('/tenant/payroll/advances', data).then((r) => r.data),
    updateAdvance: (id: string, data: Record<string, unknown>) =>
      api.patch<EmployeeAdvance>(`/tenant/payroll/advances/${id}`, data).then((r) => r.data),
    listRuns: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<PayrollRun> | PayrollRun[]>('/tenant/payroll/runs', { params })
        .then((r) => r.data),
    getRun: (id: string) => api.get<PayrollRun>(`/tenant/payroll/runs/${id}`).then((r) => r.data),
    createRun: (data: { year: number; month: number }) =>
      api.post<PayrollRun>('/tenant/payroll/runs', data).then((r) => r.data),
    updateItem: (runId: string, itemId: string, data: Record<string, unknown>) =>
      api
        .patch<PayrollItem>(`/tenant/payroll/runs/${runId}/items/${itemId}`, data)
        .then((r) => r.data),
    finalize: (id: string) =>
      api.post<PayrollRun>(`/tenant/payroll/runs/${id}/finalize`).then((r) => r.data),
    markPaid: (id: string) =>
      api.post<PayrollRun>(`/tenant/payroll/runs/${id}/mark-paid`).then((r) => r.data),
    listPayslips: (params?: Record<string, string>) =>
      api
        .get<PaginatedResponse<PayslipListItem> | PayslipListItem[]>('/tenant/payroll/payslips', {
          params,
        })
        .then((r) => r.data),
    getPayslip: (payrollItemId: string) =>
      api.get<PayslipDetail>(`/tenant/payroll/payslips/${payrollItemId}`).then((r) => r.data),
  },

  dashboard: {
    get: (
      branchId?: string,
      period?: SalonDashboardPeriod,
      startDate?: string,
      endDate?: string,
    ) =>
      api
        .get<DashboardData>('/tenant/dashboard', {
          params: {
            ...(branchId && branchId !== 'all' ? { branchId } : {}),
            ...(period ? { period } : {}),
            ...(startDate && endDate ? { startDate, endDate } : {}),
          },
        })
        .then((r) => r.data),
  },

  settings: {
    get: () => api.get<TenantSettings>('/tenant/settings').then((r) => r.data),
    getAppearance: () =>
      api.get<AppearanceSettings>('/tenant/settings/appearance').then((r) => r.data),
    updateAppearance: (data: { primaryColor: string }) =>
      api
        .patch<AppearanceSettings>('/tenant/settings/appearance', data)
        .then((r) => r.data),
    resetAppearance: () =>
      api
        .post<AppearanceSettings>('/tenant/settings/appearance/reset')
        .then((r) => r.data),
    updateSalon: (data: {
      name?: string;
      email?: string;
      phone?: string;
      openingBankBalance?: number | null;
      lowStockThreshold?: number | null;
    }) =>
      api.patch('/tenant/settings/salon', data).then((r) => r.data),
    uploadLogo: (file: File) => {
      const form = new FormData();
      form.append('logo', file);
      return api.post<TenantSettings['salon']>('/tenant/settings/logo', form).then((r) => r.data);
    },
    removeLogo: () => api.delete<TenantSettings['salon']>('/tenant/settings/logo').then((r) => r.data),
    getAccessControl: () =>
      api.get<TenantAccessControl>('/tenant/settings/access-control').then((r) => r.data),
    updateUserRoles: (userId: string, roleCodes: string[]) =>
      api
        .patch<{ userId: string; roles: Array<{ code: string; name: string }> }>(
          `/tenant/settings/users/${userId}/roles`,
          { roleCodes },
        )
        .then((r) => r.data),
    updateUserAccess: (
      userId: string,
      data: {
        roleCode: string;
        moduleAccess: Array<{ moduleCode: string; level: ModuleAccessLevel }>;
      },
    ) =>
      api
        .patch<{
          userId: string;
          roleCode: string;
          hasCustomPermissions: boolean;
          permissionCodes: string[];
          moduleAccess: Record<string, ModuleAccessLevel>;
          roles: Array<{ code: string; name: string }>;
        }>(`/tenant/settings/users/${userId}/access`, data)
        .then((r) => r.data),
    updateRolePermissions: (
      roleCode: string,
      moduleAccess: Array<{ moduleCode: string; level: ModuleAccessLevel }>,
    ) =>
      api
        .patch<{
          roleCode: string;
          roleName: string;
          permissionCodes: string[];
          moduleAccess: Record<string, ModuleAccessLevel>;
        }>(`/tenant/settings/roles/${roleCode}/permissions`, { moduleAccess })
        .then((r) => r.data),
    createRole: (data: {
      name: string;
      description?: string;
      code?: string;
      moduleAccess: Array<{ moduleCode: string; level: ModuleAccessLevel }>;
    }) =>
      api
        .post<{
          id: string;
          code: string;
          name: string;
          description: string | null;
          isSystem: boolean;
          permissionCodes: string[];
          moduleAccess: Record<string, ModuleAccessLevel>;
        }>('/tenant/settings/roles', data)
        .then((r) => r.data),
    deleteRole: (roleCode: string) =>
      api
        .delete<{ roleCode: string; deleted: boolean }>(`/tenant/settings/roles/${roleCode}`)
        .then((r) => r.data),
    updateAccount: (data: { name: string }) =>
      api.patch('/tenant/settings/account', data).then((r) => r.data),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/tenant/settings/password', data).then((r) => r.data),
  },

  reports: {
    salesReport: (params: Record<string, string>) =>
      api.get<SalesReportResponse>('/tenant/reports/sales-report', { params }).then((r) => r.data),
    dailySales: (params: Record<string, string>) =>
      api.get('/tenant/reports/daily-sales', { params }).then((r) => r.data),
    branchSales: (params: Record<string, string>) =>
      api.get('/tenant/reports/branch-sales', { params }).then((r) => r.data),
    serviceSales: (params: Record<string, string>) =>
      api.get('/tenant/reports/service-sales', { params }).then((r) => r.data),
    productSales: (params: Record<string, string>) =>
      api.get('/tenant/reports/product-sales', { params }).then((r) => r.data),
    employeePerformance: (params: Record<string, string>) =>
      api
        .get<EmployeePerformanceReportResponse>('/tenant/reports/employee-performance', { params })
        .then((r) => r.data),
    inventoryReport: (params?: Record<string, string>) =>
      api
        .get<InventoryReportResponse>('/tenant/reports/inventory-report', { params })
        .then((r) => r.data),
    lowStock: (params?: Record<string, string>) =>
      api.get('/tenant/reports/low-stock', { params }).then((r) => r.data),
    profitLoss: (params?: { startDate?: string; endDate?: string; from?: string; to?: string; branchId?: string }) =>
      api.get<ProfitLossReportResponse>('/reports/profit-loss', { params }).then((r) => r.data),
  },

  notifications: {
    list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
      api
        .get<PaginatedResponse<InAppNotification>>('/notifications', { params })
        .then((r) => r.data),
    unreadCount: () =>
      api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
    markRead: (id: string) =>
      api.patch<InAppNotification>(`/notifications/${id}/read`).then((r) => r.data),
    markAllRead: () =>
      api.patch<{ updated: number }>('/notifications/read-all').then((r) => r.data),
  },
};

export interface InAppNotification {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ';
  metadata?: {
    actionUrl?: string;
    action?: string;
    label?: string;
    subscriptionId?: string;
    reminderType?: string;
    targetDate?: string;
  } | null;
  readAt?: string | null;
  createdAt: string;
}

export interface SalesReportResponse {
  summary: {
    totalSales: number;
    serviceSales: number;
    productSales: number;
    totalDiscounts: number;
    serviceSalesPct: number;
    productSalesPct: number;
    totalSalesGrowth?: number;
    discountsGrowth?: number;
  };
  chart: Array<{
    date: string;
    label: string;
    serviceSales: number;
    productSales: number;
    discounts: number;
    total: number;
  }>;
  serviceTransactions: Array<{
    id: string;
    invoiceNo: string;
    createdAt: string;
    employeeName: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    paymentMethod: string;
    branchName: string;
  }>;
  productTransactions: Array<{
    id: string;
    invoiceNo: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    productName: string;
    quantity: number;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    paymentMethod: string;
    branchName: string;
  }>;
}

export interface EmployeePerformanceReportResponse {
  employees: Array<{
    id: string;
    index: number;
    name: string;
    code: string;
    designation: string;
    branchName: string;
    servicesCompleted: number;
    serviceSales: number;
    productSales: number;
    totalSales: number;
    commission: number;
  }>;
  summary: {
    totalServicesCompleted: number;
    totalServiceSales: number;
    totalProductSales: number;
    totalSales: number;
    totalCommission: number;
  };
}

export interface InventoryReportResponse {
  products: Array<{
    id: string;
    index: number;
    name: string;
    sku: string;
    categoryName: string;
    imageUrl: string | null;
    currentStock: number;
    stockValue: number;
    stockIn: number;
    stockOut: number;
    adjustments: number;
    status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  }>;
  summary: {
    totalProducts: number;
    totalStockUnits: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  summaryTotals: {
    currentStock: number;
    stockValue: number;
    stockIn: number;
    stockOut: number;
    adjustments: number;
  };
}

export interface ProfitLossReportResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  branch: {
    id: string | null;
    name: string;
  };
  summary: {
    totalRevenue: number;
    cogs: number;
    grossProfit: number;
    grossProfitMargin: number;
    totalExpenses: number;
    netProfit: number;
    netProfitMargin: number;
  };
  income: {
    serviceRevenue: number;
    productRevenue: number;
    grossSales: number;
    discounts: number;
    refunds: number;
    netRevenue: number;
  };
  costOfSales: {
    productCogs: number;
    totalCostOfSales: number;
  };
  operatingExpenses: {
    categories: Array<{
      categoryCode: string;
      categoryName: string;
      amount: number;
      percentage: number;
    }>;
    totalExpenses: number;
  };
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
  }>;
}

