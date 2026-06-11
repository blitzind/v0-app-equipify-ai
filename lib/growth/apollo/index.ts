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
  APOLLO_LIVE_PILOT_VERCEL_LIVE_PILOT_COMMAND,
  APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND,
  APOLLO_LIVE_PILOT_PROTECTED_ENV_KEYS,
  bootstrapApolloLivePilotProductionEnv,
  snapshotApolloLivePilotProtectedEnv,
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
  APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER,
  APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM,
  assertApolloLivePilotProductionExecuteAllowed,
  redactApolloLivePilotProductionSecrets,
  validateApolloLivePilotProductionExecuteConfirmation,
  buildApolloLivePilotProductionReadinessPayload,
} from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"
export {
  buildApolloLivePilotProductionReadinessPayload,
  type ApolloLivePilotProductionReadinessPayload,
} from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"
export {
  executeApolloLivePilotInProduction,
} from "@/lib/growth/apollo/apollo-live-pilot-production-route"
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
export {
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  APOLLO_ENROLLMENT_AUTOMATION_ID,
  type ApolloEnrollmentAutomationReport,
  type ApolloEnrollmentCertificationReport,
  type ApolloEnrollmentFunnelMetrics,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
export {
  APOLLO_ENROLLMENT_QUALIFICATION_ENGINE_QA_MARKER,
  evaluateApolloEnrollmentQualification,
  resolveApolloEnrollmentQualificationThreshold,
} from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
export {
  APOLLO_ENROLLMENT_AUTOMATION_ROUTE_QA_MARKER,
  APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM,
  APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_ENROLLMENT_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
} from "@/lib/growth/apollo/apollo-enrollment-automation-route-gates"
export {
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
  APOLLO_VOICE_DROP_AUTOMATION_ID,
  type ApolloVoiceDropAutomationReport,
  type ApolloVoiceDropCertificationReport,
  type ApolloVoiceDropFunnelMetrics,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
export {
  APOLLO_VOICE_DROP_AUTOMATION_ROUTE_QA_MARKER,
  APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM,
  APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_VOICE_DROP_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-route-gates"
export {
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
  APOLLO_MULTICHANNEL_ORCHESTRATION_ID,
  type ApolloMultichannelOrchestrationReport,
  type ApolloMultichannelOrchestrationCertificationReport,
  type ApolloMultichannelOrchestrationFunnelMetrics,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
export {
  APOLLO_MULTICHANNEL_ORCHESTRATION_ROUTE_QA_MARKER,
  APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM,
  APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_MULTICHANNEL_ORCHESTRATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-route-gates"
export {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID,
  type ApolloSequenceExecutionAutomationReport,
  type ApolloSequenceExecutionCertificationReport,
  type ApolloSequenceExecutionFunnelMetrics,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
export {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ROUTE_QA_MARKER,
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM,
  APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-route-gates"
export {
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
  APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN,
  type ApolloFullPipelineProductionCertificationReport,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
export {
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST,
  APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-route-gates"
export {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  APOLLO_ACCOUNT_PLAYBOOKS_ID,
  type ApolloAccountPlaybookAutomationReport,
  type ApolloAccountPlaybookCertificationReport,
  type ApolloAccountPlaybookFunnelMetrics,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
export {
  APOLLO_ACCOUNT_PLAYBOOKS_ROUTE_QA_MARKER,
  APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM,
  APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_ACCOUNT_PLAYBOOKS_BROWSER_CONSOLE_EXECUTE_SNIPPET,
} from "@/lib/growth/apollo/apollo-account-playbooks-route-gates"
export {
  runAccountPlaybookEngine,
  classifyCommitteeRoleFromTitle,
  APOLLO_ACCOUNT_PLAYBOOK_ENGINE_QA_MARKER,
} from "@/lib/growth/apollo/apollo-account-playbook-engine"
export {
  APOLLO_MEETING_BRIDGE_QA_MARKER,
  APOLLO_MEETING_BRIDGE_ID,
  APOLLO_MEETING_BRIDGE_MIGRATION,
  APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION,
  type ApolloMeetingBridgeAutomationReport,
  type ApolloMeetingBridgeCertificationReport,
  type ApolloMeetingCandidateFunnelMetrics,
  type ApolloMeetingCandidateQueueSnapshot,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
export {
  APOLLO_MEETING_BRIDGE_ROUTE_QA_MARKER,
  APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM,
  APOLLO_MEETING_BRIDGE_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_MEETING_BRIDGE_BROWSER_CONSOLE_EXECUTE_SNIPPET,
} from "@/lib/growth/apollo/apollo-meeting-bridge-route-gates"
