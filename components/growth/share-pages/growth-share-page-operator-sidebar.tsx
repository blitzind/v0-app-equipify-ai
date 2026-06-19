"use client"

import type {
  GrowthSharePageOperatorLeadContext,
  GrowthSharePageOperatorWorkspaceActions,
  GrowthSharePageOperatorWorkspaceOperatorState,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function formatWhen(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function actionLabel(status: string): string {
  if (status === "completed") return "Done"
  if (status === "unavailable") return "Unavailable"
  return "Ready"
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
      aria-label={label}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        variant === "destructive" ? "border-destructive/40 text-destructive" : ""
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{label}</span>
      <span className="text-muted-foreground">{actionLabel(status)}</span>
    </button>
  )
}

export function GrowthSharePageOperatorSidebar({
  leadContext,
  draftStatus,
  operatorState,
  actions,
  acting,
  onApproveDraft,
  onPublish,
  onDuplicate,
  onArchive,
  onRebuildPersonalization,
  onOpenPublicPage,
}: {
  leadContext: GrowthSharePageOperatorLeadContext
  draftStatus: string
  operatorState: GrowthSharePageOperatorWorkspaceOperatorState
  actions: GrowthSharePageOperatorWorkspaceActions
  acting: boolean
  onApproveDraft: () => void
  onPublish: () => void
  onDuplicate: () => void
  onArchive: () => void
  onRebuildPersonalization: () => void
  onOpenPublicPage: () => void
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-4" aria-labelledby="sp-lead-context">
        <h3 id="sp-lead-context" className="text-sm font-semibold">
          Lead context
        </h3>
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="font-medium text-muted-foreground">Recipient</p>
            <dl className="mt-1 space-y-1">
              <div>
                <dt className="sr-only">Name</dt>
                <dd>{leadContext.recipient.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd>{leadContext.recipient.company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{leadContext.recipient.email ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="font-medium text-muted-foreground">Research</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {leadContext.research.painPoints.length > 0 ? (
                leadContext.research.painPoints.map((point) => <li key={point}>{point}</li>)
              ) : (
                <li className="list-none pl-0 text-muted-foreground">No pain points captured.</li>
              )}
            </ul>
            <p className="mt-2 text-muted-foreground">Last activity: {formatWhen(leadContext.research.lastActivity)}</p>
            {leadContext.research.fitSummary ? (
              <p className="mt-1">{leadContext.research.fitSummary}</p>
            ) : null}
          </div>

          <div>
            <p className="font-medium text-muted-foreground">Relationship</p>
            <dl className="mt-1 space-y-1">
              <div>
                <dt className="text-muted-foreground">Last interaction</dt>
                <dd>{formatWhen(leadContext.relationship.lastInteraction)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Meeting readiness</dt>
                <dd className="capitalize">{leadContext.relationship.meetingReadiness ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">NBA</dt>
                <dd>{leadContext.relationship.nbaRecommendations ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4" aria-labelledby="sp-operator-actions">
        <h3 id="sp-operator-actions" className="text-sm font-semibold">
          Operator actions
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Status: {draftStatus}
          {operatorState.draftApprovedAt ? " · Operator approved" : ""}
        </p>
        <div className="mt-3 space-y-2">
          <ActionButton
            label="Approve draft"
            status={actions.approveDraft}
            disabled={acting || actions.approveDraft !== "idle"}
            onClick={onApproveDraft}
          />
          <ActionButton
            label="Publish"
            status={actions.publish}
            disabled={acting || actions.publish !== "idle"}
            onClick={onPublish}
          />
          <ActionButton
            label="Duplicate"
            status={actions.duplicate}
            disabled={acting || actions.duplicate !== "idle"}
            onClick={onDuplicate}
          />
          <ActionButton
            label="Archive"
            status={actions.archive}
            disabled={acting || actions.archive !== "idle"}
            onClick={onArchive}
            variant="destructive"
          />
          <ActionButton
            label="Rebuild personalization"
            status={actions.rebuildPersonalization}
            disabled={acting || actions.rebuildPersonalization !== "idle"}
            onClick={onRebuildPersonalization}
          />
          <ActionButton
            label="Open public page"
            status={actions.openPublicPage}
            disabled={acting || actions.openPublicPage !== "idle"}
            onClick={onOpenPublicPage}
          />
        </div>
      </section>
    </div>
  )
}
