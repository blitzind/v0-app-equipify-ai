/** GE-AIOS-BUSINESS-PROFILE-1B — Map validated AI model to profile content (client-safe). */

import type { BusinessProfileAiDraftModel } from "@/lib/growth/business-profile/business-profile-ai-draft-schema"
import type {
  BusinessProfileDraftContent,
  BusinessProfileDraftSource,
  BusinessProfileInput,
} from "@/lib/growth/business-profile/business-profile-types"

export function mapAiModelToBusinessProfileContent(input: {
  model: BusinessProfileAiDraftModel
  companyInput: BusinessProfileInput
  websiteContextSummary: string | null
  draftSource: BusinessProfileDraftSource
}): BusinessProfileDraftContent {
  const { model, companyInput, websiteContextSummary, draftSource } = input
  return {
    company: {
      companyName: companyInput.companyName,
      website: companyInput.website,
      shortDescription: model.company.shortDescription,
      productsServices: model.company.productsServices,
      businessModel: model.company.businessModel,
      primaryValueProposition: model.company.primaryValueProposition,
    },
    idealCustomers: model.idealCustomers,
    problemsAndTriggers: model.problemsAndTriggers,
    salesAndMarketing: {
      averageDealSize: model.salesAndMarketing.averageDealSize ?? companyInput.averageDealSize ?? null,
      salesCycleEstimate: model.salesAndMarketing.salesCycleEstimate ?? null,
      messagingAngles: model.salesAndMarketing.messagingAngles,
      qualificationCriteria: model.salesAndMarketing.qualificationCriteria,
    },
    confidence: model.confidence,
    draftSource,
    websiteContextSummary,
  }
}
