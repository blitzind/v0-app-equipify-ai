/**
 * Unit tests: deterministic AIden prepared-workspace intent parser.
 * Run: pnpm test:aiden-intent-parser
 */
import assert from "node:assert/strict"
import { parseAidenPreparedWorkspaceIntent } from "../lib/aiden/intent/parse-aiden-intent"

function testInvoiceLatestCompletedForCustomer() {
  const r = parseAidenPreparedWorkspaceIntent(
    "Create an invoice from the latest completed work order for Acme LLC",
  )
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_invoice_from_work_order")
  assert.equal(r.workOrderReference, "latest_completed")
  assert.equal(r.customerReference, "acme llc")
  assert.deepEqual(r.missingFields, [])
  assert.ok(r.confidenceScore >= 0.8)
}

function testInvoiceLatestWorkOrderForCustomer() {
  const r = parseAidenPreparedWorkspaceIntent(
    "Make invoice for Jane Doe based on my last work order",
  )
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_invoice_from_work_order")
  assert.equal(r.workOrderReference, "latest")
  assert.equal(r.customerReference, "jane doe")
  assert.deepEqual(r.missingFields, [])
}

function testInvoiceFromLatestWoAlternatePhrasing() {
  const r = parseAidenPreparedWorkspaceIntent(
    "Create an invoice from the latest work order for Jane",
  )
  assert.equal(r.status, "prepared")
  assert.equal(r.workOrderReference, "latest")
  assert.equal(r.customerReference, "jane")
}

function testMissingCustomer() {
  const r = parseAidenPreparedWorkspaceIntent("Make invoice based on my last work order")
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "create_invoice_from_work_order")
  assert.ok(r.missingFields.includes("customerReference"))
  assert.equal(r.customerReference, undefined)
}

function testAmbiguousRequest() {
  const r = parseAidenPreparedWorkspaceIntent("I need an invoice please")
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "create_invoice_from_work_order")
  assert.ok(r.missingFields.includes("customerReference"))
  assert.ok(r.missingFields.includes("workOrderReference"))
}

function testAmbiguousMultipleIntentFamilies() {
  const r = parseAidenPreparedWorkspaceIntent("Make an invoice and make a quote for Acme")
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "")
  assert.ok(r.missingFields.includes("actionIntent"))
}

function testUnsupportedRequest() {
  const r = parseAidenPreparedWorkspaceIntent("What is the weather in Chicago?")
  assert.equal(r.status, "unsupported")
  assert.equal(r.actionId, "")
  assert.deepEqual(r.missingFields, [])
}

function testQuoteFromThisWorkOrder() {
  const r = parseAidenPreparedWorkspaceIntent("Make a quote from this work order", {
    sourceContext: {
      workOrderId: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
    },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_quote_from_work_order")
  assert.equal(r.workOrderReference, "11111111-1111-4111-8111-111111111111")
}

function testQuoteEstimateForCustomerLastVisit() {
  const r = parseAidenPreparedWorkspaceIntent("Make an estimate for Acme LLC based on the last visit")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_quote_from_work_order")
  assert.equal(r.customerReference, "acme llc")
  assert.equal(r.workOrderReference, "latest")
}

function testQuoteMissingContext() {
  const r = parseAidenPreparedWorkspaceIntent("Make a quote from this work order")
  assert.equal(r.status, "needs_clarification")
  assert.ok(r.missingFields.includes("workOrderId"))
}

function testDraftFollowUpThisCustomer() {
  const r = parseAidenPreparedWorkspaceIntent("Draft a follow-up message for this customer", {
    sourceContext: { customerId: "cust-1" },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "draft_customer_message")
}

function testSummarizeThisCustomer() {
  const r = parseAidenPreparedWorkspaceIntent("Summarize this customer's service history", {
    sourceContext: { customerId: "cust-2" },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "summarize_customer_history")
}

function testSummarizeCustomerSummaryPhrase() {
  const r = parseAidenPreparedWorkspaceIntent("Give me a customer summary for Acme LLC")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "summarize_customer_history")
  assert.equal(r.customerReference, "acme llc")
}

function testDraftInvoiceFromTheirLastJob() {
  const r = parseAidenPreparedWorkspaceIntent("Draft invoice for Contoso from their last job")
  assert.equal(r.status, "prepared")
  assert.equal(r.customerReference, "contoso")
  assert.equal(r.workOrderReference, "latest")
}

function testFollowUpTaskWithInvoiceContext() {
  const r = parseAidenPreparedWorkspaceIntent("Create a follow-up task to verify payment", {
    sourceContext: { invoiceId: "11111111-1111-4111-8111-111111111111" },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_follow_up_task")
}

function testFollowUpTaskForNamedCustomer() {
  const r = parseAidenPreparedWorkspaceIntent("Add a follow up task for Horizon Rentals")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_follow_up_task")
  assert.equal(r.customerReference, "horizon rentals")
}

function testFollowUpTaskThisCustomerNeedsContext() {
  const r = parseAidenPreparedWorkspaceIntent("Create follow-up task for this customer")
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "create_follow_up_task")
  assert.ok(r.missingFields.includes("customerId"))
}

function testScheduleMaintenanceWithPlanContext() {
  const r = parseAidenPreparedWorkspaceIntent("Schedule preventive maintenance visit", {
    sourceContext: { maintenancePlanId: "11111111-1111-4111-8111-111111111111" },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "schedule_maintenance_visit")
}

function testScheduleMaintenanceForCustomerPhrase() {
  const r = parseAidenPreparedWorkspaceIntent("Schedule maintenance visit for Acme Rentals")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "schedule_maintenance_visit")
  assert.equal(r.customerReference, "acme rentals")
}

const SAMPLE_EQUIPMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function testCreateMaintenancePlanFromEquipmentContext() {
  const r = parseAidenPreparedWorkspaceIntent("Create a quarterly maintenance plan", {
    sourceContext: { equipmentId: SAMPLE_EQUIPMENT_ID },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_maintenance_plan_from_equipment")
}

function testCreateMaintenancePlanPossessiveHint() {
  const r = parseAidenPreparedWorkspaceIntent("make a pm plan for acme llc's north pump")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_maintenance_plan_from_equipment")
  assert.equal(r.customerReference, "acme llc")
  assert.equal(r.equipmentReference, "north pump")
}

function testCreateMaintenancePlanThisCustomerNeedsEquipment() {
  const r = parseAidenPreparedWorkspaceIntent("maintenance plan for this customer", {
    sourceContext: { customerId: SAMPLE_EQUIPMENT_ID },
  })
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "create_maintenance_plan_from_equipment")
  assert.ok(r.missingFields.includes("equipmentId"))
}

const SAMPLE_WO_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function testPartsReorderThisWorkOrder() {
  const r = parseAidenPreparedWorkspaceIntent("reorder parts for this job", {
    sourceContext: { workOrderId: SAMPLE_WO_ID },
  })
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_parts_reorder_request")
}

function testPartsReorderLowStockPhrase() {
  const r = parseAidenPreparedWorkspaceIntent("show low stock for reorder center")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "create_parts_reorder_request")
}

function testPartsReorderNeedsAnchor() {
  const r = parseAidenPreparedWorkspaceIntent("reorder parts")
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "create_parts_reorder_request")
  assert.ok(r.missingFields.includes("workOrderId"))
}

function testBulkInvoiceCompletedYesterday() {
  const r = parseAidenPreparedWorkspaceIntent("For Acme LLC, invoice all completed work orders from yesterday")
  assert.equal(r.status, "prepared")
  assert.equal(r.actionId, "bulk_invoice_completed_work_orders")
  assert.ok(r.bulkInvoiceDateRange)
  assert.equal(r.customerReference, "acme llc")
}

function testBulkInvoiceNeedsDateRange() {
  const r = parseAidenPreparedWorkspaceIntent("Bulk invoice completed work orders for Acme LLC")
  assert.equal(r.status, "needs_clarification")
  assert.equal(r.actionId, "bulk_invoice_completed_work_orders")
  assert.ok(r.missingFields.includes("dateRange"))
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "invoice from latest completed work order", fn: testInvoiceLatestCompletedForCustomer },
  { name: "invoice from latest work order", fn: testInvoiceLatestWorkOrderForCustomer },
  { name: "invoice alternate phrasing latest WO for customer", fn: testInvoiceFromLatestWoAlternatePhrasing },
  { name: "missing customer", fn: testMissingCustomer },
  { name: "ambiguous invoice request", fn: testAmbiguousRequest },
  { name: "ambiguous multiple intent families", fn: testAmbiguousMultipleIntentFamilies },
  { name: "unsupported request", fn: testUnsupportedRequest },
  { name: "quote from this work order with context", fn: testQuoteFromThisWorkOrder },
  { name: "estimate for customer from last visit", fn: testQuoteEstimateForCustomerLastVisit },
  { name: "quote missing work order id", fn: testQuoteMissingContext },
  { name: "draft follow-up for this customer", fn: testDraftFollowUpThisCustomer },
  { name: "summarize this customer service history", fn: testSummarizeThisCustomer },
  { name: "customer summary phrase", fn: testSummarizeCustomerSummaryPhrase },
  { name: "draft invoice from their last job", fn: testDraftInvoiceFromTheirLastJob },
  { name: "follow-up task with invoice context", fn: testFollowUpTaskWithInvoiceContext },
  { name: "follow-up task for named customer", fn: testFollowUpTaskForNamedCustomer },
  { name: "follow-up task this customer needs customerId", fn: testFollowUpTaskThisCustomerNeedsContext },
  { name: "schedule maintenance with plan context", fn: testScheduleMaintenanceWithPlanContext },
  { name: "schedule maintenance visit for named customer", fn: testScheduleMaintenanceForCustomerPhrase },
  { name: "create maintenance plan with equipment context", fn: testCreateMaintenancePlanFromEquipmentContext },
  { name: "create maintenance plan possessive customer+equipment hint", fn: testCreateMaintenancePlanPossessiveHint },
  { name: "create maintenance plan this customer needs equipment", fn: testCreateMaintenancePlanThisCustomerNeedsEquipment },
  { name: "parts reorder with work order context", fn: testPartsReorderThisWorkOrder },
  { name: "parts reorder low stock phrase", fn: testPartsReorderLowStockPhrase },
  { name: "parts reorder needs anchor", fn: testPartsReorderNeedsAnchor },
  { name: "bulk invoice completed work orders yesterday", fn: testBulkInvoiceCompletedYesterday },
  { name: "bulk invoice needs date range", fn: testBulkInvoiceNeedsDateRange },
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

if (failed > 0) {
  process.exit(1)
}

console.log(`\nAll ${tests.length} tests passed.`)
