/** Staff-only UI copy when BlitzPay widgets cannot load. Do not echo API or database errors. */
export const blitzpayStaffWidgetLoadCopy = {
  executiveBusinessHealth: "Executive business health is temporarily unavailable.",
  recurringRevenue: "Recurring revenue data is temporarily unavailable.",
  collectionsCopilot: "Collections insights are temporarily unavailable.",
  financialCommandCenter: "Financial command center data is temporarily unavailable.",
  cashPlanning: "Cash planning data is temporarily unavailable.",
  payroll: "Payroll insights are temporarily unavailable.",
  commissions: "Commissions data is temporarily unavailable.",
  contractorSettlements: "Contractor settlement data is temporarily unavailable.",
  actionUnavailable: "That action could not be completed. Try again in a moment.",
  /** Generic fallback for other BlitzPay staff widgets (settings, treasury, etc.). */
  dataUnavailable: "This information is temporarily unavailable.",
} as const
