/** Prospect Search workspace account selection (7.PS-FB). Client state helpers only. */

export type ProspectSearchWorkspaceSelectionState = {
  selectedKeys: Set<string>
}

export function createProspectSearchWorkspaceSelectionState(): ProspectSearchWorkspaceSelectionState {
  return { selectedKeys: new Set() }
}

export function toggleProspectSearchWorkspaceSelection(
  state: ProspectSearchWorkspaceSelectionState,
  companyKey: string,
  selected: boolean,
): ProspectSearchWorkspaceSelectionState {
  const next = new Set(state.selectedKeys)
  if (selected) next.add(companyKey)
  else next.delete(companyKey)
  return { selectedKeys: next }
}

export function selectAllProspectSearchWorkspaceVisible(
  state: ProspectSearchWorkspaceSelectionState,
  visibleCompanyKeys: string[],
): ProspectSearchWorkspaceSelectionState {
  return { selectedKeys: new Set(visibleCompanyKeys) }
}

export function clearProspectSearchWorkspaceSelection(): ProspectSearchWorkspaceSelectionState {
  return createProspectSearchWorkspaceSelectionState()
}

export function isProspectSearchWorkspaceAccountSelected(
  state: ProspectSearchWorkspaceSelectionState,
  companyKey: string,
): boolean {
  return state.selectedKeys.has(companyKey)
}
