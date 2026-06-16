/**
 * S5-B — Automation Visual Builder persistence + API foundation certification.
 *
 * Local: pnpm test:growth-automation-builder
 * Integration: pnpm test:growth-automation-builder:integration
 * Production: pnpm test:growth-automation-builder:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  bootstrapGrowthAutomationBuilderCertEnv,
  describeAutomationBuilderCertBootstrapFailure,
} from "../lib/growth/automation/growth-automation-cert-bootstrap"
import {
  GROWTH_AUTOMATION_ADMIN_ROUTE_PATHS,
  GROWTH_AUTOMATION_PLATFORM_ROUTE_PATHS,
  GROWTH_AUTOMATION_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-diagnostics"
import {
  GROWTH_AUTOMATION_API_SAFETY_FLAGS,
  GROWTH_AUTOMATION_BUILDER_CONFIRM,
  GROWTH_AUTOMATION_BUILDER_MIGRATION,
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
  GROWTH_AUTOMATION_EDGE_TYPES,
  GROWTH_AUTOMATION_FLOW_STATUSES,
  GROWTH_AUTOMATION_NODE_TYPES,
  GROWTH_AUTOMATION_VERSION_LIFECYCLES,
  canArchiveAutomationFlow,
  canEditAutomationDraftVersion,
} from "../lib/growth/automation/growth-automation-types"
import {
  GROWTH_AUTOMATION_CANVAS_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_CANVAS_QA_MARKER,
  GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS,
  GROWTH_AUTOMATION_REACT_FLOW_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-canvas-diagnostics"
import {
  exportCanvasState,
  flowToReactFlow,
  importCanvasState,
  reactFlowToPersistence,
} from "../lib/growth/automation/growth-automation-canvas-serialization"
import { autoLayoutCanvasNodes } from "../lib/growth/automation/growth-automation-canvas-layout"
import {
  canRedoHistory,
  canUndoHistory,
  createHistoryState,
  pushHistoryState,
  redoHistoryState,
  undoHistoryState,
} from "../lib/growth/automation/growth-automation-canvas-history"
import { createCanvasEdge, createCanvasNode } from "../lib/growth/automation/growth-automation-canvas-utils"
import {
  GROWTH_AUTOMATION_COMPILER_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_COMPILER_QA_MARKER,
  GROWTH_AUTOMATION_COMPILER_ROUTE_PATHS,
  GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS,
  GROWTH_AUTOMATION_COMPILER_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-compiler-diagnostics"
import { compileAutomationFlowGraph } from "../lib/growth/automation/growth-automation-compiler-service"
import {
  GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
  GROWTH_AUTOMATION_SIMULATION_ROUTE_PATHS,
  GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
  GROWTH_AUTOMATION_SIMULATION_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-simulation-diagnostics"
import { simulateAutomationFlowGraph } from "../lib/growth/automation/growth-automation-simulation-service"
import {
  GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
  GROWTH_AUTOMATION_PUBLISH_ROUTE_PATHS,
  GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS,
  GROWTH_AUTOMATION_PUBLISH_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-publish-diagnostics"
import { assertPublishedVersionImmutable } from "../lib/growth/automation/growth-automation-publish-service"
import { evaluatePublishReadiness } from "../lib/growth/automation/growth-automation-publish-utils"
import {
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_ROUTE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-runtime-reconciliation-diagnostics"
import {
  computeRuntimeReconciliationDiff,
  reconcileAutomationRuntimePreview,
} from "../lib/growth/automation/growth-automation-runtime-reconciliation-utils"
import {
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_ROUTE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-runtime-publisher-diagnostics"
import {
  GROWTH_AUTOMATION_ENROLLMENT_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
  GROWTH_AUTOMATION_ENROLLMENT_ROUTE_PATHS,
  GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
  GROWTH_AUTOMATION_ENROLLMENT_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-enrollment-diagnostics"
import {
  classifyAutomationRuntimeStep,
  isTerminalAutomationRuntimeStatus,
  resolveAutomationRuntimeCurrentStep,
} from "../lib/growth/automation/growth-automation-runtime-execution-utils"
import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_ROUTE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-runtime-execution-diagnostics"
import {
  GROWTH_AUTOMATION_APPROVAL_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  GROWTH_AUTOMATION_APPROVAL_ROUTE_PATHS,
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  GROWTH_AUTOMATION_APPROVAL_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-approval-diagnostics"
import {
  GROWTH_AUTOMATION_OBSERVABILITY_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
  GROWTH_AUTOMATION_OBSERVABILITY_ROUTE_PATHS,
  GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
  GROWTH_AUTOMATION_OBSERVABILITY_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-observability-diagnostics"
import {
  GROWTH_AUTOMATION_ANALYTICS_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
  GROWTH_AUTOMATION_ANALYTICS_ROUTE_PATHS,
  GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
  GROWTH_AUTOMATION_ANALYTICS_UI_MODULE_PATHS,
} from "../lib/growth/automation/growth-automation-analytics-diagnostics"
import {
  aggregateAnalyticsCounts,
  aggregateApprovalStats,
  aggregateBranchStats,
  aggregateJobStats,
  aggregateWaitStats,
  buildAnalyticsTimeline,
  detectTopBottlenecks,
  mapEnrollmentRowsToSnapshots,
} from "../lib/growth/automation/growth-automation-analytics-utils"
import {
  aggregateRuntimeCounts,
  buildEnrollmentSnapshot,
  calculateRuntimeHealth,
  detectStuckWaits,
  formatRecentActivityEntries,
  isRuntimeKillSwitchEnabled,
  readRuntimeKillSwitch,
} from "../lib/growth/automation/growth-automation-observability-utils"
import {
  buildApprovalPreview,
  extractPendingApprovalsFromEnrollmentMetadata,
  resolveApprovalActionType,
  resolveApprovalRiskLevel,
} from "../lib/growth/automation/growth-automation-approval-utils"
import {
  buildAutomationEnrollmentMetadata,
  isSupportedAutomationEnrollmentTrigger,
  normalizeAutomationTriggerInput,
  triggerMatchesRuntimePattern,
} from "../lib/growth/automation/growth-automation-enrollment-utils"
import {
  buildAutomationPatternKey,
  resolveEffectiveFlowStatus,
  validateRuntimeActivationGates,
  validateRuntimePublishGates,
} from "../lib/growth/automation/growth-automation-runtime-publisher-utils"
import type {
  GrowthAutomationEdge,
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationNode,
} from "../lib/growth/automation/growth-automation-types"

import { validateAutomationGraph } from "../lib/growth/automation/growth-automation-validation-service"

const S5C_CANVAS_LIB_PATHS = [...GROWTH_AUTOMATION_CANVAS_LIB_MODULE_PATHS] as const
const S5C_REACT_FLOW_PATHS = [...GROWTH_AUTOMATION_REACT_FLOW_MODULE_PATHS] as const

const S5D_COMPILER_PATHS = [
  ...GROWTH_AUTOMATION_COMPILER_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_COMPILER_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_COMPILER_UI_MODULE_PATHS,
] as const

const S5E_SIMULATION_PATHS = [
  ...GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_SIMULATION_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_SIMULATION_UI_MODULE_PATHS,
] as const

const S5F_PUBLISH_PATHS = [
  ...GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_PUBLISH_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_PUBLISH_UI_MODULE_PATHS,
] as const

const S5G_RUNTIME_RECONCILIATION_PATHS = [
  ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_UI_MODULE_PATHS,
] as const

const S5H_RUNTIME_PUBLISHER_PATHS = [
  ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_UI_MODULE_PATHS,
] as const

const S5I_ENROLLMENT_PATHS = [
  ...GROWTH_AUTOMATION_ENROLLMENT_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_ENROLLMENT_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_ENROLLMENT_UI_MODULE_PATHS,
] as const

const S5J_RUNTIME_EXECUTION_PATHS = [
  ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_UI_MODULE_PATHS,
] as const

const S5K_APPROVAL_PATHS = [
  ...GROWTH_AUTOMATION_APPROVAL_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_APPROVAL_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_APPROVAL_UI_MODULE_PATHS,
] as const

const S5L_OBSERVABILITY_PATHS = [
  ...GROWTH_AUTOMATION_OBSERVABILITY_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_OBSERVABILITY_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_OBSERVABILITY_UI_MODULE_PATHS,
] as const

const S5M_ANALYTICS_PATHS = [
  ...GROWTH_AUTOMATION_ANALYTICS_LIB_MODULE_PATHS,
  ...GROWTH_AUTOMATION_ANALYTICS_ROUTE_PATHS,
  ...GROWTH_AUTOMATION_ANALYTICS_UI_MODULE_PATHS,
] as const

const S5B_SERVER_LIB_PATHS = [
  "supabase/migrations/20270827121000_growth_automation_builder_s5b.sql",
  "lib/growth/automation/growth-automation-types.ts",
  "lib/growth/automation/growth-automation-repository.ts",
  "lib/growth/automation/growth-automation-service.ts",
  "lib/growth/automation/growth-automation-validation-service.ts",
  "lib/growth/automation/growth-automation-schema-health.ts",
  "lib/growth/automation/growth-automation-platform-access.ts",
  "lib/growth/automation/growth-automation-route-utils.ts",
  "lib/growth/automation/growth-automation-diagnostics.ts",
  "lib/growth/automation/growth-automation-production-diagnostics.ts",
  "lib/growth/automation/growth-automation-cert-bootstrap.ts",
  "components/growth/automation/growth-automation-flow-editor.tsx",
] as const

const FORBIDDEN_SERVER_PATTERNS = [
  /runAutomationSimulation/i,
  /executeSequenceBranch/i,
  /dispatchSequenceWake/i,
  /emitGrowthNotification/i,
  /queueSequenceStepTransportJob/,
  /insertGrowthOutreachQueueItem/,
] as const

function runLocalRegression(): void {
  console.log(`\n=== S5-B local regression (${GROWTH_AUTOMATION_BUILDER_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_BUILDER_QA_MARKER, "growth-automation-builder-s5b-v1")
  assert.equal(GROWTH_AUTOMATION_BUILDER_CONFIRM, "RUN_GROWTH_AUTOMATION_BUILDER_CERTIFICATION")
  assert.equal(GROWTH_AUTOMATION_BUILDER_MIGRATION, "20270827121000_growth_automation_builder_s5b.sql")
  assert.deepEqual([...GROWTH_AUTOMATION_FLOW_STATUSES], [
    "draft",
    "published",
    "runtime_active",
    "runtime_paused",
    "archived",
  ])
  assert.deepEqual([...GROWTH_AUTOMATION_VERSION_LIFECYCLES], ["draft", "published", "superseded"])
  assert.equal(GROWTH_AUTOMATION_NODE_TYPES.length, 7)
  assert.equal(GROWTH_AUTOMATION_EDGE_TYPES.length, 5)
  console.log("  ✓ QA marker, statuses, node/edge types")

  for (const relativePath of [
    ...S5B_SERVER_LIB_PATHS,
    ...S5C_CANVAS_LIB_PATHS,
    ...S5C_REACT_FLOW_PATHS,
    ...S5D_COMPILER_PATHS,
    ...S5E_SIMULATION_PATHS,
    ...S5F_PUBLISH_PATHS,
    ...S5G_RUNTIME_RECONCILIATION_PATHS,
    ...S5H_RUNTIME_PUBLISHER_PATHS,
    ...S5I_ENROLLMENT_PATHS,
    ...S5J_RUNTIME_EXECUTION_PATHS,
    ...GROWTH_AUTOMATION_PLATFORM_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_ADMIN_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_UI_MODULE_PATHS,
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ module, route, and UI manifests")

  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.read_only_runtime, true)
  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.compiler_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.simulation_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.automation_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.no_sequence_execution, true)
  assert.equal(GROWTH_AUTOMATION_API_SAFETY_FLAGS.no_provider_execution, true)
  console.log("  ✓ safety flags")

  assert.equal(canArchiveAutomationFlow("draft"), true)
  assert.equal(canArchiveAutomationFlow("archived"), false)
  assert.equal(canEditAutomationDraftVersion("draft"), true)
  assert.equal(canEditAutomationDraftVersion("published"), false)
  console.log("  ✓ lifecycle helpers")

  const migrationSource = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270827121000_growth_automation_builder_s5b.sql"),
    "utf8",
  )
  for (const table of [
    "automation_flows",
    "automation_flow_versions",
    "automation_nodes",
    "automation_edges",
    "automation_validation_results",
  ]) {
    assert.ok(migrationSource.includes(`growth.${table}`), `Missing table in migration: ${table}`)
  }
  assert.ok(migrationSource.includes("growth-automation-builder-s5b-v1"))
  console.log("  ✓ migration tables + QA marker")

  const triggerId = "11111111-1111-4111-8111-111111111111"
  const exitId = "22222222-2222-4222-8222-222222222222"
  const valid = validateAutomationGraph({
    nodes: [
      {
        id: triggerId,
        versionId: "v1",
        nodeType: "trigger",
        label: "Lead created",
        positionX: 0,
        positionY: 0,
        configJson: { triggerSource: "lead.created" },
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: exitId,
        versionId: "v1",
        nodeType: "exit",
        label: "Done",
        positionX: 200,
        positionY: 0,
        configJson: {},
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    edges: [
      {
        id: "e1",
        versionId: "v1",
        fromNodeId: triggerId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(valid.ok, true)
  console.log("  ✓ validation: valid trigger → exit graph")

  const missingTrigger = validateAutomationGraph({
    nodes: [
      {
        id: exitId,
        versionId: "v1",
        nodeType: "exit",
        label: "Done",
        positionX: 0,
        positionY: 0,
        configJson: {},
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    edges: [],
  })
  assert.equal(missingTrigger.ok, false)
  assert.ok(missingTrigger.errors.some((issue) => issue.ruleCode === "exactly_one_trigger"))
  console.log("  ✓ validation: exactly one trigger")

  const sendWithoutApproval = validateAutomationGraph({
    nodes: [
      {
        id: triggerId,
        versionId: "v1",
        nodeType: "trigger",
        label: "Trigger",
        positionX: 0,
        positionY: 0,
        configJson: { triggerSource: "lead.created" },
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        versionId: "v1",
        nodeType: "action",
        label: "Send email",
        positionX: 100,
        positionY: 0,
        configJson: { actionType: "send_email" },
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: exitId,
        versionId: "v1",
        nodeType: "exit",
        label: "Done",
        positionX: 200,
        positionY: 0,
        configJson: {},
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    edges: [
      {
        id: "e1",
        versionId: "v1",
        fromNodeId: triggerId,
        toNodeId: "33333333-3333-4333-8333-333333333333",
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e2",
        versionId: "v1",
        fromNodeId: "33333333-3333-4333-8333-333333333333",
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.ok(sendWithoutApproval.errors.some((issue) => issue.ruleCode === "send_action_missing_approval"))
  console.log("  ✓ validation: send action requires upstream approval")

  for (const relativePath of S5B_SERVER_LIB_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SERVER_PATTERNS) {
      assert.ok(!pattern.test(source), `Forbidden pattern ${pattern} in ${relativePath}`)
    }
  }
  console.log("  ✓ forbidden execution patterns absent from S5-B server libs")

  runS5CLocalRegression()
  runS5DLocalRegression()
  runS5ELocalRegression()
  runS5FLocalRegression()
  runS5GLocalRegression()
  runS5HLocalRegression()
  runS5ILocalRegression()
  runS5JLocalRegression()
  runS5KLocalRegression()
  runS5LLocalRegression()
  runS5MLocalRegression()

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/route.ts"),
    "utf8",
  )
  assert.ok(routeSource.includes("automationApiSafetyPayload"))
  assert.ok(!routeSource.includes("export async function DELETE"))
  console.log("  ✓ API route safety payload + no DELETE")
}

function runS5CLocalRegression(): void {
  console.log(`\n=== S5-C canvas regression (${GROWTH_AUTOMATION_CANVAS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_CANVAS_QA_MARKER, "growth-automation-canvas-s5c-v1")
  assert.equal(GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS.read_only_runtime, true)
  assert.equal(GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS.compiler_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS.no_background_jobs, true)
  assert.equal(GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS.no_realtime_collaboration, true)
  console.log("  ✓ canvas QA marker + safety flags")

  const reactFlowSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/automation/growth-automation-react-flow.tsx"),
    "utf8",
  )
  assert.ok(reactFlowSource.includes("reactflow"))
  assert.ok(reactFlowSource.includes("GrowthAutomationBackground"))
  console.log("  ✓ React Flow module wiring")

  const triggerId = "11111111-1111-4111-8111-111111111111"
  const exitId = "22222222-2222-4222-8222-222222222222"
  const canvas = flowToReactFlow({
    nodes: [
      {
        id: triggerId,
        versionId: "v1",
        nodeType: "trigger",
        label: "Trigger",
        positionX: 0,
        positionY: 0,
        configJson: { triggerSource: "lead.created" },
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: exitId,
        versionId: "v1",
        nodeType: "exit",
        label: "Exit",
        positionX: 200,
        positionY: 0,
        configJson: {},
        validationState: "pending",
        compiledPatternStepId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    edges: [
      {
        id: "edge-1",
        versionId: "v1",
        fromNodeId: triggerId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(canvas.nodes.length, 2)
  assert.equal(canvas.edges.length, 1)

  const persistence = reactFlowToPersistence(canvas)
  assert.equal(persistence.nodes.length, 2)
  assert.equal(persistence.edges[0]?.edgeType, "default")

  const exported = exportCanvasState(canvas)
  const imported = importCanvasState(exported)
  assert.equal(imported.nodes.length, 2)
  console.log("  ✓ serialization + import/export")

  const laidOut = autoLayoutCanvasNodes(canvas.nodes, canvas.edges, "top_to_bottom")
  assert.ok(laidOut[1]!.position.y > laidOut[0]!.position.y)
  console.log("  ✓ auto layout")

  let history = createHistoryState(canvas)
  const next = {
    nodes: [...canvas.nodes, createCanvasNode({ id: "new-node", nodeType: "action", position: { x: 100, y: 100 } })],
    edges: canvas.edges,
  }
  history = pushHistoryState(history, next)
  assert.equal(history.present.nodes.length, 3)
  history = undoHistoryState(history)
  assert.equal(history.present.nodes.length, 2)
  assert.ok(canRedoHistory(history))
  history = redoHistoryState(history)
  assert.equal(history.present.nodes.length, 3)
  assert.equal(canUndoHistory(createHistoryState(canvas)), false)
  console.log("  ✓ history stack")

  const createdNode = createCanvasNode({ id: "n1", nodeType: "goal", position: { x: 0, y: 0 } })
  const createdEdge = createCanvasEdge({ id: "e1", source: triggerId, target: exitId, edgeType: "yes" })
  assert.equal(createdNode.data.canvasNodeType, "goal")
  assert.equal(createdEdge.data?.canvasEdgeType, "yes")
  console.log("  ✓ node/edge creation helpers")
}

function certNode(partial: Partial<GrowthAutomationNode> & Pick<GrowthAutomationNode, "id" | "nodeType">): GrowthAutomationNode {
  return {
    versionId: "version-1",
    label: partial.label ?? partial.nodeType,
    positionX: partial.positionX ?? 0,
    positionY: partial.positionY ?? 0,
    configJson: partial.configJson ?? {},
    validationState: "pending",
    compiledPatternStepId: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  }
}

function certFlow(): { flow: GrowthAutomationFlow; version: GrowthAutomationFlowVersion } {
  return {
    flow: {
      id: "flow-1",
      organizationId: "org-1",
      name: "Cert Flow",
      description: "",
      status: "draft",
      currentVersionId: "version-1",
      publishedVersionId: null,
      qaMarker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      createdAt: "",
      updatedAt: "",
      archivedAt: null,
    },
    version: {
      id: "version-1",
      flowId: "flow-1",
      versionNumber: 1,
      lifecycle: "draft",
      canvasLayoutJson: {},
      compiledPatternId: null,
      publishedAt: null,
      publishedBy: null,
      createdAt: "",
      updatedAt: "",
    },
  }
}

function runS5DLocalRegression(): void {
  console.log(`\n=== S5-D compiler regression (${GROWTH_AUTOMATION_COMPILER_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_COMPILER_QA_MARKER, "growth-automation-compiler-s5d-v1")
  assert.equal(GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS.compile_preview_only, true)
  assert.equal(GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS.no_sequence_pattern_writes, true)
  assert.equal(GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS.compiler_execution_enabled, false)
  console.log("  ✓ compiler QA marker + preview safety flags")

  const { flow, version } = certFlow()
  const triggerId = "11111111-1111-4111-8111-111111111111"
  const approvalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const actionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const exitId = "22222222-2222-4222-8222-222222222222"

  const approvalGraph = compileAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({ id: approvalId, nodeType: "approval" }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e1",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: approvalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e2",
        versionId: "version-1",
        fromNodeId: approvalId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e3",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(approvalGraph.status, "compiled")
  assert.equal(approvalGraph.stats.stepCount, 4)
  assert.equal(approvalGraph.compiledSteps.find((step) => step.automationNodeId === actionId)?.requiresHumanApproval, true)
  console.log("  ✓ compile approval-gated send action graph")

  const conditionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const branchGraph = compileAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "email.replied" },
      }),
      certNode({
        id: conditionId,
        nodeType: "condition",
        configJson: { source: "email", event: "email.replied" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e4",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: conditionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e5",
        versionId: "version-1",
        fromNodeId: conditionId,
        toNodeId: exitId,
        edgeType: "conditional_true",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(branchGraph.status, "compiled")
  assert.equal(branchGraph.compiledConditions.length, 1)
  assert.ok(branchGraph.compiledEdges.some((edge) => edge.edgeType === "conditional_true"))
  console.log("  ✓ compile condition branch graph")

  const waitId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  const waitGraph = compileAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "media.viewed" },
      }),
      certNode({
        id: waitId,
        nodeType: "wait",
        configJson: { waitKind: "duration", durationSeconds: 3600 },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e6",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: waitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e7",
        versionId: "version-1",
        fromNodeId: waitId,
        toNodeId: exitId,
        edgeType: "timeout",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(waitGraph.status, "compiled")
  assert.equal(waitGraph.compiledWaits.length, 1)
  assert.equal(waitGraph.compiledWaits[0]?.waitKind, "duration")
  console.log("  ✓ compile wait timeout graph")

  const sendWithoutApproval = compileAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e8",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e9",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(sendWithoutApproval.status, "failed")
  assert.ok(sendWithoutApproval.errors.some((issue) => issue.ruleCode === "send_action_missing_approval"))
  console.log("  ✓ reject send action without approval")

  const badTrigger = compileAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "unsupported.trigger" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e10",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(badTrigger.status, "failed")
  assert.ok(badTrigger.errors.some((issue) => issue.ruleCode === "unsupported_trigger"))
  console.log("  ✓ reject unsupported trigger/event")

  const compileRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/compile/route.ts"),
    "utf8",
  )
  assert.ok(compileRouteSource.includes("automationCompileApiSafetyPayload"))
  assert.ok(compileRouteSource.includes("GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS") || compileRouteSource.includes("automationCompileApiSafetyPayload"))
  console.log("  ✓ compile route safety payload")

  for (const relativePath of GROWTH_AUTOMATION_COMPILER_LIB_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!/\.from\(["']sequence_pattern/.test(source), `SR-3 write pattern in ${relativePath}`)
  }
  console.log("  ✓ no SR-3 write patterns in compiler libs")
}

function runS5ELocalRegression(): void {
  console.log(`\n=== S5-E simulation regression (${GROWTH_AUTOMATION_SIMULATION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_SIMULATION_QA_MARKER, "growth-automation-simulation-s5e-v1")
  assert.equal(GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS.simulation_preview_only, true)
  assert.equal(GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS.simulation_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS.no_background_jobs, true)
  console.log("  ✓ simulation QA marker + preview safety flags")

  const simulationPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/automation/growth-automation-simulation-panel.tsx"),
    "utf8",
  )
  const parsedFixtureUseMemoMatch = simulationPanelSource.match(
    /const parsedFixture = useMemo\(\(\) => \{([\s\S]*?)\}, \[fixtureText\]\)/,
  )
  assert.ok(parsedFixtureUseMemoMatch, "Simulation panel parsedFixture useMemo block missing")
  assert.ok(
    !parsedFixtureUseMemoMatch[1].includes("setFixtureError"),
    "Simulation panel useMemo must not call setFixtureError during render",
  )
  console.log("  ✓ simulation panel useMemo stays pure (no render-phase setState)")

  const { flow, version } = certFlow()
  const triggerId = "11111111-1111-4111-8111-111111111111"
  const approvalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const actionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const goalId = "22222222-2222-4222-8222-222222222222"
  const conditionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const falseExitId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
  const waitId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

  const linearGraph = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({ id: approvalId, nodeType: "approval" }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: goalId, nodeType: "exit", configJson: { canvasNodeType: "goal" } }),
    ],
    edges: [
      {
        id: "e1",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: approvalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e2",
        versionId: "version-1",
        fromNodeId: approvalId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e3",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: goalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    simulationInput: { triggerEvent: "share_page.viewed", scenario: "immediate" },
  })
  assert.equal(linearGraph.status, "simulated")
  assert.ok(linearGraph.compileId)
  assert.ok(linearGraph.timeline.some((entry) => entry.action === "trigger_entered"))
  assert.ok(linearGraph.timeline.some((entry) => entry.action === "action_would_execute"))
  assert.ok(linearGraph.timeline.some((entry) => entry.action === "goal_reached"))
  assert.equal(linearGraph.approvalGates.length, 1)
  console.log("  ✓ simulate trigger → action → goal")

  const trueBranch = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "email.replied" },
      }),
      certNode({
        id: conditionId,
        nodeType: "condition",
        configJson: { source: "email", event: "email.replied" },
      }),
      certNode({ id: goalId, nodeType: "exit", configJson: { canvasNodeType: "goal" } }),
      certNode({ id: falseExitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e4",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: conditionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e5",
        versionId: "version-1",
        fromNodeId: conditionId,
        toNodeId: goalId,
        edgeType: "conditional_true",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e6",
        versionId: "version-1",
        fromNodeId: conditionId,
        toNodeId: falseExitId,
        edgeType: "conditional_false",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    simulationInput: {
      conditionOverrides: { [conditionId]: true },
      scenario: "immediate",
    },
  })
  assert.equal(trueBranch.status, "simulated")
  assert.ok(trueBranch.branchDecisions.some((decision) => decision.decision === "conditional_true"))
  console.log("  ✓ simulate true branch")

  const falseBranch = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "email.replied" },
      }),
      certNode({
        id: conditionId,
        nodeType: "condition",
        configJson: { source: "email", event: "email.replied" },
      }),
      certNode({ id: goalId, nodeType: "exit", configJson: { canvasNodeType: "goal" } }),
      certNode({ id: falseExitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e7",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: conditionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e8",
        versionId: "version-1",
        fromNodeId: conditionId,
        toNodeId: goalId,
        edgeType: "conditional_true",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e9",
        versionId: "version-1",
        fromNodeId: conditionId,
        toNodeId: falseExitId,
        edgeType: "conditional_false",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    simulationInput: {
      conditionOverrides: { [conditionId]: false },
      scenario: "immediate",
    },
  })
  assert.equal(falseBranch.status, "simulated")
  assert.ok(falseBranch.branchDecisions.some((decision) => decision.decision === "conditional_false"))
  console.log("  ✓ simulate false branch")

  const durationWait = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "media.viewed" },
      }),
      certNode({
        id: waitId,
        nodeType: "wait",
        configJson: { waitKind: "duration", durationSeconds: 3600 },
      }),
      certNode({ id: goalId, nodeType: "exit", configJson: { canvasNodeType: "goal" } }),
    ],
    edges: [
      {
        id: "e10",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: waitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e11",
        versionId: "version-1",
        fromNodeId: waitId,
        toNodeId: goalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    simulationInput: { scenario: "immediate" },
  })
  assert.equal(durationWait.status, "simulated")
  assert.equal(durationWait.waitStates.length, 1)
  assert.equal(durationWait.waitStates[0]?.waitKind, "duration")
  console.log("  ✓ simulate duration wait")

  const timeoutWait = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "media.viewed" },
      }),
      certNode({
        id: waitId,
        nodeType: "wait",
        configJson: { waitKind: "duration", durationSeconds: 3600 },
      }),
      certNode({ id: goalId, nodeType: "exit", configJson: { canvasNodeType: "goal" } }),
      certNode({ id: falseExitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e12",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: waitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e13",
        versionId: "version-1",
        fromNodeId: waitId,
        toNodeId: goalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e14",
        versionId: "version-1",
        fromNodeId: waitId,
        toNodeId: falseExitId,
        edgeType: "timeout",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    simulationInput: { scenario: "wait_timeout" },
  })
  assert.equal(timeoutWait.status, "simulated")
  assert.ok(timeoutWait.branchDecisions.some((decision) => decision.decision === "timeout"))
  console.log("  ✓ simulate timeout wait")

  assert.equal(linearGraph.approvalGates[0]?.requiresApproval, true)
  assert.equal(linearGraph.approvalGates[0]?.approved, false)
  console.log("  ✓ simulate approval gate")

  const badTrigger = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "unsupported.trigger" },
      }),
      certNode({ id: goalId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e15",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: goalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(badTrigger.status, "failed")
  console.log("  ✓ unsupported trigger failure")

  const badAction = simulateAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({ id: approvalId, nodeType: "approval" }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "unsupported_action" },
      }),
      certNode({ id: goalId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e16",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: approvalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e17",
        versionId: "version-1",
        fromNodeId: approvalId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e18",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: goalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(badAction.status, "failed")
  assert.ok(badAction.errors.some((issue) => issue.ruleCode === "unsupported_action"))
  console.log("  ✓ unsupported action failure")

  assert.ok(trueBranch.timeline.length >= 3)
  console.log("  ✓ timeline generation")

  const simulateRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/simulate/route.ts"),
    "utf8",
  )
  assert.ok(simulateRouteSource.includes("automationSimulationApiSafetyPayload"))
  console.log("  ✓ simulate route safety payload")

  for (const relativePath of GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!/\.from\(["']sequence_pattern/.test(source), `SR-3 write pattern in ${relativePath}`)
  }
  console.log("  ✓ no DB writes in simulation libs")
}

function runS5FLocalRegression(): void {
  console.log(`\n=== S5-F publish regression (${GROWTH_AUTOMATION_PUBLISH_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_PUBLISH_QA_MARKER, "growth-automation-publish-s5f-v1")
  assert.equal(GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.publish_metadata_only, true)
  assert.equal(GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.runtime_publish_enabled, false)
  assert.equal(GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.sr3_artifact_writes_enabled, false)
  console.log("  ✓ publish QA marker + safety flags")

  const { flow, version } = certFlow()
  const triggerId = "11111111-1111-4111-8111-111111111111"
  const approvalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const actionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const exitId = "22222222-2222-4222-8222-222222222222"

  const goodReadiness = evaluatePublishReadiness({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({ id: approvalId, nodeType: "approval" }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e1",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: approvalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e2",
        versionId: "version-1",
        fromNodeId: approvalId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e3",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(goodReadiness.ok, true)
  assert.equal(goodReadiness.publishReadiness, "ready")
  assert.equal(goodReadiness.requiresHumanReview, true)
  console.log("  ✓ publish readiness good graph")

  const validationBlocked = evaluatePublishReadiness({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
    ],
    edges: [],
  })
  assert.equal(validationBlocked.ok, false)
  assert.ok(validationBlocked.publishErrors.some((issue) => issue.ruleCode === "validation_blocked"))
  console.log("  ✓ publish blocked by validation error")

  const compilerBlocked = evaluatePublishReadiness({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e4",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e5",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(compilerBlocked.ok, false)
  assert.ok(compilerBlocked.publishErrors.some((issue) => issue.ruleCode === "compiler_blocked"))
  console.log("  ✓ publish blocked by compiler error")

  const simulationBlocked = evaluatePublishReadiness({
    flow,
    version,
    nodes: [
      certNode({
        id: triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({ id: approvalId, nodeType: "approval" }),
      certNode({
        id: actionId,
        nodeType: "action",
        configJson: { actionType: "unsupported_action" },
      }),
      certNode({ id: exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e6",
        versionId: "version-1",
        fromNodeId: triggerId,
        toNodeId: approvalId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e7",
        versionId: "version-1",
        fromNodeId: approvalId,
        toNodeId: actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e8",
        versionId: "version-1",
        fromNodeId: actionId,
        toNodeId: exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  assert.equal(simulationBlocked.ok, false)
  assert.ok(simulationBlocked.publishErrors.some((issue) => issue.ruleCode === "simulation_blocked"))
  console.log("  ✓ publish blocked by simulation error")

  assert.equal(goodReadiness.compileSummary?.status, "compiled")
  assert.ok(goodReadiness.compileId)
  console.log("  ✓ publish marks compile preview metadata")

  assert.throws(() => assertPublishedVersionImmutable({ lifecycle: "published" }))
  assert.doesNotThrow(() => assertPublishedVersionImmutable({ lifecycle: "draft" }))
  console.log("  ✓ immutable published version guard")

  const publishRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/publish/route.ts"),
    "utf8",
  )
  assert.ok(publishRouteSource.includes("automationPublishApiSafetyPayload"))
  console.log("  ✓ publish route safety payload")

  for (const relativePath of GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!/\.from\(["']sequence_pattern/.test(source), `SR-3 write pattern in ${relativePath}`)
  }
  console.log("  ✓ no SR-3 writes in publish libs")
}

function certPublishableGraph(): {
  triggerId: string
  approvalId: string
  actionId: string
  exitId: string
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
} {
  const triggerId = "11111111-1111-4111-8111-111111111111"
  const approvalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const actionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const exitId = "22222222-2222-4222-8222-222222222222"
  const nodes = [
    certNode({
      id: triggerId,
      nodeType: "trigger",
      configJson: { triggerSource: "share_page.viewed" },
    }),
    certNode({ id: approvalId, nodeType: "approval" }),
    certNode({
      id: actionId,
      nodeType: "action",
      configJson: { actionType: "send_email" },
    }),
    certNode({ id: exitId, nodeType: "exit" }),
  ]
  const edges = [
    {
      id: "e1",
      versionId: "version-1",
      fromNodeId: triggerId,
      toNodeId: approvalId,
      edgeType: "default",
      priority: 0,
      conditionId: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e2",
      versionId: "version-1",
      fromNodeId: approvalId,
      toNodeId: actionId,
      edgeType: "default",
      priority: 0,
      conditionId: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e3",
      versionId: "version-1",
      fromNodeId: actionId,
      toNodeId: exitId,
      edgeType: "default",
      priority: 0,
      conditionId: null,
      createdAt: "",
      updatedAt: "",
    },
  ]
  return { triggerId, approvalId, actionId, exitId, nodes, edges }
}

function runS5GLocalRegression(): void {
  console.log(`\n=== S5-G runtime reconciliation regression (${GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER, "growth-automation-runtime-reconciliation-s5g-v1")
  assert.equal(GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.reconciliation_preview_only, true)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.sr3_artifact_writes_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.runtime_publish_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.no_notifications, true)
  console.log("  ✓ runtime reconciliation QA marker + safety flags")

  const { flow, version } = certFlow()
  const graph = certPublishableGraph()

  const firstPublish = reconcileAutomationRuntimePreview({
    flow,
    candidateVersion: version,
    candidateNodes: graph.nodes,
    candidateEdges: graph.edges,
  })
  assert.equal(firstPublish.status, "previewed")
  assert.ok(firstPublish.createPlan.length > 0)
  assert.ok(firstPublish.artifactPreview)
  assert.equal(firstPublish.artifactPreview?.previewOnly, true)
  assert.ok(firstPublish.rollbackPlan.length > 0)
  console.log("  ✓ first publish preview creates artifact plan")

  const noopDiff = computeRuntimeReconciliationDiff({
    baselineNodes: graph.nodes,
    baselineEdges: graph.edges,
    candidateNodes: graph.nodes,
    candidateEdges: graph.edges,
  })
  assert.equal(noopDiff.riskLevel, "low")
  assert.equal(noopDiff.nodesAdded.length, 0)
  assert.equal(noopDiff.nodesRemoved.length, 0)
  console.log("  ✓ no-op diff returns low risk")

  const noopReconciliation = reconcileAutomationRuntimePreview({
    flow: { ...flow, publishedVersionId: "published-version-1" },
    candidateVersion: { ...version, id: "candidate-version-2" },
    candidateNodes: graph.nodes,
    candidateEdges: graph.edges,
    previousPublishedVersion: { ...version, id: "published-version-1", lifecycle: "published" },
    previousNodes: graph.nodes,
    previousEdges: graph.edges,
  })
  assert.equal(noopReconciliation.diff.riskLevel, "low")
  assert.equal(noopReconciliation.status, "previewed")
  console.log("  ✓ identical published graph reconciliation stays low risk")

  const triggerChangedNodes = graph.nodes.map((node) =>
    node.nodeType === "trigger"
      ? certNode({
          ...node,
          configJson: { triggerSource: "email.replied" },
        })
      : node,
  )
  const triggerChanged = reconcileAutomationRuntimePreview({
    flow: { ...flow, publishedVersionId: "published-version-1" },
    candidateVersion: { ...version, id: "candidate-version-3" },
    candidateNodes: triggerChangedNodes,
    candidateEdges: graph.edges,
    previousPublishedVersion: { ...version, id: "published-version-1", lifecycle: "published" },
    previousNodes: graph.nodes,
    previousEdges: graph.edges,
  })
  assert.equal(triggerChanged.status, "blocked")
  assert.equal(triggerChanged.diff.riskLevel, "blocked")
  assert.ok(triggerChanged.errors.some((issue) => issue.ruleCode === "trigger_source_changed"))
  console.log("  ✓ changed trigger on published flow blocks preview")

  const sendWithoutApprovalNodes = [
    certNode({
      id: graph.triggerId,
      nodeType: "trigger",
      configJson: { triggerSource: "share_page.viewed" },
    }),
    certNode({
      id: graph.actionId,
      nodeType: "action",
      configJson: { actionType: "send_email" },
    }),
    certNode({ id: graph.exitId, nodeType: "exit" }),
  ]
  const sendWithoutApprovalEdges = [
    {
      id: "e4",
      versionId: "version-1",
      fromNodeId: graph.triggerId,
      toNodeId: graph.actionId,
      edgeType: "default",
      priority: 0,
      conditionId: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e5",
      versionId: "version-1",
      fromNodeId: graph.actionId,
      toNodeId: graph.exitId,
      edgeType: "default",
      priority: 0,
      conditionId: null,
      createdAt: "",
      updatedAt: "",
    },
  ]
  const blockedSend = reconcileAutomationRuntimePreview({
    flow,
    candidateVersion: version,
    candidateNodes: sendWithoutApprovalNodes,
    candidateEdges: sendWithoutApprovalEdges,
  })
  assert.equal(blockedSend.status, "blocked")
  assert.equal(blockedSend.diff.riskLevel, "blocked")
  assert.ok(blockedSend.errors.some((issue) => issue.ruleCode === "send_action_missing_approval"))
  console.log("  ✓ send action without approval blocks preview")

  const removedNodeDiff = computeRuntimeReconciliationDiff({
    baselineNodes: graph.nodes,
    baselineEdges: graph.edges,
    candidateNodes: graph.nodes.filter((node) => node.nodeType !== "approval"),
    candidateEdges: graph.edges.filter((edge) => edge.fromNodeId !== graph.approvalId && edge.toNodeId !== graph.approvalId),
  })
  assert.ok(removedNodeDiff.nodesRemoved.length > 0)
  const cleanupPreview = reconcileAutomationRuntimePreview({
    flow: { ...flow, publishedVersionId: "published-version-1" },
    candidateVersion: { ...version, id: "candidate-version-4" },
    candidateNodes: graph.nodes.filter((node) => node.nodeType !== "approval"),
    candidateEdges: graph.edges.filter((edge) => edge.fromNodeId !== graph.approvalId && edge.toNodeId !== graph.approvalId),
    previousPublishedVersion: { ...version, id: "published-version-1", lifecycle: "published" },
    previousNodes: graph.nodes,
    previousEdges: graph.edges,
  })
  assert.ok(cleanupPreview.cleanupPlan.length > 0)
  assert.ok(cleanupPreview.rollbackPlan.length > 0)
  console.log("  ✓ cleanup + rollback plans generated")

  const runtimePreviewRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/runtime-preview/route.ts"),
    "utf8",
  )
  assert.ok(runtimePreviewRouteSource.includes("automationRuntimeReconciliationApiSafetyPayload"))
  console.log("  ✓ runtime preview route safety payload")

  for (const relativePath of GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!/\.from\(["']sequence_pattern/.test(source), `SR-3 write pattern in ${relativePath}`)
  }
  console.log("  ✓ no SR-3 writes in runtime reconciliation libs")
}

function runS5HLocalRegression(): void {
  console.log(`\n=== S5-H runtime publisher regression (${GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER, "growth-automation-runtime-publisher-s5h-v1")
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.runtime_publish_enabled, true)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.runtime_activation_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.sequence_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.notifications_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.requires_human_review, true)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.no_autonomous_enrollment, true)
  console.log("  ✓ runtime publisher QA marker + safety flags")

  const { flow, version } = certFlow()
  const graph = certPublishableGraph()
  const publishedVersion = { ...version, lifecycle: "published" as const }
  const reconciliation = reconcileAutomationRuntimePreview({
    flow,
    candidateVersion: publishedVersion,
    candidateNodes: graph.nodes,
    candidateEdges: graph.edges,
  })
  const compile = compileAutomationFlowGraph({
    flow,
    version: publishedVersion,
    nodes: graph.nodes,
    edges: graph.edges,
  })

  const publishReady = validateRuntimePublishGates({
    reconciliation,
    compile,
    version: publishedVersion,
  })
  assert.equal(publishReady.length, 0)
  console.log("  ✓ publish gates pass for published cert graph")

  const draftBlocked = validateRuntimePublishGates({
    reconciliation,
    compile,
    version,
  })
  assert.ok(draftBlocked.includes("version_not_published"))
  console.log("  ✓ draft version blocks runtime publish")

  const sendWithoutApproval = reconcileAutomationRuntimePreview({
    flow,
    candidateVersion: version,
    candidateNodes: [
      certNode({
        id: graph.triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({
        id: graph.actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: graph.exitId, nodeType: "exit" }),
    ],
    candidateEdges: [
      {
        id: "e4",
        versionId: "version-1",
        fromNodeId: graph.triggerId,
        toNodeId: graph.actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e5",
        versionId: "version-1",
        fromNodeId: graph.actionId,
        toNodeId: graph.exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  const blockedCompile = compileAutomationFlowGraph({
    flow,
    version,
    nodes: [
      certNode({
        id: graph.triggerId,
        nodeType: "trigger",
        configJson: { triggerSource: "share_page.viewed" },
      }),
      certNode({
        id: graph.actionId,
        nodeType: "action",
        configJson: { actionType: "send_email" },
      }),
      certNode({ id: graph.exitId, nodeType: "exit" }),
    ],
    edges: [
      {
        id: "e4",
        versionId: "version-1",
        fromNodeId: graph.triggerId,
        toNodeId: graph.actionId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e5",
        versionId: "version-1",
        fromNodeId: graph.actionId,
        toNodeId: graph.exitId,
        edgeType: "default",
        priority: 0,
        conditionId: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
  })
  const blockedPublish = validateRuntimePublishGates({
    reconciliation: sendWithoutApproval,
    compile: blockedCompile,
    version: publishedVersion,
  })
  assert.ok(blockedPublish.includes("reconciliation_blocked_risk"))
  console.log("  ✓ send without approval blocks runtime publish")

  assert.equal(
    buildAutomationPatternKey({ flowId: flow.id, versionNumber: publishedVersion.versionNumber }),
    `automation:${flow.id}:v${publishedVersion.versionNumber}`,
  )
  assert.equal(
    resolveEffectiveFlowStatus({ flowStatus: "published", activationStatus: "active" }),
    "runtime_active",
  )
  assert.equal(
    resolveEffectiveFlowStatus({ flowStatus: "published", activationStatus: "paused" }),
    "runtime_paused",
  )
  console.log("  ✓ pattern key + effective flow status mapping")

  assert.ok(
    validateRuntimeActivationGates({
      metadata: {
        qaMarker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
        activationStatus: "published",
        compiledPatternId: "pattern-1",
        compiledVersionId: publishedVersion.id,
        publishedArtifactVersion: 1,
        lastPublishedAt: new Date().toISOString(),
        lastActivatedAt: null,
        lastPausedAt: null,
        reconciliationId: reconciliation.reconciliationId,
        compileId: compile.compileId,
        requiresHumanReview: true,
        executionEnabled: false,
        runtimeStats: null,
        publishHistory: [],
      },
      patternId: "pattern-1",
    }).length === 0,
  )
  console.log("  ✓ activation readiness requires published metadata + pattern id")

  const runtimePublishRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/runtime-publish/route.ts"),
    "utf8",
  )
  assert.ok(runtimePublishRouteSource.includes("automationRuntimePublisherApiSafetyPayload"))
  console.log("  ✓ runtime publish route safety payload")

  const publisherServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-runtime-publisher-service.ts"),
    "utf8",
  )
  assert.ok(publisherServiceSource.includes('from("sequence_patterns")'))
  assert.ok(publisherServiceSource.includes("sequence_pattern_steps"))
  assert.ok(!/queueSequenceStepTransportJob/.test(publisherServiceSource))
  assert.ok(!/emitGrowthNotification/.test(publisherServiceSource))
  console.log("  ✓ SR-3 writes present; execution patterns absent")
}

function runS5ILocalRegression(): void {
  console.log(`\n=== S5-I enrollment engine regression (${GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER, "growth-automation-enrollment-s5i-v1")
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.runtime_publish_enabled, true)
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.runtime_activation_enabled, true)
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.enrollment_execution_enabled, true)
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.sequence_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.notifications_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.requires_human_review, true)
  console.log("  ✓ enrollment QA marker + safety flags")

  assert.ok(isSupportedAutomationEnrollmentTrigger("manual.enrollment"))
  assert.ok(isSupportedAutomationEnrollmentTrigger("media.viewed"))
  assert.ok(isSupportedAutomationEnrollmentTrigger("high_intent.detected"))
  assert.ok(!isSupportedAutomationEnrollmentTrigger("share_page.viewed"))
  console.log("  ✓ supported trigger allowlist")

  assert.deepEqual(normalizeAutomationTriggerInput({ triggerSource: "manual.enrollment" }), {
    triggerSource: "manual.enrollment",
    triggerEvent: null,
  })
  assert.deepEqual(normalizeAutomationTriggerInput({ triggerSource: "media.viewed" }), {
    triggerSource: "media.viewed",
    triggerEvent: "media.viewed",
  })
  console.log("  ✓ trigger normalization")

  assert.ok(
    triggerMatchesRuntimePattern({
      patternTriggerKey: "manual.enrollment",
      requestedTriggerSource: "manual.enrollment",
    }),
  )
  assert.ok(
    triggerMatchesRuntimePattern({
      patternTriggerKey: "media.viewed",
      requestedTriggerSource: "media.viewed",
    }),
  )
  assert.ok(
    !triggerMatchesRuntimePattern({
      patternTriggerKey: "manual.enrollment",
      requestedTriggerSource: "media.viewed",
    }),
  )
  console.log("  ✓ trigger matcher rules")

  const metadata = buildAutomationEnrollmentMetadata({
    flowId: "flow-1",
    versionId: "version-1",
    triggerSource: "manual.enrollment",
    triggerEvent: null,
    entryReason: "cert",
  })
  assert.equal(metadata.qa_marker, GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER)
  assert.equal(metadata.execution_enabled, false)
  console.log("  ✓ enrollment metadata carries QA marker + execution disabled")

  const enrollRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/enroll/route.ts"),
    "utf8",
  )
  assert.ok(enrollRouteSource.includes("automationEnrollmentApiSafetyPayload"))
  console.log("  ✓ enroll route safety payload")

  const matcherSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-trigger-matcher.ts"),
    "utf8",
  )
  assert.ok(!/insertGrowthSequenceEnrollment/.test(matcherSource))
  assert.ok(!/confirmGrowthSequenceEnrollment/.test(matcherSource))
  console.log("  ✓ trigger matcher is read-only")

  const enrollmentServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-enrollment-service.ts"),
    "utf8",
  )
  assert.ok(enrollmentServiceSource.includes("insertGrowthSequenceEnrollment"))
  assert.ok(enrollmentServiceSource.includes("insertGrowthSequenceEnrollmentStep"))
  assert.ok(enrollmentServiceSource.includes("fetchGrowthSequenceEnrollmentForLeadAndPattern"))
  assert.ok(!/confirmGrowthSequenceEnrollment/.test(enrollmentServiceSource))
  assert.ok(!/queueSequenceStepTransportJob/.test(enrollmentServiceSource))
  assert.ok(!/emitGrowthNotification/.test(enrollmentServiceSource))
  console.log("  ✓ SR-3 enrollment writes present; execution patterns absent")
}

function runS5JLocalRegression(): void {
  console.log(`\n=== S5-J runtime execution regression (${GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER, "growth-automation-runtime-execution-s5j-v1")
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.runtime_execution_enabled, true)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.sequence_progression_enabled, true)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.message_send_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.notifications_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.autonomous_approval_enabled, false)
  assert.equal(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.requires_human_review, true)
  console.log("  ✓ runtime execution QA marker + safety flags")

  assert.equal(classifyAutomationRuntimeStep({ generationType: "trigger", channel: null, stepOrder: 1 }), "trigger")
  assert.equal(classifyAutomationRuntimeStep({ generationType: "approval", channel: null, stepOrder: 2 }), "approval")
  assert.equal(classifyAutomationRuntimeStep({ generationType: "send_email", channel: "email", stepOrder: 3 }), "action")
  assert.equal(classifyAutomationRuntimeStep({ generationType: "wait", channel: null, stepOrder: 4 }), "wait")
  assert.equal(classifyAutomationRuntimeStep({ generationType: "exit", channel: null, stepOrder: 5 }), "exit")
  console.log("  ✓ runtime step classification")

  assert.deepEqual(
    resolveAutomationRuntimeCurrentStep({
      currentStepOrder: 1,
      steps: [
        { id: "s1", stepOrder: 1, status: "executed" },
        { id: "s2", stepOrder: 2, status: "pending" },
      ],
    })?.id,
    "s2",
  )
  assert.ok(isTerminalAutomationRuntimeStatus("approval_required"))
  assert.ok(isTerminalAutomationRuntimeStatus("waiting"))
  console.log("  ✓ current step resolution + terminal statuses")

  const advanceRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/runtime/advance/route.ts"),
    "utf8",
  )
  assert.ok(advanceRouteSource.includes("automationRuntimeExecutionApiSafetyPayload"))
  console.log("  ✓ runtime advance route safety payload")

  const orchestratorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-runtime-orchestrator.ts"),
    "utf8",
  )
  assert.ok(orchestratorSource.includes("advanceGrowthSequenceEnrollmentAfterStep"))
  assert.ok(orchestratorSource.includes("createAutomationApprovalGate"))
  assert.ok(orchestratorSource.includes("createSequenceExecutionJob"))
  assert.ok(!/runSequenceExecutionJob/.test(orchestratorSource))
  assert.ok(!/queueSequenceStepTransportJob/.test(orchestratorSource))
  assert.ok(!/materializeGrowthSequenceEnrollmentStep/.test(orchestratorSource))
  assert.ok(!/emitGrowthNotification/.test(orchestratorSource))
  console.log("  ✓ SR-3 progression primitives present; forbidden execution absent")
}

function runS5KLocalRegression(): void {
  console.log(`\n=== S5-K operator approval regression (${GROWTH_AUTOMATION_APPROVAL_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_APPROVAL_QA_MARKER, "growth-automation-approval-s5k-v1")
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.approval_execution_enabled, true)
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.message_send_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.notifications_enabled, false)
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.autonomous_approval_enabled, false)
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.requires_human_review, true)
  assert.equal(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS.approved_job_execution_enabled, false)
  console.log("  ✓ approval QA marker + safety flags")

  assert.equal(resolveApprovalActionType({ gate: { gateId: "g1" } as never }), "approval_gate")
  assert.equal(resolveApprovalActionType({ job: { channel: "email" } as never }), "send_email")
  assert.equal(resolveApprovalRiskLevel("send_sms"), "high")
  console.log("  ✓ approval action + risk classification")

  const extracted = extractPendingApprovalsFromEnrollmentMetadata({
    metadata: {
      automation_flow_id: "flow-1",
      automation_version_id: "version-1",
      automation_execution: {
        approval_gates: [
          {
            gateId: "gate-1",
            enrollmentId: "enroll-1",
            enrollmentStepId: "step-1",
            stepOrder: 2,
            status: "pending",
            requiredHumanApproval: true,
            executionEnabled: false,
            entryReason: "Cert gate",
            createdAt: "2026-06-16T00:00:00.000Z",
          },
        ],
        pending_jobs: [
          {
            jobId: "job-1",
            enrollmentId: "enroll-1",
            enrollmentStepId: "step-2",
            stepOrder: 3,
            channel: "email",
            status: "pending_approval",
            executionEnabled: false,
            requiresHumanApproval: true,
            createdAt: "2026-06-16T00:00:01.000Z",
          },
        ],
      },
    },
    flowId: "flow-1",
    versionId: "version-1",
    enrollmentId: "enroll-1",
    leadId: "lead-1",
    leadLabel: "Cert Lead",
  })
  assert.equal(extracted.length, 2)
  assert.equal(extracted[0]?.actionType, "approval_gate")
  assert.equal(extracted[1]?.actionType, "send_email")
  assert.ok(buildApprovalPreview({
    actionType: "send_email",
    stepOrder: 3,
    stepKind: "action",
    channel: "email",
    leadLabel: "Cert Lead",
    entryReason: null,
  }).sendBlocked)
  console.log("  ✓ approval extraction from S5-J metadata")

  for (const relativePath of S5K_APPROVAL_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing ${relativePath}`)
  }
  console.log("  ✓ approval module/route/UI manifests")

  const approveRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/approvals/[approvalId]/approve/route.ts"),
    "utf8",
  )
  assert.ok(approveRouteSource.includes("automationApprovalApiSafetyPayload"))
  console.log("  ✓ approval route safety payload")

  const approvalServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-approval-service.ts"),
    "utf8",
  )
  assert.ok(approvalServiceSource.includes("updateSequenceExecutionJob"))
  assert.ok(approvalServiceSource.includes("resumeAutomationAfterApproval"))
  assert.ok(!/runSequenceExecutionJob/.test(approvalServiceSource))
  assert.ok(!/queueSequenceStepTransportJob/.test(approvalServiceSource))
  assert.ok(!/emitGrowthNotification/.test(approvalServiceSource))
  assert.ok(!/approveSequenceExecutionJob/.test(approvalServiceSource))
  console.log("  ✓ approval service metadata transitions; forbidden execution absent")
}

function runS5LLocalRegression(): void {
  console.log(`\n=== S5-L runtime observability regression (${GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER, "growth-automation-observability-s5l-v1")
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.observability_enabled, true)
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.management_controls_enabled, true)
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.message_send_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.notifications_enabled, false)
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.autonomous_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.requires_human_review, true)
  console.log("  ✓ observability QA marker + safety flags")

  const enrollment = buildEnrollmentSnapshot({
    id: "enroll-1",
    lead_id: "lead-1",
    status: "active",
    current_step_order: 2,
    enrollment_stalled: true,
    updated_at: "2026-06-16T00:00:00.000Z",
    metadata: {
      automation_flow_id: "flow-1",
      automation_execution: { last_status: "approval_required", pending_jobs: [{ status: "pending_approval" }] },
    },
  })
  assert.equal(enrollment.runtimeStatus, "approval_required")

  const stuckWaits = detectStuckWaits([
    {
      id: "wait-1",
      enrollment_id: "enroll-1",
      enrollment_step_id: "step-1",
      wait_kind: "duration",
      status: "waiting",
      timeout_at: "2020-01-01T00:00:00.000Z",
      started_at: "2020-01-01T00:00:00.000Z",
    },
  ])
  assert.equal(stuckWaits.length, 1)

  const counts = aggregateRuntimeCounts({
    enrollments: [enrollment],
    jobs: [
      {
        jobId: "job-1",
        enrollmentId: "enroll-1",
        leadId: "lead-1",
        channel: "email",
        status: "approved",
        scheduledFor: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ],
    stuckWaits,
    failures: [],
  })
  assert.equal(counts.approvedButNotExecutedJobs, 1)
  assert.equal(counts.stuckWaits, 1)

  const health = calculateRuntimeHealth({
    counts,
    runtimeStatus: "runtime_active",
    activationStatus: "active",
    killSwitch: readRuntimeKillSwitch(null),
  })
  assert.equal(health.state, "degraded")

  const activity = formatRecentActivityEntries({
    enrollments: [enrollment],
    jobs: [],
    stuckWaits,
    failures: [],
    limit: 5,
  })
  assert.ok(activity.length >= 1)
  assert.equal(isRuntimeKillSwitchEnabled({ killSwitch: { enabled: true, reason: "x", enabledAt: null, enabledBy: null } } as never), true)
  console.log("  ✓ counts, health, stuck waits, activity formatting")

  for (const relativePath of S5L_OBSERVABILITY_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing ${relativePath}`)
  }
  console.log("  ✓ observability module/route/UI manifests")

  const observabilityRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/observability/route.ts"),
    "utf8",
  )
  assert.ok(observabilityRouteSource.includes("automationObservabilityApiSafetyPayload"))
  console.log("  ✓ observability route safety payload")

  const observabilityServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-observability-service.ts"),
    "utf8",
  )
  assert.ok(observabilityServiceSource.includes("getAutomationRuntimeObservability"))
  assert.ok(observabilityServiceSource.includes("safeCancelAutomationEnrollment"))
  assert.ok(!/runSequenceExecutionJob/.test(observabilityServiceSource))
  assert.ok(!/emitGrowthNotification/.test(observabilityServiceSource))
  console.log("  ✓ observability service read/management paths; forbidden execution absent")
}

function runS5MLocalRegression(): void {
  console.log(`\n=== S5-M automation analytics regression (${GROWTH_AUTOMATION_ANALYTICS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_AUTOMATION_ANALYTICS_QA_MARKER, "growth-automation-analytics-s5m-v1")
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.analytics_enabled, true)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.audit_enabled, true)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.read_only, true)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.message_send_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.notifications_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.autonomous_execution_enabled, false)
  assert.equal(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.requires_human_review, true)
  console.log("  ✓ analytics QA marker + safety flags")

  const enrollmentRows = [
    {
      id: "enroll-1",
      lead_id: "lead-1",
      status: "active",
      current_step_order: 2,
      enrollment_stalled: false,
      created_at: "2026-06-16T00:00:00.000Z",
      updated_at: "2026-06-16T01:00:00.000Z",
      metadata: {
        automation_flow_id: "flow-1",
        entry_reason: "duplicate enrollment attempt",
        automation_execution: { last_status: "waiting" },
      },
    },
    {
      id: "enroll-2",
      lead_id: "lead-1",
      status: "completed",
      current_step_order: 4,
      enrollment_stalled: false,
      created_at: "2026-06-16T00:00:00.000Z",
      updated_at: "2026-06-16T02:00:00.000Z",
      metadata: {
        automation_flow_id: "flow-1",
        automation_execution: { last_status: "completed" },
      },
    },
  ]
  const enrollments = mapEnrollmentRowsToSnapshots(enrollmentRows)
  const counts = aggregateAnalyticsCounts({ enrollmentRows, enrollments })
  assert.equal(counts.totalEnrollments, 2)
  assert.equal(counts.duplicateEnrollments, 1)
  assert.equal(counts.completedEnrollments, 1)

  const branchStats = aggregateBranchStats([
    {
      id: "decision-1",
      enrollmentId: "enroll-1",
      enrollmentStepId: "step-1",
      patternStepId: "pattern-1",
      conditionId: "cond-1",
      edgeId: "edge-1",
      decision: "true",
      dslVersion: 1,
      source: "email",
      event: "email.replied",
      outcomeDetail: null,
      evaluatedAt: "2026-06-16T01:00:00.000Z",
      createdAt: "2026-06-16T00:59:00.000Z",
    },
  ])
  assert.equal(branchStats.length, 1)
  assert.equal(branchStats[0]?.trueCount, 1)

  const waitStats = aggregateWaitStats([
    {
      id: "wait-1",
      enrollment_id: "enroll-1",
      enrollment_step_id: "step-1",
      pattern_step_id: "pattern-wait-1",
      wait_kind: "duration",
      status: "resolved",
      started_at: "2026-06-16T00:00:00.000Z",
      resolved_at: "2026-06-16T01:00:00.000Z",
      updated_at: "2026-06-16T01:00:00.000Z",
    },
  ])
  assert.equal(waitStats.length, 1)
  assert.equal(waitStats[0]?.resolvedCount, 1)

  const approvalStats = aggregateApprovalStats([
    {
      approvalId: "approval-1",
      flowId: "flow-1",
      versionId: "version-1",
      enrollmentId: "enroll-1",
      leadId: "lead-1",
      stepId: "step-1",
      jobId: null,
      actionType: "approval_gate",
      status: "approved",
      requestedBy: "operator@example.com",
      reviewedBy: "reviewer@example.com",
      reviewNote: null,
      previewPayload: {
        summary: "Gate",
        stepOrder: 2,
        stepKind: "approval",
        channel: null,
        leadLabel: "Lead",
        entryReason: "manual",
        executionBlocked: true,
        sendBlocked: true,
      },
      riskLevel: "medium",
      createdAt: "2026-06-16T00:00:00.000Z",
      reviewedAt: "2026-06-16T01:00:00.000Z",
      updatedAt: "2026-06-16T01:00:00.000Z",
      safety: {
        approval_execution_enabled: true,
        message_send_execution_enabled: false,
        provider_execution_enabled: false,
        notifications_enabled: false,
        autonomous_approval_enabled: false,
        requires_human_review: true,
        approved_job_execution_enabled: false,
        no_message_sends: true,
        no_provider_execution: true,
        no_notifications: true,
        no_autonomous_approval: true,
        no_background_jobs: true,
      },
    },
  ])
  assert.equal(approvalStats.approvedCount, 1)

  const jobStats = aggregateJobStats({
    jobs: [
      {
        jobId: "job-1",
        enrollmentId: "enroll-1",
        leadId: "lead-1",
        channel: "email",
        status: "pending_approval",
        scheduledFor: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ],
    enrollmentRows,
  })
  assert.equal(jobStats.pendingApprovalCount, 1)

  const bottlenecks = detectTopBottlenecks({
    waitRows: [],
    approvals: [],
    jobs: jobStats.pendingApprovalCount
      ? [
          {
            jobId: "job-1",
            enrollmentId: "enroll-1",
            leadId: "lead-1",
            channel: "email",
            status: "pending_approval",
            scheduledFor: "2026-06-16T00:00:00.000Z",
            updatedAt: "2026-06-16T00:00:00.000Z",
          },
        ]
      : [],
    enrollmentRows,
    runtimeStatus: "runtime_paused",
    metadata: {
      qaMarker: "growth-automation-runtime-publisher-s5h-v1",
      activationStatus: "paused",
      compiledPatternId: "pattern-1",
      compiledVersionId: "version-1",
      publishedArtifactVersion: 1,
      lastPublishedAt: null,
      lastActivatedAt: null,
      lastPausedAt: "2026-06-16T00:00:00.000Z",
      reconciliationId: null,
      compileId: null,
      requiresHumanReview: true,
      executionEnabled: false,
      runtimeStats: null,
      publishHistory: [],
    },
  })
  assert.ok(bottlenecks.some((entry) => entry.kind === "paused_runtime"))
  assert.ok(bottlenecks.some((entry) => entry.kind === "pending_jobs"))

  const timeline = buildAnalyticsTimeline({
    enrollmentRows,
    jobs: [],
    waitRows: [],
    approvals: [],
    limit: 5,
  })
  assert.ok(timeline.length >= 1)
  console.log("  ✓ counts, branch/wait/approval/job stats, bottlenecks, timeline")

  for (const relativePath of S5M_ANALYTICS_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing ${relativePath}`)
  }
  console.log("  ✓ analytics module/route/UI manifests")

  const analyticsRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/automation/[id]/analytics/route.ts"),
    "utf8",
  )
  assert.ok(analyticsRouteSource.includes("automationAnalyticsApiSafetyPayload"))
  console.log("  ✓ analytics route safety payload")

  const analyticsServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-analytics-service.ts"),
    "utf8",
  )
  const auditServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/automation/growth-automation-audit-service.ts"),
    "utf8",
  )
  assert.ok(analyticsServiceSource.includes("getAutomationAnalytics"))
  assert.ok(auditServiceSource.includes("getAutomationAuditTimeline"))
  assert.ok(!/runSequenceExecutionJob/.test(analyticsServiceSource))
  assert.ok(!/queueSequenceStepTransportJob/.test(auditServiceSource))
  assert.ok(!/emitGrowthNotification/.test(analyticsServiceSource))
  assert.ok(!/approveSequenceExecutionJob/.test(analyticsServiceSource))
  assert.ok(!/materializeGrowthSequenceEnrollmentStep/.test(auditServiceSource))
  assert.ok(!/confirmGrowthSequenceEnrollment/.test(auditServiceSource))
  console.log("  ✓ analytics/audit read-only services; forbidden execution absent")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  process.env.GROWTH_AUTOMATION_BUILDER_CERT_ALLOW_LOCAL =
    process.env.GROWTH_AUTOMATION_BUILDER_CERT_ALLOW_LOCAL ?? "1"

  const boot = bootstrapGrowthAutomationBuilderCertEnv()
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  process.env.NEXT_PUBLIC_SUPABASE_URL = boot.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || boot.jwt

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthAutomationBuilderDiagnostics } = await import(
    "../lib/growth/automation/growth-automation-diagnostics"
  )
  return executeGrowthAutomationBuilderDiagnostics(admin)
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthAutomationBuilderCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return describeAutomationBuilderCertBootstrapFailure({ requireVercelProductionEnvRun: true })
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthAutomationBuilderProductionDiagnostics } = await import(
    "../lib/growth/automation/growth-automation-production-diagnostics"
  )
  return executeGrowthAutomationBuilderProductionDiagnostics(admin)
}

async function main(): Promise<void> {
  const production = process.argv.includes("--production")
  const integration = process.argv.includes("--integration") || production
  runLocalRegression()

  if (!integration) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
          hint: "Run pnpm test:growth-automation-builder:integration after applying migration locally",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = production ? await runProductionDiagnostics() : await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS" && report.final_verdict !== "SKIP") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
