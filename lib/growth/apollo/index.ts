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
  APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES,
  APOLLO_LIVE_PILOT_PRODUCTION_ENV_QA_MARKER,
  APOLLO_LIVE_PILOT_VERCEL_PREFLIGHT_COMMAND,
  APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND,
  bootstrapApolloLivePilotProductionEnv,
} from "@/lib/growth/apollo/apollo-live-pilot-production-env-bootstrap"
export {
  APOLLO_LIVE_PILOT_TEST_COMPANY_SEED_QA_MARKER,
  APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
  seedApolloLivePilotTestCompany,
  validateApolloLivePilotTestCompanySeedEnv,
} from "@/lib/growth/apollo/apollo-live-pilot-test-company-seed"
export {
  APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER,
  buildApolloLivePilotEvidenceBundle,
  buildApolloLivePilotOperatorCommands,
  isApolloLivePilotEvidenceBundle,
  unwrapApolloLivePilotEvidenceBundle,
  type ApolloLivePilotEvidenceBundle,
} from "@/lib/growth/apollo/apollo-live-pilot-evidence-bundle"
export {
  APOLLO_INTEGRATION_AI_5_QA_MARKER,
  certifyApolloProductionActivation,
  formatApolloProductionActivationMarkdown,
  loadApolloPilotEvidenceFromJson,
  type ApolloProductionActivationCertification,
  type ApolloProductionActivationDecision,
} from "@/lib/growth/apollo/apollo-integration-ai-5-production-activation"
export {
  APOLLO_PIPELINE_E2E_VALIDATION_QA_MARKER,
  validateApolloPipelineE2E,
} from "@/lib/growth/apollo/apollo-pipeline-e2e-validation"
export {
  APOLLO_SEQUENCE_ELIGIBILITY_QA_MARKER,
  certifyApolloSequenceEligibility,
} from "@/lib/growth/apollo/apollo-sequence-eligibility-certification"
export {
  APOLLO_OUTREACH_CHANNEL_READINESS_QA_MARKER,
  assessApolloOutreachChannelReadiness,
} from "@/lib/growth/apollo/apollo-outreach-channel-readiness"
export {
  APOLLO_QUALITY_BENCHMARK_QA_MARKER,
  buildApolloQualityBenchmarkReport,
} from "@/lib/growth/apollo/apollo-quality-benchmark-report"
export {
  APOLLO_PRODUCTION_ACTIVATION_LIMITS_QA_MARKER,
  buildApolloProductionActivationLimits,
} from "@/lib/growth/apollo/apollo-production-activation-limits"
