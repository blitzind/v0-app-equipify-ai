import { getEquipifyMasterContext, MASTER_CONTEXT_LAST_UPDATED_ISO } from "@/lib/admin/master-context"
import { MasterContextDocClient } from "./master-context-doc-client"

export default function MasterContextPage() {
  return (
    <MasterContextDocClient
      initialMarkdown={getEquipifyMasterContext()}
      generatedAtIso={MASTER_CONTEXT_LAST_UPDATED_ISO}
    />
  )
}
