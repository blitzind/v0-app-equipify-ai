export type TaskDraft = {
  id: string
  label: string
  done: boolean
  description?: string
}

export function cloneTasks(t: TaskDraft[]): TaskDraft[] {
  return t.map((x) => ({ ...x }))
}

export function tasksEqual(a: TaskDraft[], b: TaskDraft[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.id !== y.id) return false
    if (x.label.trim() !== y.label.trim()) return false
    if (x.done !== y.done) return false
    if ((x.description?.trim() ?? "") !== (y.description?.trim() ?? "")) return false
  }
  return true
}
