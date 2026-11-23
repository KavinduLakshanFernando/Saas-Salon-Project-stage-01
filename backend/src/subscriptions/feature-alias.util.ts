/**
 * Backward-compatible aliases between legacy and canonical feature codes.
 * Plan access is never hardcoded here — only code equivalence for runtime checks.
 */
const FEATURE_ALIASES: Record<string, readonly string[]> = {
  SALES_REPORTS: [],
  EMPLOYEE_REPORTS: [],
  INVENTORY_REPORTS: [],
  REPORTS: ['SALES_REPORTS', 'EMPLOYEE_REPORTS', 'INVENTORY_REPORTS'],
  MULTI_BRANCH: ['BRANCH_MANAGEMENT'],
  BRANCH_MANAGEMENT: ['MULTI_BRANCH'],
  STAFF_MANAGEMENT: ['ROLE_MANAGEMENT'],
  ROLE_MANAGEMENT: ['STAFF_MANAGEMENT'],
  BASIC_APPOINTMENTS: ['APPOINTMENTS', 'ADVANCED_BOOKING'],
  APPOINTMENTS: ['BASIC_APPOINTMENTS', 'ADVANCED_BOOKING'],
  WEBSITE: ['ADVANCED_BOOKING'],
  ADVANCED_BOOKING: [],
  WHATSAPP_NOTIFICATIONS: ['WHATSAPP', 'WHATSAPP_INVOICE', 'WHATSAPP_INVOICES'],
  WHATSAPP: ['WHATSAPP_NOTIFICATIONS'],
  WHATSAPP_INVOICE: ['WHATSAPP_NOTIFICATIONS'],
  WHATSAPP_INVOICES: ['WHATSAPP_NOTIFICATIONS'],
};

export function featureCodesEquivalent(required: string, granted: string): boolean {
  if (required === granted) {
    return true;
  }

  // ADVANCED_BOOKING automatically includes WEBSITE, BASIC_APPOINTMENTS, and APPOINTMENTS
  if (granted === 'ADVANCED_BOOKING' && ['WEBSITE', 'BASIC_APPOINTMENTS', 'APPOINTMENTS'].includes(required)) {
    return true;
  }
  if (
    (granted === 'WHATSAPP_NOTIFICATIONS' && ['WHATSAPP', 'WHATSAPP_INVOICES', 'WHATSAPP_INVOICE'].includes(required)) ||
    (['WHATSAPP_NOTIFICATIONS', 'WHATSAPP', 'WHATSAPP_INVOICES', 'WHATSAPP_INVOICE'].includes(granted) && required === 'WHATSAPP_NOTIFICATIONS')
  ) {
    return true;
  }


  // BASIC_APPOINTMENTS and APPOINTMENTS are interchangeable
  if ((granted === 'BASIC_APPOINTMENTS' && required === 'APPOINTMENTS') || (granted === 'APPOINTMENTS' && required === 'BASIC_APPOINTMENTS')) {
    return true;
  }

  if (granted === 'REPORTS' && ['SALES_REPORTS', 'EMPLOYEE_REPORTS', 'INVENTORY_REPORTS'].includes(required)) {
    return true;
  }

  const aliases = FEATURE_ALIASES[required] ?? [];
  return aliases.includes(granted);
}

export function expandFeatureCodes(codes: string[]): string[] {
  const expanded = new Set<string>();

  for (const code of codes) {
    expanded.add(code);
    if (code === 'ADVANCED_BOOKING') {
      expanded.add('WEBSITE');
      expanded.add('BASIC_APPOINTMENTS');
      expanded.add('APPOINTMENTS');
    }
    if (code === 'BASIC_APPOINTMENTS') {
      expanded.add('APPOINTMENTS');
    }
    if (code === 'APPOINTMENTS') {
      expanded.add('BASIC_APPOINTMENTS');
    }
    for (const alias of FEATURE_ALIASES[code] ?? []) {
      expanded.add(alias);
    }
  }

  return [...expanded];
}
