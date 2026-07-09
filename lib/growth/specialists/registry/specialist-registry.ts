/** GE-AIOS-14A — Specialist registry (deterministic, no AI). */

import {
  CUSTOMER_SUCCESS_SPECIALIST,
  customerSuccessSpecialistAcceptsWork,
  customerSuccessSpecialistEstimateConfidence,
  customerSuccessSpecialistSummarizeContribution,
} from "@/lib/growth/specialists/specialists/customer-success-specialist"
import {
  FINANCE_SPECIALIST,
  financeSpecialistAcceptsWork,
  financeSpecialistEstimateConfidence,
  financeSpecialistSummarizeContribution,
} from "@/lib/growth/specialists/specialists/finance-specialist"
import {
  MARKETING_SPECIALIST,
  marketingSpecialistAcceptsWork,
  marketingSpecialistEstimateConfidence,
  marketingSpecialistSummarizeContribution,
} from "@/lib/growth/specialists/specialists/marketing-specialist"
import {
  SALES_SPECIALIST,
  salesSpecialistAcceptsWork,
  salesSpecialistEstimateConfidence,
  salesSpecialistSummarizeContribution,
} from "@/lib/growth/specialists/specialists/sales-specialist"
import {
  SERVICE_SPECIALIST,
  serviceSpecialistAcceptsWork,
  serviceSpecialistEstimateConfidence,
  serviceSpecialistSummarizeContribution,
} from "@/lib/growth/specialists/specialists/service-specialist"
import type { AvaSpecialistDefinition, AvaSpecialistId } from "@/lib/growth/specialists/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export type AvaSpecialistHandler = {
  definition: AvaSpecialistDefinition
  acceptsWork: (item: AvaWorkItem) => boolean
  estimateConfidence: (item: AvaWorkItem) => number
  summarizeContribution: (item: AvaWorkItem) => string
}

export const AVA_SPECIALIST_REGISTRY: AvaSpecialistHandler[] = [
  {
    definition: SALES_SPECIALIST,
    acceptsWork: salesSpecialistAcceptsWork,
    estimateConfidence: salesSpecialistEstimateConfidence,
    summarizeContribution: salesSpecialistSummarizeContribution,
  },
  {
    definition: MARKETING_SPECIALIST,
    acceptsWork: marketingSpecialistAcceptsWork,
    estimateConfidence: marketingSpecialistEstimateConfidence,
    summarizeContribution: marketingSpecialistSummarizeContribution,
  },
  {
    definition: CUSTOMER_SUCCESS_SPECIALIST,
    acceptsWork: customerSuccessSpecialistAcceptsWork,
    estimateConfidence: customerSuccessSpecialistEstimateConfidence,
    summarizeContribution: customerSuccessSpecialistSummarizeContribution,
  },
  {
    definition: SERVICE_SPECIALIST,
    acceptsWork: serviceSpecialistAcceptsWork,
    estimateConfidence: serviceSpecialistEstimateConfidence,
    summarizeContribution: serviceSpecialistSummarizeContribution,
  },
  {
    definition: FINANCE_SPECIALIST,
    acceptsWork: financeSpecialistAcceptsWork,
    estimateConfidence: financeSpecialistEstimateConfidence,
    summarizeContribution: financeSpecialistSummarizeContribution,
  },
]

export function getSpecialistById(id: AvaSpecialistId): AvaSpecialistHandler {
  const match = AVA_SPECIALIST_REGISTRY.find((row) => row.definition.id === id)
  if (!match) return AVA_SPECIALIST_REGISTRY[0]
  return match
}

export function listRegisteredSpecialists(): AvaSpecialistDefinition[] {
  return AVA_SPECIALIST_REGISTRY.map((row) => row.definition)
}
