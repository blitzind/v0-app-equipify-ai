/** Pure helpers for sample reset work-order ID collection (testable). */

export function mergeSampleWorkOrderIds(
  sampleMarkedWorkOrderIds: string[],
  pmAutomationLinkedWorkOrderIds: string[],
): string[] {
  return [...new Set([...sampleMarkedWorkOrderIds, ...pmAutomationLinkedWorkOrderIds])]
}
