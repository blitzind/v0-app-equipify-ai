import { normalizeIndustryKey } from "../lib/demo-seeding/profiles"
import {
  assertIndustrySampleDataAuditConsistent,
  INDUSTRY_SAMPLE_DATA_AUDIT,
} from "../lib/demo-seeding/industry-sample-data-audit"

assertIndustrySampleDataAuditConsistent(normalizeIndustryKey)
console.log("industry sample data audit OK", "rows=", INDUSTRY_SAMPLE_DATA_AUDIT.length)
