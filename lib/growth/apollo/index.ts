export { APOLLO_INTEGRATION_AI_1_QA_MARKER, runApolloIntegrationAi1Audit, APOLLO_INTEGRATION_DATA_FLOW } from "@/lib/growth/apollo/apollo-integration-ai-1-audit"
export { APOLLO_INTEGRATION_AI_1_ACTIVATION_QA_MARKER, buildApolloActivationReport, resolveApolloActivationMode } from "@/lib/growth/apollo/apollo-integration-activation"
export { APOLLO_IMPORT_READINESS_QA_MARKER, evaluateApolloImportReadiness } from "@/lib/growth/apollo/apollo-import-readiness"
export {
  APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER,
  validateApolloLivePilotEvidence,
  type ApolloLivePilotEvidence,
} from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
export {
  APOLLO_LIVE_PILOT_ANALYSIS_QA_MARKER,
  analyzeApolloLivePilotEvidence,
  assessApolloLivePilotGoNoGo,
  projectApolloLivePilotCostScaling,
} from "@/lib/growth/apollo/apollo-live-pilot-analysis"
export { buildApolloLivePilotMockEvidence } from "@/lib/growth/apollo/apollo-live-pilot-fixture"
export {
  APOLLO_INTEGRATION_AI_3_QA_MARKER,
  certifyApolloProductionRollout,
  assessApolloAi3FinalGoNoGo,
  formatApolloAi3CertificationMarkdown,
} from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
export { scoreApolloContactQuality } from "@/lib/growth/apollo/apollo-contact-quality-score"
export { analyzeApolloReadinessFunnel } from "@/lib/growth/apollo/apollo-readiness-funnel-analysis"
export { assessApolloMultichannelProductionReadiness } from "@/lib/growth/apollo/apollo-multichannel-production-readiness"
export { buildApolloControlledRolloutPlan } from "@/lib/growth/apollo/apollo-rollout-plan"
