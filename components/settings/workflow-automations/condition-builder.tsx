"use client"

/**
 * Workflow Automations Phase 2 — visual condition builder.
 *
 * Renders a `VisualConditionTree` as a card with rule rows + optional
 * inner AND/OR groups. The component is fully controlled — the parent
 * holds the tree and persists the JSON via `serializeConditionTree`.
 *
 * Operators ship with an `exists` and `changed_to` synthetic op that
 * the visual layer maps cleanly onto the existing engine ops at save
 * time (see lib/workflows/visual-model.ts).
 */

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TRIGGER_CATALOG, type TriggerFieldRef } from "@/lib/workflows/trigger-catalog"
import {
  VISUAL_OPERATORS,
  makeEmptyGroup,
  makeEmptyRule,
  type VisualConditionGroup,
  type VisualConditionRule,
  type VisualConditionTree,
  type VisualOperator,
} from "@/lib/workflows/visual-model"
import type { ConditionOperator, WorkflowTriggerType } from "@/lib/workflows/types"
import { cn } from "@/lib/utils"

type Props = {
  triggerType: WorkflowTriggerType
  tree: VisualConditionTree
  onChange: (next: VisualConditionTree) => void
  /** Disabled when the underlying JSON couldn't be parsed cleanly. */
  disabled?: boolean
}

function fieldsFor(triggerType: WorkflowTriggerType): TriggerFieldRef[] {
  return TRIGGER_CATALOG[triggerType]?.fieldRefs ?? []
}

function OperatorPicker({ value, onChange }: { value: VisualOperator; onChange: (op: VisualOperator) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VisualOperator)}>
      <SelectTrigger className="h-8 text-xs w-[10.5rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VISUAL_OPERATORS.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FieldPicker({
  triggerType,
  value,
  onChange,
}: {
  triggerType: WorkflowTriggerType
  value: string
  onChange: (next: string) => void
}) {
  const fields = fieldsFor(triggerType)
  const known = fields.find((f) => f.path === value)
  return (
    <Select value={value || "__custom__"} onValueChange={(v) => onChange(v === "__custom__" ? "" : v)}>
      <SelectTrigger className="h-8 text-xs w-full sm:w-[16rem]">
        <SelectValue placeholder="Pick a field…" />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.path} value={f.path} className="text-xs">
            <span className="font-mono">{f.path}</span>
            <span className="text-muted-foreground"> · {f.description}</span>
          </SelectItem>
        ))}
        <SelectItem value="__custom__" className="text-xs italic">
          Custom field path…
        </SelectItem>
        {!known && value ? (
          <SelectItem value={value} className="text-xs italic">
            <span className="font-mono">{value}</span>
            <span className="text-muted-foreground"> · custom</span>
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}

function RuleRow({
  triggerType,
  rule,
  onChange,
  onRemove,
}: {
  triggerType: WorkflowTriggerType
  rule: VisualConditionRule
  onChange: (next: VisualConditionRule) => void
  onRemove: () => void
}) {
  const fields = fieldsFor(triggerType)
  const knownField = fields.find((f) => f.path === rule.field)
  const isEnumField = knownField?.kind === "enum"
  const isExists = rule.op === "exists"
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <FieldPicker triggerType={triggerType} value={rule.field} onChange={(v) => onChange({ ...rule, field: v })} />
      {!rule.field ? (
        <Input
          value={rule.field}
          onChange={(e) => onChange({ ...rule, field: e.target.value })}
          placeholder="custom.field.path"
          className="h-8 text-xs sm:w-[14rem] font-mono"
        />
      ) : null}
      <OperatorPicker value={rule.op} onChange={(op) => onChange({ ...rule, op })} />
      {!isExists ? (
        isEnumField && (rule.op === "equals" || rule.op === "not_equals" || rule.op === "changed_to") ? (
          <Select value={rule.value} onValueChange={(v) => onChange({ ...rule, value: v })}>
            <SelectTrigger className="h-8 text-xs sm:w-[14rem]">
              <SelectValue placeholder="Pick a value…" />
            </SelectTrigger>
            <SelectContent>
              {(knownField?.enumValues ?? []).map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            placeholder={rule.op === "in" ? "value1, value2" : "value"}
            className="h-8 text-xs sm:w-[14rem]"
          />
        )
      ) : (
        <span className="text-[11px] text-muted-foreground italic">no value needed</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive sm:ml-auto"
        onClick={onRemove}
        aria-label="Remove rule"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

export function ConditionBuilder({ triggerType, tree, onChange, disabled = false }: Props) {
  function setOperator(op: ConditionOperator) {
    onChange({ ...tree, operator: op })
  }
  function addRule() {
    onChange({ ...tree, rules: [...tree.rules, makeEmptyRule()] })
  }
  function updateRule(idx: number, next: VisualConditionRule) {
    const rules = tree.rules.slice()
    rules[idx] = next
    onChange({ ...tree, rules })
  }
  function removeRule(idx: number) {
    onChange({ ...tree, rules: tree.rules.filter((_, i) => i !== idx) })
  }
  function addGroup() {
    onChange({ ...tree, groups: [...tree.groups, makeEmptyGroup()] })
  }
  function updateGroup(idx: number, next: VisualConditionGroup) {
    const groups = tree.groups.slice()
    groups[idx] = next
    onChange({ ...tree, groups })
  }
  function removeGroup(idx: number) {
    onChange({ ...tree, groups: tree.groups.filter((_, i) => i !== idx) })
  }
  function updateGroupRule(gIdx: number, rIdx: number, next: VisualConditionRule) {
    const group = tree.groups[gIdx]
    if (!group) return
    const rules = group.rules.slice()
    rules[rIdx] = next
    updateGroup(gIdx, { ...group, rules })
  }

  const isEmpty = tree.rules.length === 0 && tree.groups.length === 0

  return (
    <div className={cn("flex flex-col gap-3", disabled && "opacity-60 pointer-events-none")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Match</span>
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded font-medium transition-colors",
              tree.operator === "and" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setOperator("and")}
          >
            ALL of
          </button>
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded font-medium transition-colors",
              tree.operator === "or" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setOperator("or")}
          >
            ANY of
          </button>
        </div>
        <span className="text-xs text-muted-foreground">these conditions</span>
        <Badge variant="outline" className="ml-auto text-[10px] tracking-wide">
          {tree.rules.length + tree.groups.reduce((n, g) => n + g.rules.length, 0)} rule
          {tree.rules.length + tree.groups.reduce((n, g) => n + g.rules.length, 0) === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        {tree.rules.map((rule, idx) => (
          <RuleRow
            key={rule.id}
            triggerType={triggerType}
            rule={rule}
            onChange={(next) => updateRule(idx, next)}
            onRemove={() => removeRule(idx)}
          />
        ))}

        {tree.groups.map((group, gIdx) => (
          <div key={group.id} className="rounded-lg border border-dashed border-border bg-muted/20 p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sub-group
              </span>
              <Select
                value={group.operator}
                onValueChange={(v) => updateGroup(gIdx, { ...group, operator: v as ConditionOperator })}
              >
                <SelectTrigger className="h-7 w-[7.5rem] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and" className="text-xs">
                    Match ALL
                  </SelectItem>
                  <SelectItem value="or" className="text-xs">
                    Match ANY
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => removeGroup(gIdx)}
                aria-label="Remove sub-group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {group.rules.map((rule, rIdx) => (
                <RuleRow
                  key={rule.id}
                  triggerType={triggerType}
                  rule={rule}
                  onChange={(next) => updateGroupRule(gIdx, rIdx, next)}
                  onRemove={() =>
                    updateGroup(gIdx, { ...group, rules: group.rules.filter((_, i) => i !== rIdx) })
                  }
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 self-start"
                onClick={() => updateGroup(gIdx, { ...group, rules: [...group.rules, makeEmptyRule()] })}
              >
                <Plus className="w-3 h-3" /> Add rule to sub-group
              </Button>
            </div>
          </div>
        ))}

        {isEmpty ? (
          <p className="text-[11px] text-muted-foreground italic px-1">
            No conditions yet — actions will run on every event for this trigger.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addRule} className="h-8 gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add condition
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={addGroup} className="h-8 gap-1 text-xs text-muted-foreground">
            <Plus className="w-3 h-3" /> Add AND/OR sub-group
          </Button>
        </div>
      </div>
    </div>
  )
}
