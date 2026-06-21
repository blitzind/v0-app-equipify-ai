/** GS-AI-PLAYBOOK-1A/2A — Industry playbooks (seed + enriched reference). */

import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import { buildSeededIndustryPlaybook } from "@/lib/growth/playbooks/playbooks/_playbook-seed-helper"
import { GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS } from "@/lib/growth/playbooks/playbooks/enriched/priority-playbooks"

export const GROWTH_INDUSTRY_PLAYBOOK_BIOMEDICAL_EQUIPMENT =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.biomedical_equipment()
export const GROWTH_INDUSTRY_PLAYBOOK_MEDICAL_EQUIPMENT =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.medical_equipment()
export const GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_EQUIPMENT =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.commercial_equipment()
export const GROWTH_INDUSTRY_PLAYBOOK_INDUSTRIAL_EQUIPMENT =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.industrial_equipment()
export const GROWTH_INDUSTRY_PLAYBOOK_FIELD_SERVICE =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.field_service()
export const GROWTH_INDUSTRY_PLAYBOOK_CALIBRATION_INSPECTION =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.calibration_inspection()
export const GROWTH_INDUSTRY_PLAYBOOK_FACILITY_MAINTENANCE =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.facility_maintenance()
export const GROWTH_INDUSTRY_PLAYBOOK_HVAC_R = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.hvac_r()
export const GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_HVAC =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.commercial_hvac()
export const GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_KITCHEN =
  GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.commercial_kitchen()

export const GROWTH_INDUSTRY_PLAYBOOK_ELECTRICAL = buildSeededIndustryPlaybook({
  industryId: "electrical",
  overview: "Electrical contractors manage panel work, lighting retrofits, and compliance testing across commercial sites.",
  pains: [
    "Thermal scan and compliance due dates are tracked manually.",
    "Panel and circuit history is not tied to work orders.",
    "Project and service work split customer context.",
    "Permit and inspection documentation is scattered.",
  ],
  discoveryQuestions: [
    "How do you track IR scan and compliance intervals?",
    "Where is panel service history stored?",
    "How do project handoffs reach service teams?",
  ],
  proofPoints: [
    "Compliance-driven PM for panels and life safety circuits.",
    "Asset-level electrical history.",
    "Unified customer view across project and service work.",
  ],
  recommendedCtas: ["Review electrical PM workflow", "Book a service ops demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_PLUMBING = buildSeededIndustryPlaybook({
  industryId: "plumbing",
  overview: "Plumbing contractors handle backflow, pumps, drains, and commercial plumbing PM programs.",
  pains: [
    "Backflow test due dates are easy to miss.",
    "Emergency drain calls disrupt scheduled routes.",
    "Multi-family accounts lack consolidated asset history.",
  ],
  discoveryQuestions: [
    "How are backflow tests scheduled and documented?",
    "How do you prioritize emergencies on busy days?",
    "How is history shared across properties for one customer?",
  ],
  proofPoints: [
    "Due-date tracking for backflow and pump PM.",
    "Dispatch visibility for emergency vs planned work.",
    "Property-level asset and service history.",
  ],
  recommendedCtas: ["See backflow PM tracking", "Book a plumbing ops demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_GARAGE_DOOR = buildSeededIndustryPlaybook({
  industryId: "garage_door",
  overview: "Overhead door service teams maintain operators, springs, and safety systems for commercial facilities.",
  pains: [
    "Safety inspection intervals are inconsistent.",
    "Operator model and parts history is not on the truck.",
    "High-speed door downtime is costly and hard to prioritize.",
  ],
  discoveryQuestions: [
    "How do you schedule safety inspections?",
    "What do techs know about the operator before arrival?",
  ],
  proofPoints: [
    "Inspection-driven PM for door systems.",
    "Asset history with operator and parts context.",
    "Priority dispatch for downtime-sensitive sites.",
  ],
  recommendedCtas: ["Review door PM workflow", "Book a quick demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_LOCKSMITH = buildSeededIndustryPlaybook({
  industryId: "locksmith",
  overview: "Commercial locksmiths manage access programs, rekeys, and hardware service across portfolios.",
  pains: [
    "Master key programs are hard to reconcile after changes.",
    "Access hardware service lacks asset-level history.",
    "After-hours calls are difficult to document consistently.",
  ],
  discoveryQuestions: [
    "How do you track master key and access changes?",
    "Where is hardware service history stored?",
  ],
  proofPoints: [
    "Location and hardware records tied to work orders.",
    "Consistent job documentation for after-hours calls.",
  ],
  recommendedCtas: ["See access service workflow", "Book a locksmith demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_PROPERTY_MANAGEMENT = buildSeededIndustryPlaybook({
  industryId: "property_management",
  overview: "Property operators coordinate tenant issues, vendors, and building PM across portfolios.",
  pains: [
    "Tenant requests fall through cracks between email and spreadsheets.",
    "Vendor work lacks SLA visibility.",
    "Building asset history is fragmented by vendor.",
  ],
  discoveryQuestions: [
    "How do tenant requests become tracked work?",
    "How do you measure vendor response times?",
  ],
  proofPoints: [
    "Central queue for tenant and vendor work.",
    "SLA timestamps on vendor jobs.",
    "Building asset register with history.",
  ],
  recommendedCtas: ["See tenant request workflow", "Book a facilities demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_APPLIANCE_REPAIR = buildSeededIndustryPlaybook({
  industryId: "appliance_repair",
  overview: "Appliance repair teams run high-volume dispatch with warranty and parts-heavy jobs.",
  pains: [
    "Warranty eligibility is checked manually on site.",
    "Parts ordering delays repeat visits.",
    "Route density is hard to optimize.",
  ],
  discoveryQuestions: [
    "How is warranty status verified before dispatch?",
    "How do parts delays get tracked on open jobs?",
  ],
  proofPoints: [
    "Job records with warranty and parts context.",
    "Repeat visit visibility by appliance and account.",
  ],
  recommendedCtas: ["Review appliance dispatch demo", "Book a quick walkthrough"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_FIRE_SECURITY = buildSeededIndustryPlaybook({
  industryId: "fire_security",
  overview: "Fire and security integrators run inspection cadences, deficiency tracking, and access device service.",
  pains: [
    "Inspection deficiencies are not tracked to resolution.",
    "Device inventories drift from field reality.",
    "Combined fire and security routes are hard to plan.",
  ],
  discoveryQuestions: [
    "How are inspection deficiencies closed out?",
    "How often is the device inventory reconciled?",
  ],
  proofPoints: [
    "Deficiency-to-work-order tracking.",
    "Device register with inspection history.",
    "Route planning for combined life safety work.",
  ],
  recommendedCtas: ["See inspection workflow", "Book a life safety demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_SPECIALTY_CONTRACTORS = buildSeededIndustryPlaybook({
  industryId: "specialty_contractors",
  overview: "Specialty trade contractors balance project work, service callbacks, and warranty visits.",
  pains: [
    "Project punch items do not flow into service queues.",
    "Warranty callbacks lose original scope context.",
    "Job costing spans project and T&M work awkwardly.",
  ],
  discoveryQuestions: [
    "How do punch-list items become billable or warranty work?",
    "Where does warranty scope context live?",
  ],
  proofPoints: [
    "Linked project and service work history.",
    "Warranty callback tracking with original job context.",
  ],
  recommendedCtas: ["Review specialty contractor workflow", "Book a demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_SEPTIC = buildSeededIndustryPlaybook({
  industryId: "septic",
  overview: "Septic and wastewater providers schedule pump-outs, inspections, and emergency lift station response.",
  pains: [
    "Pump-out intervals are tracked on paper.",
    "Emergency alarms are hard to prioritize in dispatch.",
    "Lift station history is not visible to new drivers.",
  ],
  discoveryQuestions: [
    "How do you schedule recurring pump-outs?",
    "How are emergency alarms dispatched?",
  ],
  proofPoints: [
    "Interval-driven scheduling for septic assets.",
    "Alarm-priority dispatch.",
    "Site history for repeat drivers.",
  ],
  recommendedCtas: ["See septic scheduling demo", "Book a quick call"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_AV_INSTALLATION = buildSeededIndustryPlaybook({
  industryId: "av_installation",
  overview: "AV integrators deliver rack builds, conferencing systems, and ongoing support contracts.",
  pains: [
    "Rack asset records drift after firmware changes.",
    "Support tickets lack install configuration context.",
    "QA visits are not tied to project handoff records.",
  ],
  discoveryQuestions: [
    "How is installed configuration documented post-handoff?",
    "How does support see original install scope?",
  ],
  proofPoints: [
    "Room and rack asset records with config notes.",
    "Support work linked to original project history.",
  ],
  recommendedCtas: ["Review AV support workflow", "Book an integrator demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_MEP = buildSeededIndustryPlaybook({
  industryId: "mep",
  overview: "MEP firms coordinate mechanical, electrical, and plumbing service across complex buildings.",
  pains: [
    "Trade-specific work silos hide cross-system issues.",
    "BAS alarms do not create structured follow-up work.",
    "Multi-trade PM rounds produce disconnected notes.",
  ],
  discoveryQuestions: [
    "How do mechanical and electrical teams share backlog visibility?",
    "What happens after a BAS alarm indicates a fault?",
  ],
  proofPoints: [
    "Cross-trade work order visibility.",
    "Alarm follow-up tracked as structured work.",
    "Building-level PM history across trades.",
  ],
  recommendedCtas: ["See MEP coordination demo", "Book a building ops walkthrough"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_GENERATOR_POWER = buildSeededIndustryPlaybook({
  industryId: "generator_power",
  overview: "Generator and power systems providers run exercise PM, load banking, and ATS maintenance.",
  pains: [
    "Exercise PM logs are paper-based.",
    "Load bank results are not tied to asset records.",
    "Battery replacement cycles are missed.",
  ],
  discoveryQuestions: [
    "How are monthly exercises documented?",
    "Where do load bank results live?",
  ],
  proofPoints: [
    "Exercise PM schedules with logged results.",
    "Load bank history on each generator asset.",
    "Battery and fuel system PM reminders.",
  ],
  recommendedCtas: ["Review generator PM workflow", "Book a power systems demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_EQUIPMENT_RENTAL = buildSeededIndustryPlaybook({
  industryId: "equipment_rental",
  overview: "Rental operators inspect, turnaround, and PM fleet assets between customer deployments.",
  pains: [
    "Post-rental inspections are inconsistent.",
    "Damage claims lack photo and meter context.",
    "Rent-ready status is tracked in spreadsheets.",
  ],
  discoveryQuestions: [
    "How is every return inspected before next dispatch?",
    "How are damage claims documented?",
  ],
  proofPoints: [
    "Return inspection checklists on each asset.",
    "Damage documentation tied to rental history.",
    "Rent-ready status visible on fleet register.",
  ],
  recommendedCtas: ["See rental turnaround workflow", "Book a fleet demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_FLEET_MOBILE_EQUIPMENT = buildSeededIndustryPlaybook({
  industryId: "fleet_mobile_equipment",
  overview: "Fleet maintenance teams PM service vehicles, trailers, and mobile assets.",
  pains: [
    "DOT and PM due dates are tracked manually.",
    "Trailer and vehicle history is split across files.",
    "Field teams lack visibility into shop backlog.",
  ],
  discoveryQuestions: [
    "How do you track DOT and PM due dates?",
    "Where is trailer service history stored?",
  ],
  proofPoints: [
    "Due-date driven fleet PM.",
    "Unified history for vehicles and trailers.",
    "Shop backlog visibility for dispatchers.",
  ],
  recommendedCtas: ["Review fleet PM demo", "Book a quick walkthrough"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_MATERIAL_HANDLING = buildSeededIndustryPlaybook({
  industryId: "material_handling",
  overview: "Material handling service teams maintain forklifts, dock equipment, and conveyors in warehouse environments.",
  pains: [
    "Annual inspection due dates are missed on busy docks.",
    "Hydraulic repeat failures lack trend visibility.",
    "Customer sites have hundreds of units with uneven history.",
  ],
  discoveryQuestions: [
    "How are annual inspections scheduled across a DC?",
    "How do you spot repeat hydraulic issues?",
  ],
  proofPoints: [
    "Inspection-driven PM for lift trucks and dock levelers.",
    "Repeat failure trends by asset.",
    "Site-level fleet registers.",
  ],
  recommendedCtas: ["See forklift PM workflow", "Book a warehouse demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_ELEVATOR_LIFT = buildSeededIndustryPlaybook({
  industryId: "elevator_lift",
  overview: "Elevator service providers track units, inspections, and maintenance control programs.",
  pains: [
    "Inspection due dates and certificates are hard to consolidate.",
    "Controller-specific history is lost between techs.",
    "Modernization and service work split records.",
  ],
  discoveryQuestions: [
    "How do you track CAT inspections and certificates?",
    "How is controller-specific history preserved?",
  ],
  proofPoints: [
    "Unit register with inspection and certificate history.",
    "Service and modernization work on one asset record.",
  ],
  recommendedCtas: ["Review elevator compliance workflow", "Book a conveyance demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_REFRIGERATION_SERVICE = buildSeededIndustryPlaybook({
  industryId: "refrigeration_service",
  overview: "Refrigeration contractors service racks, walk-ins, and cold chain assets with emergency-heavy demand.",
  pains: [
    "Leak inspection PM is inconsistent across sites.",
    "Rack compressor history is not centralized.",
    "Emergency cooler outages overwhelm dispatch.",
  ],
  discoveryQuestions: [
    "How are leak inspections scheduled?",
    "What history does a tech see on a rack call?",
  ],
  proofPoints: [
    "Leak PM schedules tied to refrigeration assets.",
    "Rack and walk-in service history.",
    "Priority dispatch for cold chain outages.",
  ],
  recommendedCtas: ["See refrigeration PM workflow", "Book a cold chain demo"],
})

export const GROWTH_INDUSTRY_SEEDED_PLAYBOOKS: GrowthIndustryPlaybook[] = [
  GROWTH_INDUSTRY_PLAYBOOK_BIOMEDICAL_EQUIPMENT,
  GROWTH_INDUSTRY_PLAYBOOK_MEDICAL_EQUIPMENT,
  GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_EQUIPMENT,
  GROWTH_INDUSTRY_PLAYBOOK_INDUSTRIAL_EQUIPMENT,
  GROWTH_INDUSTRY_PLAYBOOK_FIELD_SERVICE,
  GROWTH_INDUSTRY_PLAYBOOK_CALIBRATION_INSPECTION,
  GROWTH_INDUSTRY_PLAYBOOK_FACILITY_MAINTENANCE,
  GROWTH_INDUSTRY_PLAYBOOK_HVAC_R,
  GROWTH_INDUSTRY_PLAYBOOK_ELECTRICAL,
  GROWTH_INDUSTRY_PLAYBOOK_PLUMBING,
  GROWTH_INDUSTRY_PLAYBOOK_GARAGE_DOOR,
  GROWTH_INDUSTRY_PLAYBOOK_LOCKSMITH,
  GROWTH_INDUSTRY_PLAYBOOK_PROPERTY_MANAGEMENT,
  GROWTH_INDUSTRY_PLAYBOOK_APPLIANCE_REPAIR,
  GROWTH_INDUSTRY_PLAYBOOK_FIRE_SECURITY,
  GROWTH_INDUSTRY_PLAYBOOK_SPECIALTY_CONTRACTORS,
  GROWTH_INDUSTRY_PLAYBOOK_SEPTIC,
  GROWTH_INDUSTRY_PLAYBOOK_AV_INSTALLATION,
  GROWTH_INDUSTRY_PLAYBOOK_MEP,
  GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_HVAC,
  GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_KITCHEN,
  GROWTH_INDUSTRY_PLAYBOOK_GENERATOR_POWER,
  GROWTH_INDUSTRY_PLAYBOOK_EQUIPMENT_RENTAL,
  GROWTH_INDUSTRY_PLAYBOOK_FLEET_MOBILE_EQUIPMENT,
  GROWTH_INDUSTRY_PLAYBOOK_MATERIAL_HANDLING,
  GROWTH_INDUSTRY_PLAYBOOK_ELEVATOR_LIFT,
  GROWTH_INDUSTRY_PLAYBOOK_REFRIGERATION_SERVICE,
]

export const GROWTH_INDUSTRY_PLAYBOOK_BY_ID: Record<string, GrowthIndustryPlaybook> = Object.fromEntries(
  GROWTH_INDUSTRY_SEEDED_PLAYBOOKS.map((playbook) => [playbook.industryId, playbook]),
)
