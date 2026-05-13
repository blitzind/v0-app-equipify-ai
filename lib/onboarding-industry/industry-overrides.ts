import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import type { OnboardingIndustryPartial } from "@/lib/onboarding-industry/types"

/**
 * Industry-specific onboarding deltas. Merged on top of defaults in
 * `resolveOnboardingIndustryBundle` (see `lib/onboarding-industry/resolve-onboarding-industry-bundle.ts`).
 */
export const ONBOARDING_INDUSTRY_PARTIALS: Partial<Record<WorkspaceIndustryKey, OnboardingIndustryPartial>> = {
  hvac_r: {
    welcomeTitle: "Welcome to your HVAC-R workspace",
    welcomeParagraphs: [
      "We have loaded example commercial accounts, rooftop and packaged equipment, and seasonal PM-style work so you can see how Equipify tracks refrigerant-related and contract work — not an empty shell.",
      "Your workspace is tuned for heating, cooling, and refrigeration service. Add your own customers and assets whenever you like; they stay separate from the examples.",
      "Removing example data clears only labeled demo rows. Nothing you create is touched, and you can re-import examples under Settings → Sample data.",
    ],
    exampleWorkflows: [
      "Add a PM service agreement and link it to recurring visits.",
      "Schedule seasonal maintenance on a rooftop or packaged unit.",
      "Track RTU history with work orders tied to each asset.",
    ],
    signupExampleWorkflows: [
      "Add a PM agreement for a commercial account.",
      "Schedule seasonal maintenance on rooftop equipment.",
      "Track rooftop units with equipment records and work history.",
    ],
    launchpadStepCopy: {
      customer: {
        label: "Add your first commercial account",
        description: "Create a real customer record for the buildings you service (separate from demo accounts).",
      },
      equipment: {
        label: "Register rooftop or packaged equipment",
        description: "Attach RTUs, splits, or other assets so PM and service history stay organized.",
      },
      work_order: {
        label: "Create a PM or seasonal maintenance job",
        description: "Schedule or log work against your own equipment — refrigerant checks and PM rounds fit well.",
      },
    },
    demoWalkthroughHints: [
      { text: "Open a sample seasonal or PM-style work order from the list.", href: "/work-orders" },
      { text: "Review equipment due this month for contract coverage.", href: "/service-schedule" },
      { text: "Peek at an active maintenance plan tied to demo equipment.", href: "/maintenance-plans" },
    ],
    quickActions: [
      { label: "Service schedule", href: "/service-schedule" },
      { label: "Maintenance plans", href: "/maintenance-plans" },
      { label: "Equipment", href: "/equipment" },
    ],
    statCardPriority: [
      "pm_plans_overdue",
      "active_pm_plans",
      "equipment_due_this_month",
      "overdue_service",
      "open_work_orders",
      "repeat_repairs",
      "unassigned_open_work",
      "monthly_revenue",
      "expiring_warranties",
      "overdue_invoices",
      "completed_this_month",
      "quote_pipeline",
    ],
    aidenSectorFraming:
      "This workspace is configured for HVAC-R (commercial heating, cooling, and refrigeration service). Prefer recommendations about PM agreements, seasonal maintenance, rooftop assets, refrigerant-related work, and dispatch density when the snapshot supports it.",
    terminology: {
      customerNoun: "account",
      equipmentNoun: "unit",
      workOrderNoun: "job",
    },
    dashboardEmptyCopy: {
      recentWorkOrders:
        "No jobs yet. Create a PM or service visit from Work Orders — seasonal and rooftop work orders are a natural first step for HVAC-R teams.",
    },
  },

  equipment_rental: {
    welcomeTitle: "Welcome to your equipment rental workspace",
    exampleWorkflows: [
      "Inspect rental assets between customer turns.",
      "Build a turnaround workflow from check-in to rent-ready.",
      "Track rental readiness and staged units on the yard.",
    ],
    signupExampleWorkflows: [
      "Inspect rental assets between turns.",
      "Create a turnaround workflow for check-in to rent-ready.",
      "Track which units are staged and ready to rent.",
    ],
    launchpadStepCopy: {
      equipment: {
        label: "Add rental assets or staged units",
        description: "Register cranes, lifts, or other rental SKUs so availability and service history stay clear.",
      },
      work_order: {
        label: "Create a turnaround or inspection job",
        description: "Log inspections, prep work, or damage review between rental cycles.",
      },
    },
    demoWalkthroughHints: [
      { text: "Try opening a rental turnaround or inspection-style work order.", href: "/work-orders" },
      { text: "Review equipment due soon for prep between turns.", href: "/service-schedule" },
    ],
    quickActions: [
      { label: "Work orders", href: "/work-orders" },
      { label: "Equipment catalog", href: "/equipment" },
      { label: "Dispatch", href: "/dispatch" },
    ],
    statCardPriority: [
      "open_work_orders",
      "unassigned_open_work",
      "equipment_due_this_month",
      "repeat_repairs",
      "overdue_service",
      "monthly_revenue",
      "overdue_invoices",
      "completed_this_month",
      "quote_pipeline",
      "expiring_warranties",
      "pm_plans_overdue",
      "active_pm_plans",
    ],
    aidenSectorFraming:
      "This workspace is configured for equipment rental operations. Prefer recommendations about turnaround time, inspection readiness, yard utilization, and rental fleet maintenance when supported by the snapshot.",
    dashboardEmptyCopy: {
      recentWorkOrders:
        "No work orders yet. Log a turnaround inspection or prep job — rental teams usually start there.",
    },
  },

  refrigeration_service: {
    exampleWorkflows: [
      "Log an emergency cooling or walk-in issue.",
      "Schedule refrigerant-related inspection work.",
      "Track compressor PM on rack or line equipment.",
    ],
    signupExampleWorkflows: [
      "Log an emergency cooling issue.",
      "Schedule a refrigerant inspection visit.",
      "Track compressor PM on rack equipment.",
    ],
    launchpadStepCopy: {
      work_order: {
        label: "Create an emergency or walk-in service job",
        description: "Capture cooling-down calls and rack issues as structured work orders.",
      },
      equipment: {
        label: "Add rack, line, or walk-in assets",
        description: "Attach compressors and evaporators so PM and leak history stay on the right asset.",
      },
    },
    demoWalkthroughHints: [
      { text: "Try opening an emergency or walk-in cooling work order in the demo list.", href: "/work-orders" },
    ],
    quickActions: [
      { label: "Work orders", href: "/work-orders" },
      { label: "Equipment", href: "/equipment" },
      { label: "Service schedule", href: "/service-schedule" },
    ],
    aidenSectorFraming:
      "This workspace is configured for commercial refrigeration service. Prefer recommendations about emergency cooling response, rack and walk-in assets, refrigerant-related PM, and compressor reliability when the snapshot supports it.",
    dashboardEmptyCopy: {
      recentWorkOrders:
        "No work orders yet. Log an emergency cooling or walk-in job — refrigeration teams often start there.",
    },
  },

  material_handling: {
    exampleWorkflows: [
      "Inspect forklifts and pallet equipment.",
      "Schedule industrial battery maintenance.",
      "Create a warehouse PM route for multiple assets.",
    ],
    signupExampleWorkflows: [
      "Inspect forklifts and pallet movers.",
      "Schedule battery watering or replacement PM.",
      "Create a warehouse PM route across assets.",
    ],
    launchpadStepCopy: {
      equipment: {
        label: "Register forklifts and MHE assets",
        description: "Add lift trucks, batteries, and attachments so shop and field history stay organized.",
      },
      work_order: {
        label: "Create an inspection or battery PM job",
        description: "Log planned PM or damage inspections tied to warehouse equipment.",
      },
    },
    demoWalkthroughHints: [
      { text: "Try opening a forklift or MHE inspection-style work order.", href: "/work-orders" },
    ],
    quickActions: [
      { label: "Equipment", href: "/equipment" },
      { label: "Service schedule", href: "/service-schedule" },
      { label: "Work orders", href: "/work-orders" },
    ],
    aidenSectorFraming:
      "This workspace is configured for material handling equipment (forklifts, pallet equipment, batteries). Prefer recommendations about inspection cadence, battery maintenance, warehouse PM routes, and repeat repairs when the snapshot supports it.",
    dashboardEmptyCopy: {
      recentWorkOrders:
        "No work orders yet. Log a forklift inspection or battery PM — material handling teams usually start there.",
    },
  },

  calibration_inspection: {
    signupExampleWorkflows: [
      "Review a calibration due list for traceable assets.",
      "Open a certificate-oriented work order from the demo set.",
      "Track equipment with upcoming calibration windows.",
    ],
    demoWalkthroughHints: [
      { text: "Review a calibration or certificate-oriented work order in the demo data.", href: "/work-orders" },
      { text: "Check equipment with upcoming calibration due dates.", href: "/equipment" },
    ],
    aidenSectorFraming:
      "This workspace is configured for calibration and inspection services. Prefer recommendations about certificate due dates, traceability, audit readiness, and equipment with expiring calibrations when the snapshot supports it.",
    dashboardEmptyCopy: {
      recentWorkOrders:
        "No work orders yet. Create a calibration or inspection job — traceable assets are a natural first step.",
    },
  },
}
