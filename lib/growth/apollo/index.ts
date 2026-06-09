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
export {
  APOLLO_LIVE_PILOT_ENV_READINESS_QA_MARKER,
  buildApolloLivePilotEnvReadinessReport,
  formatApolloLivePilotEnvReadinessMarkdown,
} from "@/lib/growth/apollo/apollo-live-pilot-env-readiness"
export {
  APOLLO_LIVE_PILOT_SAFETY_QA_MARKER,
  buildApolloLivePilotSafetyReport,
} from "@/lib/growth/apollo/apollo-live-pilot-safety"
export {
  APOLLO_LIVE_PILOT_DRY_RUN_QA_MARKER,
  buildApolloLivePilotDryRunReport,
  formatApolloLivePilotDryRunMarkdown,
  type ApolloLivePilotDryRunTargetCompany,
} from "@/lib/growth/apollo/apollo-live-pilot-dry-run"
export {
  APOLLO_LIVE_PILOT_TEST_COMPANY_SELECTOR_QA_MARKER,
  resolveApolloLivePilotTestCompany,
} from "@/lib/growth/apollo/apollo-live-pilot-test-company-selector"
export {
  APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER,
  buildApolloLivePilotEvidenceBundle,
  buildApolloLivePilotOperatorCommands,
  isApolloLivePilotEvidenceBundle,
  unwrapApolloLivePilotEvidenceBundle,
  type ApolloLivePilotEvidenceBundle,
} from "@/lib/growth/apollo/apollo-live-pilot-evidence-bundle"
