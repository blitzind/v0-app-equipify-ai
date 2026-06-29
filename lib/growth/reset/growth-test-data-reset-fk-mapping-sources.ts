/** Maps reset preserved-FK columns to golden fixture fields (for reporting). */

export function getGoldenPreservedFkSourceLabel(fkColumn: string): string | null {
  switch (fkColumn) {
    case "lead_id":
      return "lead_ids"
    case "company_id":
      return "company_ids"
    case "opportunity_id":
      return "opportunity_ids"
    case "meeting_id":
      return "meeting_ids"
    case "thread_id":
    case "inbox_thread_id":
      return "inbox_thread_ids"
    case "enrollment_id":
      return "sequence_enrollment_ids"
    case "generation_id":
      return "generation_ids"
    case "person_id":
      return "person_ids"
    default:
      return null
  }
}
