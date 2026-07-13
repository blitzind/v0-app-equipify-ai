/** GE-AIOS-LIVE-1B — Operator-approved Equipify production Company Profile content (client-safe). */

import type { BusinessProfileDraftContent, BusinessProfileInput } from "@/lib/growth/business-profile/business-profile-types"
import { enrichBusinessProfileWithEquipifyMasterKnowledge } from "@/lib/growth/business-profile/equipify-master-knowledge-merge"

export const GE_AIOS_LIVE_1B_QA_MARKER = "ge-aios-live-1b-equipify-equipment-service-icp-v1" as const

export const EQUIPIFY_PRODUCTION_ORG_ID = "00757488-1026-44a5-aac4-269533ac21be" as const

export const LIVE_1B_EQUIPIFY_MISSION_TITLE =
  "Identify companies that employ technicians to maintain, repair, inspect, install, or service physical equipment, prioritizing organizations with recurring work orders, field dispatch, preventive maintenance, equipment history, quoting, invoicing, and service-contract needs." as const

/** Operator-approved NAICS/SIC starting set — search filters only; 21C evaluates every lead individually. */
export const LIVE_1B_OPERATOR_APPROVED_NAICS = [
  "811310", // Commercial/industrial machinery & equipment repair & maintenance
  "811219", // Other electronic & precision equipment repair
  "811412", // Appliance repair & maintenance
  "238220", // Plumbing, heating & air-conditioning contractors
  "541380", // Testing laboratories / calibration services
  "811210", // Electronic & precision equipment repair
] as const

export const LIVE_1B_OPERATOR_EXCLUDED_SIC = [
  "7372", // Prepackaged software — example from LIVE-1B spec
] as const

export const LIVE_1B_EQUIPIFY_COMPANY_INPUT: BusinessProfileInput = {
  companyName: "Equipify",
  website: "https://equipify.ai",
  notes: "GE-AIOS-LIVE-1B operator-authored equipment-service ICP update.",
  whatTheySell:
    "AI-native revenue and operations platform for companies that maintain, service, and manage physical equipment.",
  whoTheySellTo:
    "Organizations with field service, maintenance, inspection, installation, or asset-management operations.",
}

export function buildLive1bEquipifyCompanyProfileContent(): BusinessProfileDraftContent {
  const base: BusinessProfileDraftContent = {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription:
        "Equipify helps equipment-service organizations run smarter revenue and operations workflows — from lead discovery through work orders, dispatch, and customer equipment history.",
      productsServices: [
        "AI OS for revenue operations",
        "Lead discovery and admission",
        "Company research and evidence",
        "Outreach preparation (approval-gated)",
        "Pipeline and work management",
      ],
      businessModel: "B2B SaaS platform for equipment-service and field-operations companies",
      primaryValueProposition:
        "Reduce operational complexity for companies whose business depends on maintaining, servicing, and managing physical equipment.",
    },
    idealCustomers: {
      targetIndustries: [
        "Biomedical and medical equipment service",
        "HVAC service",
        "Plumbing service",
        "Electrical service",
        "Fire protection and safety inspection",
        "Generator service",
        "Compressor service",
        "Pump service",
        "Industrial equipment service",
        "Forklift and material-handling service",
        "Commercial kitchen equipment repair",
        "Elevator service",
        "Building systems service",
        "Facilities maintenance",
        "Property maintenance",
        "Fleet maintenance",
        "Mobile equipment maintenance",
        "Equipment rental companies with service departments",
        "Security systems service",
        "Access control service",
        "Building automation service",
        "Utilities",
        "Municipal public works",
        "Industrial maintenance contractors",
        "Manufacturing (only with meaningful maintenance, field service, or installed-base service operations)",
      ],
      companySizeRanges: ["10-50 employees", "51-200 employees", "201-1000 employees"],
      geography: ["United States", "Canada"],
      buyerPersonas: [
        "Owner / operator",
        "VP Operations",
        "Director of Service",
        "Field Service Manager",
        "Maintenance Manager",
        "Dispatch Manager",
        "Revenue / Sales leader",
      ],
      disqualifiers: [
        "Pure retail or ecommerce",
        "Marketing agencies",
        "Professional services without field operations",
        "Software companies without equipment-service operations",
        "Restaurants without a service division",
        "General construction without ongoing maintenance services",
        "Manufacturers with no maintenance or service operation",
        "Businesses with no technicians",
        "Businesses with no work orders",
        "Businesses with no equipment or asset servicing workflow",
        "Businesses with no recurring service model",
        "Manufacturing without internal maintenance team, field service division, or installed-base service business",
      ],
      preferredNaicsCodes: [...LIVE_1B_OPERATOR_APPROVED_NAICS],
      excludedNaicsCodes: [],
      preferredSicCodes: [],
      excludedSicCodes: [...LIVE_1B_OPERATOR_EXCLUDED_SIC],
      industryCodeNotes:
        "NAICS and SIC codes are prospect-search include/exclude filters and evidence signals only. They do not bypass GE-AIOS-21C admission — every lead must still show technicians, field service, maintenance, work orders, or recurring service evidence. Manufacturing qualifies only when maintenance/service operations are meaningful.",
    },
    problemsAndTriggers: {
      painPoints: [
        "Dispatch and scheduling complexity",
        "Work order backlog and missed preventive maintenance",
        "Disconnected quoting, invoicing, and service history",
        "Technician utilization and route inefficiency",
        "Poor visibility into customer-owned equipment",
        "Manual follow-up on service contracts and renewals",
        "Lead qualification without equipment-service context",
      ],
      buyingTriggers: [
        "Growing field technician headcount",
        "New service contract wins",
        "ERP or FSM replacement project",
        "Expansion into recurring maintenance offerings",
        "Installed-base growth requiring better asset tracking",
      ],
      competitorsAlternatives: ["Spreadsheets", "Generic CRM", "Legacy FSM without AI operations layer"],
      keywords: [
        "field service technicians",
        "maintenance personnel",
        "dispatch operations",
        "preventive maintenance",
        "recurring service",
        "equipment repair",
        "inspection services",
        "installation services",
        "calibration",
        "asset tracking",
        "work orders",
        "equipment service history",
        "quotes and estimates",
        "invoicing",
        "service agreements",
        "parts and inventory",
        "customer-owned equipment",
        "internal equipment fleet",
      ],
      negativeKeywords: [
        "pure manufacturing without service",
        "ecommerce retail",
        "marketing agency",
        "software saas only",
        "restaurant",
        "general contractor only",
      ],
    },
    salesAndMarketing: {
      averageDealSize: null,
      salesCycleEstimate: "30-90 days",
      messagingAngles: [
        "Operate your equipment-service revenue workflow with an AI teammate",
        "Ground every lead in verified company evidence before outreach",
        "Prioritize accounts with real maintenance and field-service operations",
      ],
      qualificationCriteria: [
        "Employs field service technicians or maintenance personnel",
        "Performs repair, inspection, installation, calibration, or preventive maintenance",
        "Uses work orders, dispatch, or recurring service workflows",
        "Maintains customer-owned equipment or a substantial internal fleet",
        "Manufacturing qualifies only with dedicated maintenance team, field service division, installed-base service, or recurring service contracts",
      ],
    },
    confidence: {
      score: 0.95,
      assumptions: [
        "Operator-approved LIVE-1B ICP focuses on equipment maintenance and service operations, not manufacturing as primary ICP.",
        "NAICS/SIC codes listed are starting search filters — admission still requires evidence per lead.",
      ],
      missingInformation: [],
    },
    draftSource: "deterministic",
    websiteContextSummary: GE_AIOS_LIVE_1B_QA_MARKER,
  }

  return enrichBusinessProfileWithEquipifyMasterKnowledge(base)
}
