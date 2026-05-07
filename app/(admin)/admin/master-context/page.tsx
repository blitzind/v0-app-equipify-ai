import { getEquipifyMasterContext, MASTER_CONTEXT_LAST_UPDATED_ISO } from "@/lib/admin/master-context"
import { MCG_SCAN_COUNTS } from "@/lib/admin/master-context.generated"
import { MasterContextDocClient } from "./master-context-doc-client"

export default function MasterContextPage() {
  return (
    <MasterContextDocClient
      initialMarkdown={getEquipifyMasterContext()}
      generatedAtIso={MASTER_CONTEXT_LAST_UPDATED_ISO}
      scanCounts={MCG_SCAN_COUNTS}
    />
  )
}
