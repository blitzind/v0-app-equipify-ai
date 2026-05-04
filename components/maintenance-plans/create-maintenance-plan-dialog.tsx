"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMaintenancePlans } from "@/lib/maintenance-store";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { computeNextDueDate } from "@/lib/maintenance-plans/db-map";
import type {
  MaintenancePlan,
  MaintenancePlanService,
  PlanInterval,
  PlanStatus,
  NotificationTriggerDays,
  WorkOrderType,
  WorkOrderPriority,
  NotificationRule,
} from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Mail,
  MessageSquare,
  MonitorCheck,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AddEquipmentModal } from "@/components/equipment/add-equipment-modal";
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display";

const EQUIP_NONE = "__none__";

const INTERVAL_LABELS: Record<PlanInterval, string> = {
  Annual: "Annual",
  "Semi-Annual": "Semi-Annual",
  Quarterly: "Quarterly",
  Monthly: "Monthly",
  Custom: "Custom",
};

function emptyPlanServiceLine(): MaintenancePlanService {
  return {
    id: `svc-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    name: "",
    description: "",
    estimatedHours: 0,
    estimatedCost: 0,
  };
}

export function CreateMaintenancePlanDialog({
  open,
  onClose,
  prefillCustomerId = null,
  prefillEquipmentId = null,
  lockCustomer = false,
  lockedCustomerName = null,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  prefillCustomerId?: string | null;
  prefillEquipmentId?: string | null;
  lockCustomer?: boolean;
  lockedCustomerName?: string | null;
  onCreated?: () => void;
}) {
  const { createPlan, organizationId } = useMaintenancePlans();
  const [customers, setCustomers] = useState<
    Array<{ id: string; company_name: string }>
  >([]);
  const [equipmentList, setEquipmentList] = useState<
    Array<{
      id: string;
      name: string;
      category: string | null;
      location_label: string | null;
    }>
  >([]);
  const [technicians, setTechnicians] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false);
  /** Hides the plan dialog while Add Equipment is shown — avoids stacked z-50 overlays. */
  const [suspendPlanForEquipment, setSuspendPlanForEquipment] = useState(false);
  /** While true, Radix dialog dismiss must not call parent `onClose` (multi-fire safe). Cleared only in end flow / unmount. */
  const suppressPlanDismissForEquipmentRef = useRef(false);
  const [equipmentRefresh, setEquipmentRefresh] = useState(0);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [services, setServices] = useState<MaintenancePlanService[]>([]);
  const [form, setForm] = useState({
    name: "",
    customerId: "",
    equipmentId: "",
    technicianId: "",
    interval: "Quarterly" as PlanInterval,
    customIntervalDays: 90,
    startDate: new Date().toISOString().split("T")[0],
    lastServiceDate: new Date().toISOString().split("T")[0],
    status: "Active" as PlanStatus,
    workOrderType: "PM" as WorkOrderType,
    workOrderPriority: "Normal" as WorkOrderPriority,
    preferredServiceTime: "08:00",
    autoCreateWorkOrder: true,
    notes: "",
    emailEnabled: true,
    smsEnabled: false,
    internalEnabled: true,
  });

  const beginAddEquipmentFlow = useCallback(() => {
    suppressPlanDismissForEquipmentRef.current = true;
    setSuspendPlanForEquipment(true);
    setAddEquipmentOpen(true);
  }, []);

  const endAddEquipmentFlow = useCallback(() => {
    setAddEquipmentOpen(false);
    setSuspendPlanForEquipment(false);
    suppressPlanDismissForEquipmentRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      setSuspendPlanForEquipment(false);
      setAddEquipmentOpen(false);
      suppressPlanDismissForEquipmentRef.current = false;
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    setSubmitError(null);
    setForm({
      name: "",
      customerId: prefillCustomerId ?? "",
      equipmentId: prefillEquipmentId ?? "",
      technicianId: "",
      interval: "Quarterly",
      customIntervalDays: 90,
      startDate: today,
      lastServiceDate: today,
      status: "Active",
      workOrderType: "PM",
      workOrderPriority: "Normal",
      preferredServiceTime: "08:00",
      autoCreateWorkOrder: true,
      notes: "",
      emailEnabled: true,
      smsEnabled: false,
      internalEnabled: true,
    });
    setServices([]);
  }, [open, prefillCustomerId, prefillEquipmentId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    void (async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        if (!cancelled) {
          setCustomers([]);
          setTechnicians([]);
        }
        setCatalogLoading(false);
        return;
      }

      if (!organizationId) {
        if (!cancelled) {
          setCustomers([]);
          setTechnicians([]);
          setCatalogError("No organization selected.");
        }
        setCatalogLoading(false);
        return;
      }

      const orgId = organizationId;

      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("company_name");

      if (custError || cancelled) {
        if (!cancelled)
          setCatalogError(custError?.message ?? "Failed to load customers.");
        setCatalogLoading(false);
        return;
      }

      if (!cancelled)
        setCustomers(
          ((custRows ?? []) as Array<{ id: string; company_name: string }>) ??
            [],
        );

      const { data: memberRows, error: memberError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", ["owner", "admin", "manager", "tech"]);

      if (memberError || cancelled) {
        if (!cancelled && memberError) setCatalogError(memberError.message);
        setCatalogLoading(false);
        return;
      }

      const userIds = [
        ...new Set(
          (memberRows ?? []).map((m: { user_id: string }) => m.user_id),
        ),
      ];
      let techOptions: typeof technicians = [];

      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        techOptions = (
          (profRows as Array<{
            id: string;
            full_name: string | null;
            email: string | null;
          }> | null) ?? []
        ).map((p) => ({
          id: p.id,
          label:
            (p.full_name && p.full_name.trim()) ||
            (p.email && p.email.trim()) ||
            "Team member",
        }));
        techOptions.sort((a, b) => a.label.localeCompare(b.label));
      }

      if (!cancelled) setTechnicians(techOptions);
      setCatalogLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  useEffect(() => {
    if (!open || !organizationId || !form.customerId) {
      if (!form.customerId) setEquipmentList([]);
      setEquipmentLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    void (async () => {
      setEquipmentLoading(true);
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select("id, name, category, location_label, equipment_code, serial_number")
        .eq("organization_id", organizationId)
        .eq("customer_id", form.customerId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("name");

      if (cancelled) return;
      setEquipmentLoading(false);
      if (eqError) {
        setEquipmentList([]);
        return;
      }
      setEquipmentList(
        (eqRows as Array<{
          id: string;
          name: string;
          category: string | null;
          location_label: string | null;
          equipment_code: string | null;
          serial_number: string | null;
        }>) ?? [],
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organizationId, form.customerId, equipmentRefresh]);

  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  const selectedEquipment = equipmentList.find(
    (e) => e.id === form.equipmentId,
  );
  const selectedTech = technicians.find((t) => t.id === form.technicianId);

  function buildRules(emails: string[], phones: string[]): NotificationRule[] {
    const days: NotificationTriggerDays[] = [30, 14, 7, 1];
    const rules: NotificationRule[] = [];

    days.forEach((d) => {
      if (form.emailEnabled)
        rules.push({
          id: `r-email-${d}`,
          channel: "Email",
          triggerDays: d,
          enabled: true,
          recipients: emails,
        });
      if (form.smsEnabled)
        rules.push({
          id: `r-sms-${d}`,
          channel: "SMS",
          triggerDays: d,
          enabled: d <= 7,
          recipients: phones,
        });
      if (form.internalEnabled)
        rules.push({
          id: `r-internal-${d}`,
          channel: "Internal Alert",
          triggerDays: d,
          enabled: d <= 14,
          recipients: ["admin@equipify.ai"],
        });
    });
    return rules;
  }

  async function handleSubmit() {
    setSubmitError(null);

    const missing: string[] = [];
    if (!organizationId)
      missing.push("wait for your workspace to load, or sign in again");
    if (!form.name.trim()) missing.push("enter a plan name");
    if (!form.customerId) missing.push("select a customer");
    if (!form.technicianId) missing.push("select a technician");
    if (!form.startDate?.trim()) missing.push("set a plan start date");

    if (missing.length) {
      setSubmitError(
        missing.length === 1
          ? `Please ${missing[0]}.`
          : `Please complete: ${missing.join("; ")}.`,
      );
      return;
    }

    setSubmitting(true);
    const supabase = createBrowserSupabaseClient();

    const { data: contactRows } = await supabase
      .from("customer_contacts")
      .select("email, phone")
      .eq("organization_id", organizationId!)
      .eq("customer_id", form.customerId)
      .eq("is_archived", false);

    const emails = (
      (contactRows as Array<{
        email: string | null;
        phone: string | null;
      }> | null) ?? []
    )
      .map((c) => c.email)
      .filter((e): e is string => Boolean(e?.trim()));
    const phones = (
      (contactRows as Array<{
        email: string | null;
        phone: string | null;
      }> | null) ?? []
    )
      .map((c) => c.phone)
      .filter((p): p is string => Boolean(p?.trim()));

    const lastSvc = form.lastServiceDate.trim() || form.startDate;
    const nextDue = computeNextDueDate(
      form.startDate,
      form.interval,
      form.customIntervalDays,
    );

    const hasEquipment = Boolean(form.equipmentId?.trim());
    const newPlan: MaintenancePlan = {
      id: "pending",
      name: form.name.trim(),
      customerId: form.customerId,
      customerName: lockedCustomerName ?? selectedCustomer?.company_name ?? "",
      equipmentId: form.equipmentId?.trim() ?? "",
      equipmentName: selectedEquipment
        ? getEquipmentDisplayPrimary(selectedEquipment)
        : "",
      equipmentCategory: selectedEquipment?.category ?? "",
      location: selectedEquipment?.location_label ?? "",
      technicianId: form.technicianId,
      technicianName: selectedTech?.label ?? "",
      interval: form.interval,
      customIntervalDays: form.customIntervalDays,
      status: form.status,
      startDate: form.startDate,
      lastServiceDate: lastSvc,
      nextDueDate: nextDue,
      services: services.filter((s) => s.name.trim()),
      notificationRules: buildRules(emails, phones),
      autoCreateWorkOrder: hasEquipment && form.autoCreateWorkOrder,
      workOrderType: form.workOrderType,
      workOrderPriority: form.workOrderPriority,
      preferredServiceTime: form.preferredServiceTime,
      notes: form.notes,
      createdAt: new Date().toISOString(),
      totalServicesCompleted: 0,
    };

    const result = await createPlan(newPlan);
    setSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
      return;
    }

    toast({
      title: "Plan created",
      description: `${newPlan.name} is on your maintenance schedule.`,
    });
    onCreated?.();
    onClose();
  }

  const set = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const planDialogOpen = open && !suspendPlanForEquipment;

  const catalogBusy = catalogLoading || !organizationId;
  const canAutoWo = Boolean(form.equipmentId?.trim());
  const showEquipmentEmpty =
    Boolean(form.customerId) &&
    !equipmentLoading &&
    equipmentList.length === 0;
  const valid =
    form.name &&
    form.customerId &&
    form.technicianId &&
    organizationId &&
    !catalogError;

  return (
    <>
    <Dialog
      open={planDialogOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        if (suppressPlanDismissForEquipmentRef.current) return;
        onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Maintenance Plan</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          {catalogError && (
            <Alert variant="destructive">
              <AlertTitle>Could not load data</AlertTitle>
              <AlertDescription>{catalogError}</AlertDescription>
            </Alert>
          )}
          {submitError && (
            <Alert variant="destructive">
              <AlertTitle>Create failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          {catalogBusy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Loading organization…
            </div>
          )}
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Plan Name *
            </label>
            <input
              className="input-base"
              placeholder="e.g. Quarterly Compressor PM"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          {/* Customer */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Customer *
            </label>
            {lockCustomer ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {lockedCustomerName ??
                  selectedCustomer?.company_name ??
                  "Loading…"}
              </div>
            ) : (
              <Select
                value={form.customerId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, customerId: v, equipmentId: "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {/* Equipment (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Equipment (optional)
            </label>
            <p className="text-xs text-muted-foreground">
              You can attach equipment later.
            </p>
            {!form.customerId ? (
              <p className="text-xs text-muted-foreground">
                Select a customer to choose equipment.
              </p>
            ) : equipmentLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Loading equipment…
              </div>
            ) : showEquipmentEmpty ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-2">
                <p className="text-sm text-foreground">
                  No equipment found for this customer.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={beginAddEquipmentFlow}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Equipment
                </Button>
              </div>
            ) : null}
            <Select
              value={form.equipmentId ? form.equipmentId : EQUIP_NONE}
              onValueChange={(v) =>
                set("equipmentId", v === EQUIP_NONE ? "" : v)
              }
              disabled={!form.customerId || equipmentLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select equipment (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EQUIP_NONE}>None — attach later</SelectItem>
                {equipmentList.map((e) => (
                  <SelectItem
                    key={e.id}
                    value={e.id}
                    textValue={getEquipmentDisplayPrimary(e)}
                  >
                    <span className="block font-medium leading-tight">
                      {getEquipmentDisplayPrimary(e)}
                    </span>
                    <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                      {getEquipmentSecondaryLine(e, selectedCustomer?.company_name)}
                      {e.location_label ? ` · ${e.location_label}` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Technician */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Assigned Technician *
            </label>
            <Select
              value={form.technicianId}
              onValueChange={(v) => set("technicianId", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Interval */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">
                Service Interval *
              </label>
              <Select
                value={form.interval}
                onValueChange={(v) => set("interval", v as PlanInterval)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INTERVAL_LABELS) as PlanInterval[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {INTERVAL_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.interval === "Custom" && (
              <div className="flex flex-col gap-1.5 w-32">
                <label className="text-sm font-medium text-foreground">
                  Every (days)
                </label>
                <input
                  type="number"
                  min={1}
                  className="input-base"
                  value={form.customIntervalDays}
                  onChange={(e) => set("customIntervalDays", +e.target.value)}
                />
              </div>
            )}
          </div>
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Status
            </label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as PlanStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Active", "Paused", "Expired"] as PlanStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">
                Plan start date *
              </label>
              <input
                type="date"
                className="input-base"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">
                Last service date
              </label>
              <input
                type="date"
                className="input-base"
                value={form.lastServiceDate}
                onChange={(e) => set("lastServiceDate", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            First <strong>next due date</strong> is calculated from{" "}
            <strong>start date + frequency</strong> (shown below). Last service
            defaults to start if left aligned — stored for history.
          </p>
          {/* Next due preview */}
          <p className="text-xs text-muted-foreground">
            Next due:{" "}
            <span className="font-medium text-foreground">
              {computeNextDueDate(
                form.startDate,
                form.interval,
                form.customIntervalDays,
              )}
            </span>
          </p>

          <Separator />

          {/* Auto work order */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Auto-Create Work Order</p>
              <p className="text-xs text-muted-foreground">
                Create a WO automatically when due date arrives
              </p>
              {!canAutoWo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Attach equipment to enable automatic work orders.
                </p>
              )}
            </div>
            <Switch
              checked={canAutoWo && form.autoCreateWorkOrder}
              disabled={!canAutoWo}
              onCheckedChange={(v) => set("autoCreateWorkOrder", v)}
            />
          </div>
          {canAutoWo && form.autoCreateWorkOrder && (
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">
                  WO Type
                </label>
                <Select
                  value={form.workOrderType}
                  onValueChange={(v) =>
                    set("workOrderType", v as WorkOrderType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "PM",
                        "Inspection",
                        "Repair",
                        "Install",
                      ] as WorkOrderType[]
                    ).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">
                  Priority
                </label>
                <Select
                  value={form.workOrderPriority}
                  onValueChange={(v) =>
                    set("workOrderPriority", v as WorkOrderPriority)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "Low",
                        "Normal",
                        "High",
                        "Critical",
                      ] as WorkOrderPriority[]
                    ).map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {canAutoWo && form.autoCreateWorkOrder && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Preferred service window start
              </label>
              <input
                type="time"
                className="input-base max-w-[200px]"
                value={form.preferredServiceTime}
                onChange={(e) => set("preferredServiceTime", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Automation sets the work order scheduled time on the due date.
              </p>
            </div>
          )}

          <Separator />

          {/* Notification channels */}
          <p className="text-sm font-semibold">Notification Channels</p>
          <p className="text-xs text-muted-foreground -mt-2">
            Alerts fire at 30, 14, 7, and 1 day before due date.
          </p>
          {[
            {
              key: "emailEnabled",
              label: "Email",
              sub: "Send to customer contacts",
              Icon: Mail,
            },
            {
              key: "smsEnabled",
              label: "SMS",
              sub: "Send to customer phone numbers",
              Icon: MessageSquare,
            },
            {
              key: "internalEnabled",
              label: "Internal Alert",
              sub: "Alert Equipify.ai admin users",
              Icon: MonitorCheck,
            },
          ].map(({ key, label, sub, Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
              <Switch
                checked={form[key as keyof typeof form] as boolean}
                onCheckedChange={(v) => set(key, v)}
              />
            </div>
          ))}

          <Separator />

          {/* Service lines (optional) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Service lines</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() =>
                  setServices((prev) => [...prev, emptyPlanServiceLine()])
                }
              >
                <Plus className="w-3.5 h-3.5" /> Add line
              </Button>
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {services.map((svc, idx) => (
                <div
                  key={svc.id}
                  className="rounded-lg border border-border p-3 space-y-2 bg-muted/20"
                >
                  <div className="flex justify-between gap-2">
                    <input
                      className="input-base text-sm flex-1"
                      placeholder="Service name"
                      value={svc.name}
                      onChange={(e) =>
                        setServices((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, name: e.target.value } : s,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground"
                      aria-label="Remove line"
                      onClick={() =>
                        setServices((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <input
                    className="input-base text-xs"
                    placeholder="Description"
                    value={svc.description}
                    onChange={(e) =>
                      setServices((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, description: e.target.value } : s,
                        ),
                      )
                    }
                  />
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        Hours
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        className="input-base text-sm h-8"
                        value={svc.estimatedHours}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s, i) =>
                              i === idx
                                ? { ...s, estimatedHours: +e.target.value || 0 }
                                : s,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        Cost
                      </span>
                      <input
                        type="number"
                        min={0}
                        className="input-base text-sm h-8"
                        value={svc.estimatedCost}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s, i) =>
                              i === idx
                                ? { ...s, estimatedCost: +e.target.value || 0 }
                                : s,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  Optional checklist items for this plan.
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea
              rows={2}
              className="input-base resize-none"
              placeholder="Special instructions, access notes..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => void handleSubmit()}
              disabled={!valid || submitting || catalogBusy}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                  Creating…
                </>
              ) : (
                "Create Plan"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AddEquipmentModal
      open={addEquipmentOpen}
      onClose={endAddEquipmentFlow}
      prefilledCustomerId={form.customerId || null}
      offerMaintenancePlanNext={false}
      onSuccess={(newEquipmentId) => {
        setEquipmentRefresh((n) => n + 1);
        if (newEquipmentId) {
          setForm((f) => ({ ...f, equipmentId: newEquipmentId }));
        }
      }}
    />
    </>
  );
}
