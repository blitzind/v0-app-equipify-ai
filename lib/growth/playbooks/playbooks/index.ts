/** GS-AI-PLAYBOOK-1A — Seeded industry playbooks (foundation content only). */

import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import { buildSeededIndustryPlaybook } from "@/lib/growth/playbooks/playbooks/_playbook-seed-helper"

export const GROWTH_INDUSTRY_PLAYBOOK_BIOMEDICAL_EQUIPMENT = buildSeededIndustryPlaybook({
  industryId: "biomedical_equipment",
  overview:
    "Biomedical and clinical engineering teams maintain regulated devices across hospitals, clinics, and IDN sites. Work is driven by PM cadences, recall management, and audit-ready documentation.",
  pains: [
    "PM due dates and recall actions live in spreadsheets disconnected from work orders.",
    "Technicians lack unified device history before entering sensitive clinical areas.",
    "Compliance documentation is rebuilt manually for Joint Commission or CMS surveys.",
    "Multi-site HTM teams cannot see backlog risk by modality or campus.",
    "Parts usage and loaner tracking are inconsistent across biomed shops.",
  ],
  discoveryQuestions: [
    "How do you track PM, calibration, and recall due dates today?",
    "Where does device service history live before a tech arrives on unit?",
    "How do you prepare documentation for accreditation or audit requests?",
    "Which modalities create the most repeat truck rolls or overdue PM?",
    "Do loaner pools and parts usage tie back to asset records?",
  ],
  objections: [
    "We already use a CMMS tied to the hospital.",
    "Clinical engineering workflows are too specialized for generic software.",
    "Security and compliance reviews block new vendors.",
  ],
  proofPoints: [
    "Single asset register with PM schedules and service history per device.",
    "Work orders linked to equipment, parts, and technician notes for audit trails.",
    "Dashboard visibility into overdue PM and open corrective actions by site.",
    "Certificate and calibration due tracking without duplicate spreadsheets.",
    "Multi-campus HTM teams share one operational picture.",
  ],
  capabilityMappings: [
    {
      capability: "Regulated PM tracking",
      painSignal: "Overdue PM on patient-connected devices",
      equipifyModule: "Maintenance Plans + Equipment",
    },
    {
      capability: "Recall and corrective work",
      painSignal: "Recall actions not tied to open work orders",
      equipifyModule: "Work Orders",
    },
    {
      capability: "Audit-ready history",
      painSignal: "Manual documentation for surveys",
      equipifyModule: "Service History + Reports",
    },
  ],
  videoStorylines: [
    {
      title: "HTM backlog visibility",
      hook: "Walk through how a biomed director surfaces overdue PM by campus before survey season.",
      audience: "HTM / clinical engineering director",
    },
    {
      title: "Recall to work order",
      hook: "Show closing the loop from recall notice to assigned corrective work with asset context.",
      audience: "Biomed shop supervisor",
    },
  ],
  sharePageStorylines: [
    {
      title: "Clinical engineering readiness",
      hook: "A share page framing audit-ready PM and device history for hospital HTM teams.",
      audience: "Hospital operator",
    },
  ],
  recommendedCtas: [
    "Review HTM workflow fit",
    "See PM and recall tracking",
    "Book a 20-minute HTM walkthrough",
  ],
})

export const GROWTH_INDUSTRY_PLAYBOOK_MEDICAL_EQUIPMENT = buildSeededIndustryPlaybook({
  industryId: "medical_equipment",
  overview:
    "Medical equipment dealers and field service organizations support imaging, DME, and clinical devices for provider accounts with contract SLAs and depot repair workflows.",
  pains: [
    "Contract SLAs and response windows are tracked outside dispatch.",
    "Depot and field repair workflows split history across systems.",
    "Sales and service teams lack shared visibility into account equipment.",
    "Quote-to-service handoffs lose context on recurring failures.",
    "Installed base data is stale when renewals approach.",
  ],
  discoveryQuestions: [
    "How do you track SLA response and uptime commitments by account?",
    "Where does depot repair history live versus field service?",
    "How does sales see installed base before renewal conversations?",
    "What breaks when a repeat failure needs escalation?",
    "How do you schedule PM against contract entitlements?",
  ],
  proofPoints: [
    "Account-level equipment visibility for sales and service.",
    "Work orders respect SLA tiers and capture field vs depot paths.",
    "Service history informs renewal and upsell conversations.",
    "Quotes linked to assets and follow-on work orders.",
    "PM schedules aligned to contract coverage.",
  ],
  recommendedCtas: ["See installed base workflow", "Review SLA dispatch fit", "Book a service ops demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_EQUIPMENT = buildSeededIndustryPlaybook({
  industryId: "commercial_equipment",
  overview:
    "Commercial equipment service teams maintain mixed capital assets across customer sites with PM contracts, emergency response, and parts-heavy repairs.",
  pains: [
    "Technicians arrive without complete asset and prior repair context.",
    "PM contracts do not drive scheduling consistently.",
    "Emergency and contract work compete in the same dispatch queue.",
    "Parts usage is logged after the fact, hurting margin visibility.",
    "Multi-site customers lack a single service history view.",
  ],
  discoveryQuestions: [
    "How do PM contracts translate into scheduled work today?",
    "What do techs see before a repeat failure visit?",
    "How are emergency calls prioritized against contract PM?",
    "Where is parts usage captured relative to the job?",
    "How do you report service history back to multi-site accounts?",
  ],
  proofPoints: [
    "Asset-centric work orders with full service history.",
    "PM plans generate scheduled work automatically.",
    "Dispatch prioritization by contract tier and urgency.",
    "Parts tied to jobs for margin and repeat failure analysis.",
    "Customer portal-ready history for account managers.",
  ],
  recommendedCtas: ["See PM-to-dispatch flow", "Review asset history demo", "Book an operations walkthrough"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_INDUSTRIAL_EQUIPMENT = buildSeededIndustryPlaybook({
  industryId: "industrial_equipment",
  overview:
    "Industrial equipment service providers support plants, utilities, and OEM field teams with outage windows, predictive programs, and safety-critical PM.",
  pains: [
    "Outage PM windows are coordinated manually across trades.",
    "Vibration and inspection findings do not flow into work orders.",
    "Safety lockout documentation is separate from job records.",
    "Multi-crew shutdowns lack shared visibility on scope completion.",
    "Spares and rebuild tracking for rotating assets is fragmented.",
  ],
  discoveryQuestions: [
    "How do you plan and track outage PM scope?",
    "Where do inspection findings become assigned work?",
    "How is safety documentation attached to jobs?",
    "What visibility do supervisors have during shutdowns?",
    "How do you track spares and rebuild cycles on critical assets?",
  ],
  proofPoints: [
    "Shutdown work packages with shared scope visibility.",
    "Inspection-to-work-order linkage for rotating equipment.",
    "Safety and job documentation in one record.",
    "Asset rebuild and spares history over time.",
    "Reporting on PM compliance by plant area.",
  ],
  recommendedCtas: ["Review outage PM workflow", "See plant asset register", "Book an industrial ops demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_FIELD_SERVICE = buildSeededIndustryPlaybook({
  industryId: "field_service",
  overview:
    "General field service operators run dispatch-heavy mixed-trade operations across regions with varied equipment and account types.",
  pains: [
    "Dispatch relies on phone and spreadsheets as volume grows.",
    "Technicians lack consistent mobile access to job and asset context.",
    "Repeat visits happen because history is not visible on route.",
    "Billing and job closeout lag behind completed work.",
    "KPI reporting requires manual exports from multiple tools.",
  ],
  discoveryQuestions: [
    "How are today's jobs assigned and re-prioritized?",
    "What context does a tech see on mobile before arrival?",
    "How do you identify accounts with repeat truck rolls?",
    "What slows job closeout and invoicing?",
    "Which KPIs do you report weekly and where do they come from?",
  ],
  proofPoints: [
    "Dispatch board with live job status and technician assignment.",
    "Mobile-friendly work orders with asset and customer context.",
    "Repeat failure visibility by account and asset.",
    "Job completion flows that support faster invoicing.",
    "Operational dashboards without spreadsheet exports.",
  ],
  recommendedCtas: ["See dispatch workflow", "Review mobile job flow", "Book a field ops demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_CALIBRATION_INSPECTION = buildSeededIndustryPlaybook({
  industryId: "calibration_inspection",
  overview:
    "Calibration and inspection firms manage traceable standards, certificate renewals, and field routes with strict due-date compliance.",
  pains: [
    "Certificate due dates live outside the work order system.",
    "Field and lab workflows use different tracking methods.",
    "Recall of out-of-tolerance instruments is manual.",
    "Customer asset registers drift from actual installed base.",
    "Batch certificate generation is error-prone at month end.",
  ],
  discoveryQuestions: [
    "How do you track calibration due dates by customer asset?",
    "How do lab and field teams share the same asset record?",
    "What happens when an instrument fails calibration?",
    "How often is the customer asset register reconciled?",
    "How are certificates delivered and archived?",
  ],
  proofPoints: [
    "Due-date driven scheduling for cal and inspection routes.",
    "Unified asset records for lab and field teams.",
    "Failed cal events trigger corrective workflows.",
    "Certificate history attached to each asset.",
    "Customer reporting on upcoming and overdue due dates.",
  ],
  recommendedCtas: ["See due-date scheduling", "Review certificate workflow", "Book a metrology demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_FACILITY_MAINTENANCE = buildSeededIndustryPlaybook({
  industryId: "facility_maintenance",
  overview:
    "Facility maintenance teams coordinate building systems, vendor work, and preventive rounds across portfolios.",
  pains: [
    "Tenant requests, vendor jobs, and internal PM sit in separate queues.",
    "Building rounds generate paper that never ties to assets.",
    "Vendor SLA tracking is reactive instead of proactive.",
    "Capital replacement planning lacks service history context.",
    "Multi-building portfolios lack unified backlog visibility.",
  ],
  discoveryQuestions: [
    "How do tenant requests become tracked work?",
    "How are building rounds documented and followed up?",
    "How do you monitor vendor SLA performance?",
    "What data informs capital replacement decisions?",
    "How do you see backlog across buildings?",
  ],
  proofPoints: [
    "Unified queue for tenant, vendor, and internal work.",
    "Round findings linked to assets and follow-up jobs.",
    "Vendor job tracking with SLA timestamps.",
    "Asset history informs replacement planning.",
    "Portfolio-level backlog and PM compliance views.",
  ],
  recommendedCtas: ["See facilities queue", "Review vendor tracking", "Book a portfolio walkthrough"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_HVAC_R = buildSeededIndustryPlaybook({
  industryId: "hvac_r",
  overview: "HVAC-R contractors service comfort and refrigeration systems with seasonal PM spikes and emergency demand.",
  pains: [
    "Seasonal PM volume overwhelms manual scheduling.",
    "Refrigerant and warranty details are not on the work order.",
    "Emergency calls disrupt planned routes.",
    "Maintenance agreements do not auto-generate visits.",
    "Technician notes rarely feed asset history consistently.",
  ],
  discoveryQuestions: [
    "How do you schedule seasonal PM today?",
    "Where do warranty and refrigerant details live on jobs?",
    "How are emergencies prioritized against PM routes?",
    "Do service agreements create scheduled work automatically?",
  ],
  proofPoints: [
    "Agreement-driven PM scheduling.",
    "Asset history with refrigerant and warranty context.",
    "Dispatch that balances emergency and PM workload.",
    "Seasonal capacity visibility for ops leads.",
  ],
  recommendedCtas: ["See seasonal PM scheduling", "Review HVAC dispatch demo"],
})

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

export const GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_HVAC = buildSeededIndustryPlaybook({
  industryId: "commercial_hvac",
  overview: "Commercial HVAC teams maintain RTUs, BAS-linked comfort systems, and multi-site mechanical contracts.",
  pains: [
    "RTU PM routes are hard to balance across campuses.",
    "BAS trends do not tie to assigned corrective work.",
    "Filter and belt PM kits are not linked to assets.",
  ],
  discoveryQuestions: [
    "How do you plan RTU PM across multiple sites?",
    "How are comfort complaints tracked to assets?",
  ],
  proofPoints: [
    "Campus-level PM scheduling for RTUs.",
    "Complaint-to-work-order linkage with asset context.",
    "PM parts checklist tied to equipment.",
  ],
  recommendedCtas: ["Review commercial HVAC PM", "Book a mechanical ops demo"],
})

export const GROWTH_INDUSTRY_PLAYBOOK_COMMERCIAL_KITCHEN = buildSeededIndustryPlaybook({
  industryId: "commercial_kitchen",
  overview: "Commercial kitchen equipment service teams support restaurants, chains, and foodservice distributors.",
  pains: [
    "Downtime SLAs are tracked outside dispatch.",
    "Line equipment history is split by brand and site.",
    "PM for hood and refrigeration lines is inconsistent.",
  ],
  discoveryQuestions: [
    "How do you track downtime SLAs for chain accounts?",
    "How is line equipment history shared across locations?",
  ],
  proofPoints: [
    "SLA-aware dispatch for kitchen downtime.",
    "Site and line-level asset history.",
    "PM programs for refrigeration and cooking lines.",
  ],
  recommendedCtas: ["See kitchen SLA dispatch", "Book a foodservice demo"],
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
