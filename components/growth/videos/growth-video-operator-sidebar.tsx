"use client"

import type { GrowthVideoAutopilotInputSnapshot } from "@/lib/growth/videos/growth-video-autopilot-types"
import type {
  GrowthVideoOperatorWorkspaceActions,
  GrowthVideoOperatorWorkspaceOperatorState,
} from "@/lib/growth/videos/growth-video-operator-workspace-types"

function actionLabel(status: string): string {
  if (status === "completed") return "Done"
  if (status === "unavailable") return "Unavailable"
  return "Ready"
}

export function GrowthVideoOperatorSidebar({
  inputSnapshot,
  draftStatus,
  operatorState,
  actions,
  acting,
  onApproveDraft,
  onPublishPage,
  onQueueVoice,
  onQueueAvatar,
  onApproveAttachment,
  onDiscardDraft,
}: {
  inputSnapshot: GrowthVideoAutopilotInputSnapshot | null
  draftStatus: string
  operatorState: GrowthVideoOperatorWorkspaceOperatorState
  actions: GrowthVideoOperatorWorkspaceActions
  acting: boolean
  onApproveDraft: () => void
  onPublishPage: () => void
  onQueueVoice: () => void
  onQueueAvatar: () => void
  onApproveAttachment: () => void
  onDiscardDraft: () => void
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Lead context</h3>
        <dl className="mt-3 space-y-2 text-xs">
          <div>
            <dt className="font-medium text-muted-foreground">Contact</dt>
            <dd>{inputSnapshot?.contactName ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Company</dt>
            <dd>{inputSnapshot?.companyName ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Industry</dt>
            <dd>{inputSnapshot?.industry ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Fit / momentum</dt>
            <dd>
              {inputSnapshot?.fitScore ?? "—"} / {inputSnapshot?.momentumScore ?? "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Draft status</h3>
        <p className="mt-2 text-sm capitalize">{draftStatus.replace(/_/g, " ")}</p>
        {operatorState.draftApprovedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">Operator approved</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Operator actions</h3>
        <ActionButton
          label="Approve draft"
          status={actions.approveDraft}
          disabled={acting || actions.approveDraft !== "idle"}
          onClick={onApproveDraft}
        />
        <ActionButton
          label="Publish page"
          status={actions.publishPage}
          disabled={acting || actions.publishPage !== "idle"}
          onClick={onPublishPage}
        />
        <ActionButton
          label="Queue voice draft"
          status={actions.queueVoice}
          disabled={acting || actions.queueVoice !== "idle"}
          onClick={onQueueVoice}
        />
        <ActionButton
          label="Queue avatar draft"
          status={actions.queueAvatar}
          disabled={acting || actions.queueAvatar !== "idle"}
          onClick={onQueueAvatar}
        />
        <ActionButton
          label="Approve attachment"
          status={actions.approveAttachment}
          disabled={acting || actions.approveAttachment !== "idle"}
          onClick={onApproveAttachment}
        />
        <ActionButton
          label="Discard draft"
          status={actions.discardDraft}
          disabled={acting || actions.discardDraft !== "idle"}
          onClick={onDiscardDraft}
          variant="destructive"
        />
      </div>
    </div>
  )
}

function ActionButton({
  label,
  status,
  disabled,
  onClick,
  variant = "default",
}: {
  label: string
  status: string
  disabled: boolean
  onClick: () => void
  variant?: "default" | "destructive"
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${
        variant === "destructive" ? "border-destructive/40 text-destructive" : ""
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{label}</span>
      <span className="text-muted-foreground">{actionLabel(status)}</span>
    </button>
  )
}
