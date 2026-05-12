/**
 * Unit tests: prepared-workspace tier matrix (no DB).
 */
import assert from "node:assert/strict"
import {
  getMinimumPlanForPreparedWorkspaceAction,
  preparedWorkspaceActionAllowedByTierMatrix,
} from "../lib/aiden/prepared-workspace-tier-policy"

function assertCoreReadOnly() {
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "summarize_customer_history",
      storedPlanId: "core",
      trialActive: false,
    }),
    true,
  )
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "draft_customer_message",
      storedPlanId: "core",
      trialActive: false,
    }),
    true,
  )
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "create_invoice_from_work_order",
      storedPlanId: "core",
      trialActive: false,
    }),
    false,
  )
}

function assertSoloBlocks() {
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "summarize_customer_history",
      storedPlanId: "solo",
      trialActive: false,
    }),
    false,
  )
}

function assertGrowthOps() {
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "create_follow_up_task",
      storedPlanId: "growth",
      trialActive: false,
    }),
    true,
  )
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "create_invoice_from_work_order",
      storedPlanId: "growth",
      trialActive: false,
    }),
    false,
  )
}

function assertScaleFinancial() {
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "create_invoice_from_work_order",
      storedPlanId: "scale",
      trialActive: false,
    }),
    true,
  )
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "bulk_invoice_completed_work_orders",
      storedPlanId: "scale",
      trialActive: false,
    }),
    true,
  )
}

function assertTrialLikeScale() {
  assert.equal(
    preparedWorkspaceActionAllowedByTierMatrix({
      actionId: "bulk_invoice_completed_work_orders",
      storedPlanId: "solo",
      trialActive: true,
    }),
    true,
  )
}

function assertMinPlans() {
  assert.equal(getMinimumPlanForPreparedWorkspaceAction("summarize_customer_history"), "core")
  assert.equal(getMinimumPlanForPreparedWorkspaceAction("create_follow_up_task"), "growth")
  assert.equal(getMinimumPlanForPreparedWorkspaceAction("create_invoice_from_work_order"), "scale")
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "core read-only + draft comms", fn: assertCoreReadOnly },
  { name: "solo blocks all (non-trial)", fn: assertSoloBlocks },
  { name: "growth operational not financial", fn: assertGrowthOps },
  { name: "scale financial + bulk", fn: assertScaleFinancial },
  { name: "trial maps like scale", fn: assertTrialLikeScale },
  { name: "minimum plan labels", fn: assertMinPlans },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed) process.exit(1)
console.log(`\nAll ${tests.length} tests passed.`)
