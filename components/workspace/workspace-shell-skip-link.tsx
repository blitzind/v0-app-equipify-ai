"use client"

import Link from "next/link"
import { WORKSPACE_SHELL_MAIN_CONTENT_ID, WORKSPACE_SHELL_SKIP_LINK } from "@/lib/workspace/workspace-shell-tokens"

type WorkspaceShellSkipLinkProps = {
  label?: string
}

/** Skip to main content — matches Core `PageShell` bypass link. */
export function WorkspaceShellSkipLink({ label = "Skip to main content" }: WorkspaceShellSkipLinkProps) {
  return (
    <a href={`#${WORKSPACE_SHELL_MAIN_CONTENT_ID}`} className={WORKSPACE_SHELL_SKIP_LINK}>
      {label}
    </a>
  )
}
