import { z } from "zod"
import type { AiEvalFixture } from "@/lib/ai/evals/types"
import { getPromptForTask } from "@/lib/ai/prompts"
import { priceListAiResponseSchema } from "@/lib/catalog/import-types"
import { aiImportResponseSchema } from "@/lib/calibration-templates/ai-import-schema"

const catalogPrompt = getPromptForTask("catalog_extraction")
const certificatePrompt = getPromptForTask("certificate_cleanup")
const ocrPrompt = getPromptForTask("OCR_cleanup")
const customerEmailPrompt = getPromptForTask("customer_email")
const insightsPrompt = getPromptForTask("insights_generation")

const customerEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
})

const insightsSchema = z.object({
  summary: z.string().min(1),
  insights: z.array(
    z.object({
      title: z.string().min(1),
      category: z.enum(["revenue", "operations", "maintenance", "warranty", "customer", "technician"]),
      severity: z.enum(["low", "medium", "high"]),
      insight: z.string().min(1),
      recommendedAction: z.string().min(1),
      relatedMetric: z.string().optional(),
    }),
  ),
})

export const AI_EVAL_FIXTURES: readonly AiEvalFixture[] = [
  {
    id: "catalog-extraction-basic-text-input",
    mode: "file_extraction",
    task: "catalog_extraction",
    promptId: catalogPrompt.promptId,
    promptVersion: catalogPrompt.version,
    input: {
      fileName: "eval-catalog.txt",
      mimeType: "text/plain",
      bufferText: [
        "Acme Medical Distribution Price List",
        "Effective Date: 2026-01-15",
        "Category: Audiometers",
        "PN AUD-100 | Basic Audiometer | List $1200 | Net $900",
        "PN ACC-200 | Carrying Case | List $150 | Net $110",
      ].join("\n"),
      systemPrompt: catalogPrompt.systemPrompt,
      userInstruction: catalogPrompt.userPromptTemplate,
    },
    expectedShape: "JSON object with manufacturer/effectiveDate/warnings/rows",
    outputSchema: priceListAiResponseSchema,
    requiredFields: ["rows", "rows.0.name"],
    sampleExpectedValues: {
      manufacturerName: "Acme",
      "rows.0.itemType": "equipment",
    },
    minimumConfidence: 0.3,
    notes: "Synthetic catalog snippet; no customer data.",
  },
  {
    id: "certificate-cleanup-simple-layout",
    mode: "file_extraction",
    task: "certificate_cleanup",
    promptId: certificatePrompt.promptId,
    promptVersion: certificatePrompt.version,
    input: {
      fileName: "eval-certificate.txt",
      mimeType: "text/plain",
      bufferText: [
        "Calibration Certificate",
        "Instrument: Pressure Gauge",
        "As Found Readings",
        "Setpoint 100 psi | Reading 99.8 psi",
        "Result: PASS",
        "Technician Signature",
      ].join("\n"),
      systemPrompt: certificatePrompt.systemPrompt,
      userInstruction: certificatePrompt.userPromptTemplate,
    },
    expectedShape: "JSON object with templateName/confidence/fields/warnings",
    outputSchema: aiImportResponseSchema,
    requiredFields: ["templateName", "fields", "fields.0.label"],
    sampleExpectedValues: {
      "fields.0.type": "section",
    },
    minimumConfidence: 0.3,
    notes: "Synthetic form text to validate template extraction pipeline.",
  },
  {
    id: "ocr-cleanup-plaintext",
    mode: "router",
    task: "OCR_cleanup",
    promptId: ocrPrompt.promptId,
    promptVersion: ocrPrompt.version,
    input: {
      system: ocrPrompt.systemPrompt,
      user: "T h i s  i s  O C R  t e x t .\nPN-100  ca1ibration  due  2026-05-01.",
    },
    expectedShape: "Plain text output",
    requiredFields: [],
    sampleExpectedValues: {
      ".": "calibration",
    },
    notes: "Ensures non-JSON task still runs through router.",
  },
  {
    id: "customer-email-followup-draft",
    mode: "router",
    task: "customer_email",
    promptId: customerEmailPrompt.promptId,
    promptVersion: customerEmailPrompt.version,
    input: {
      system: customerEmailPrompt.systemPrompt,
      user: [
        "Organization context: internal Equipify user drafting follow-up (category: maintenance).",
        "Insight title: Repeat calibration drift on ICU monitors",
        "Insight: Three devices required early recalibration this month.",
        "Suggested next step: Offer a preventive maintenance scheduling call.",
      ].join("\n"),
    },
    expectedShape: "JSON with subject/body",
    outputSchema: customerEmailSchema,
    requiredFields: ["subject", "body"],
    sampleExpectedValues: {
      subject: "Calibration",
    },
    notes: "Synthetic follow-up message draft scenario.",
  },
  {
    id: "insights-generation-operational-snapshot",
    mode: "router",
    task: "insights_generation",
    promptId: insightsPrompt.promptId,
    promptVersion: insightsPrompt.version,
    input: {
      system: insightsPrompt.systemPrompt,
      user: `Operational snapshot for analysis:

{
  "period": "last_30_days",
  "openWorkOrders": 14,
  "overdueWorkOrders": 5,
  "invoiceAgingOver60d": 7,
  "repeatFailuresTopEquipment": ["Audiometer X2"],
  "revenueCents": 12850000
}`,
    },
    expectedShape: "JSON with summary and insights[]",
    outputSchema: insightsSchema,
    requiredFields: ["summary", "insights", "insights.0.title", "insights.0.recommendedAction"],
    sampleExpectedValues: {
      "insights.0.category": "operations",
    },
    minimumConfidence: 0.2,
    notes: "Synthetic aggregate metrics only; no sensitive records.",
  },
] as const
