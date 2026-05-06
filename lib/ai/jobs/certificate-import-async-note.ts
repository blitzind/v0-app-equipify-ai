/**
 * Certificate / calibration template AI import — async job readiness (Phase 8 placeholder).
 *
 * TODO(ai-jobs-certificate): When promoting to background jobs:
 * - Create `ai_jobs` rows with task `certificate_cleanup`, source_type `calibration_template_import`,
 *   source_id = draft id or import session id.
 * - Reuse `insertQueuedAiJob` from `@/lib/ai/jobs/create-ai-job` and a runner similar to
 *   `runPriceListImportExtractionJob` in `@/lib/ai/jobs/process-ai-job` that calls
 *   `executeOpenAiStructuredFileExtraction` via existing OpenAI template helpers.
 * - Add polling on the certificates UI using `GET .../ai-jobs/[jobId]` like catalog import.
 *
 * Not migrated in Phase 8 to avoid risky changes to human-verification flows.
 */
export const CERTIFICATE_AI_JOB_TODO = true
