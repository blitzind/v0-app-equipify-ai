/**
 * One-off / regen helper: writes lib/equipment-type-icons.tsx from the ROWS table.
 * Run: node scripts/generate-equipment-type-icons-module.mjs
 */
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const req = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "lib/equipment-type-icons.tsx")

/** [iconExportName, category, keywords] — icon must exist on lucide-react */
const ROWS = [
  ["Thermometer", "HVAC & refrigeration", "temperature thermostat heating cooling climate"],
  ["Snowflake", "HVAC & refrigeration", "refrigeration cold ac ice freezer"],
  ["Wind", "HVAC & refrigeration", "airflow ventilation blower duct"],
  ["Fan", "HVAC & refrigeration", "blower motor exhaust intake"],
  ["AirVent", "HVAC & refrigeration", "duct register grille diffuser"],
  ["ThermometerSun", "HVAC & refrigeration", "heat hot summer cooling load"],
  ["Heater", "HVAC & refrigeration", "furnace boiler heat pump"],
  ["CloudRain", "HVAC & refrigeration", "humidity dehumidifier moisture"],
  ["WindArrowDown", "HVAC & refrigeration", "draft airflow damper"],
  ["Zap", "Electrical & lighting", "electric voltage spark wiring"],
  ["ZapOff", "Electrical & lighting", "disconnect outage breaker"],
  ["Plug", "Electrical & lighting", "outlet receptacle cord"],
  ["Plug2", "Electrical & lighting", "twist lock connector"],
  ["PlugZap", "Electrical & lighting", "ev charger high voltage"],
  ["Cable", "Electrical & lighting", "wire harness conduit"],
  ["Lightbulb", "Electrical & lighting", "lamp fixture led"],
  ["CircuitBoard", "Electrical & lighting", "pcb control board electronics"],
  ["Battery", "Electrical & lighting", "ups storage backup"],
  ["BatteryCharging", "Electrical & lighting", "charge inverter"],
  ["BatteryWarning", "Electrical & lighting", "fault low voltage"],
  ["BatteryMedium", "Electrical & lighting", "state of charge"],
  ["BatteryFull", "Electrical & lighting", "full charge"],
  ["EthernetPort", "IT & networking", "lan switch patch panel"],
  ["Router", "IT & networking", "wifi gateway network"],
  ["Network", "IT & networking", "topology vlan"],
  ["Wifi", "IT & networking", "wireless access point"],
  ["Server", "IT & networking", "rack data center host"],
  ["Cloud", "IT & networking", "hosted saas sync"],
  ["Database", "IT & networking", "sql records backup"],
  ["Cpu", "IT & networking", "compute processor edge"],
  ["PcCase", "IT & networking", "workstation desktop tower"],
  ["Monitor", "IT & networking", "display kvm"],
  ["Printer", "IT & networking", "mfp label"],
  ["Smartphone", "IT & networking", "mobile mdm"],
  ["QrCode", "IT & networking", "asset tag scan"],
  ["ScanBarcode", "IT & networking", "inventory sku"],
  ["FileCode", "IT & networking", "script automation api"],
  ["Braces", "IT & networking", "json config developer"],
  ["Droplets", "Plumbing & water", "water leak flow"],
  ["Droplet", "Plumbing & water", "moisture drip"],
  ["Waves", "Plumbing & water", "fluid circulation pump"],
  ["ShowerHead", "Plumbing & water", "fixture bath"],
  ["ArrowUpDown", "Plumbing & water", "pressure balancing mixing valve"],
  ["Stethoscope", "Medical & diagnostics", "clinical patient vitals"],
  ["HeartPulse", "Medical & diagnostics", "ecg cardiac monitor"],
  ["Syringe", "Medical & diagnostics", "injection vaccine"],
  ["Pill", "Medical & diagnostics", "pharmacy medication"],
  ["Microscope", "Medical & diagnostics", "pathology lab"],
  ["ScanLine", "Medical & diagnostics", "mri ct imaging"],
  ["Scan", "Medical & diagnostics", "ultrasound diagnostic"],
  ["Hospital", "Medical & diagnostics", "clinic ward"],
  ["Ambulance", "Medical & diagnostics", "ems transport"],
  ["BedDouble", "Medical & diagnostics", "patient bed"],
  ["Activity", "Medical & diagnostics", "vitals telemetry"],
  ["Dna", "Medical & diagnostics", "genomics research"],
  ["Pipette", "Medical & diagnostics", "liquid handling assay"],
  ["Beaker", "Medical & diagnostics", "chemistry buffer"],
  ["FlaskConical", "Medical & diagnostics", "titration lab"],
  ["TestTube", "Medical & diagnostics", "sample qc"],
  ["Radiation", "Medical & diagnostics", "radiology imaging hazmat signage"],
  ["FileHeart", "Medical & diagnostics", "records hipaa"],
  ["Flame", "Fire & security", "fire suppression detection"],
  ["FireExtinguisher", "Fire & security", "portable extinguisher"],
  ["Siren", "Fire & security", "alarm notification"],
  ["ShieldAlert", "Fire & security", "intrusion breach"],
  ["Shield", "Fire & security", "perimeter hardening"],
  ["ShieldHalf", "Fire & security", "policy segmentation"],
  ["ShieldCheck", "Fire & security", "verified protection"],
  ["Lock", "Fire & security", "access control door"],
  ["Key", "Fire & security", "master keying rekey"],
  ["KeyRound", "Fire & security", "fob credential"],
  ["Camera", "Fire & security", "cctv video surveillance"],
  ["Eye", "Fire & security", "monitoring audit"],
  ["Bell", "Fire & security", "notification pager"],
  ["Truck", "Fleet & field service", "service van dispatch"],
  ["TruckElectric", "Fleet & field service", "ev fleet charging"],
  ["Car", "Fleet & field service", "light duty vehicle"],
  ["Bus", "Fleet & field service", "shuttle transit"],
  ["Bike", "Fleet & field service", "ebike courier"],
  ["Tractor", "Fleet & field service", "ag equipment"],
  ["TrainFront", "Fleet & field service", "rail logistics"],
  ["Plane", "Fleet & field service", "air cargo gse"],
  ["Ship", "Fleet & field service", "marine port"],
  ["Anchor", "Fleet & field service", "mooring dock"],
  ["MapPin", "Fleet & field service", "route geofence"],
  ["Route", "Fleet & field service", "routing stops"],
  ["Navigation", "Fleet & field service", "gps guidance"],
  ["ClipboardList", "Fleet & field service", "job checklist"],
  ["ClipboardCheck", "Fleet & field service", "closeout signoff jsa permit checklist"],
  ["ClipboardType", "Fleet & field service", "forms paperwork"],
  ["ListChecks", "Fleet & field service", "punch list qa"],
  ["HardHat", "Fleet & field service", "technician jobsite"],
  ["Timer", "Fleet & field service", "sla response"],
  ["Factory", "Industrial & manufacturing", "plant production line"],
  ["Cog", "Industrial & manufacturing", "machine gearbox drive"],
  ["Anvil", "Industrial & manufacturing", "metal fab forging"],
  ["Forklift", "Industrial & manufacturing", "warehouse lift"],
  ["TowerControl", "Industrial & manufacturing", "plc scada controls"],
  ["Gauge", "Industrial & manufacturing", "instrumentation dial"],
  ["CircleGauge", "Industrial & manufacturing", "pressure vacuum"],
  ["Vibrate", "Industrial & manufacturing", "vibration analysis"],
  ["Drill", "Industrial & manufacturing", "machining spindle"],
  ["Pickaxe", "Industrial & manufacturing", "mining heavy"],
  ["Container", "Industrial & manufacturing", "iso tank intermodal"],
  ["Layers", "Industrial & manufacturing", "stack lamination"],
  ["LayoutGrid", "Industrial & manufacturing", "cells line balance"],
  ["Rocket", "Industrial & manufacturing", "aerospace tooling"],
  ["Satellite", "Industrial & manufacturing", "telemetry remote"],
  ["Radar", "Industrial & manufacturing", "motion detection"],
  ["ChefHat", "Food service", "kitchen restaurant"],
  ["UtensilsCrossed", "Food service", "dining servery"],
  ["Coffee", "Food service", "espresso hot beverage"],
  ["Wine", "Food service", "bar cellar"],
  ["Microwave", "Appliances & home", "countertop cook"],
  ["Refrigerator", "Appliances & home", "cold storage reach in"],
  ["WashingMachine", "Appliances & home", "laundry opl"],
  ["Tv", "Audio / video", "display signage"],
  ["Video", "Audio / video", "conferencing av"],
  ["Speaker", "Audio / video", "pa sound"],
  ["Headphones", "Audio / video", "headset comms"],
  ["Music2", "Audio / video", "media playback"],
  ["Projector", "Audio / video", "cinema boardroom"],
  ["Radio", "Audio / video", "two way wireless"],
  ["Power", "Power & energy", "mains distribution"],
  ["Sun", "Power & energy", "solar pv inverter"],
  ["Fuel", "Power & energy", "diesel propane tank"],
  ["CircleParking", "Logistics & storage", "yard staging"],
  ["ParkingMeter", "Logistics & storage", "curb equipment"],
  ["Package", "Logistics & storage", "parcel carton"],
  ["Package2", "Logistics & storage", "bulk pallet"],
  ["Box", "Logistics & storage", "crate tote"],
  ["Boxes", "Logistics & storage", "inventory sku"],
  ["Warehouse", "Logistics & storage", "dc storage rack"],
  ["Fence", "Logistics & storage", "yard perimeter"],
  ["Hammer", "Tools & site work", "carpentry repair"],
  ["Axe", "Tools & site work", "tree trim"],
  ["Shovel", "Tools & site work", "excavation trench"],
  ["Ruler", "Tools & site work", "measure layout"],
  ["Wrench", "Tools & site work", "mechanical service"],
  ["SprayCan", "Tools & site work", "paint coating"],
  ["Paintbrush", "Tools & site work", "finishing touchup"],
  ["Compass", "Tools & site work", "survey layout"],
  ["Telescope", "Tools & site work", "alignment optics"],
  ["Binoculars", "Tools & site work", "inspection locate"],
  ["BadgeCheck", "Safety & compliance", "certified inspection"],
  ["BadgePercent", "Safety & compliance", "warranty terms"],
  ["TriangleAlert", "Safety & compliance", "hazard warning"],
  ["AlertTriangle", "Safety & compliance", "incident caution"],
  ["OctagonAlert", "Safety & compliance", "stop lockout tagout"],
  ["DoorClosed", "Building & access", "entry secure"],
  ["DoorOpen", "Building & access", "access egress"],
  ["Building2", "Building & access", "facilities bms"],
  ["Landmark", "Building & access", "public campus"],
  ["Bed", "Building & access", "lodging hospitality"],
  ["LeafyGreen", "Building & access", "grounds irrigation"],
  ["Gem", "General", "high value jewelry asset"],
  ["Archive", "General", "records retention"],
  ["CircleDot", "General", "status point io"],
  ["Settings", "General", "configuration tune"],
]

const names = [...new Set(ROWS.map((r) => r[0]))].sort()

const tuples = ROWS
  .map(
    ([name, cat, kw]) =>
      `  ["${name}", ${JSON.stringify(cat)}, ${JSON.stringify(kw)}, ${name}],`,
  )
  .join("\n")

const header = `import type { LucideIcon } from "lucide-react"
import {
${names.join(",\n")}
} from "lucide-react"

/** Stable section order in the icon picker (unknown categories sort last). */
export const EQUIPMENT_TYPE_ICON_CATEGORY_ORDER = [
  "HVAC & refrigeration",
  "Electrical & lighting",
  "Plumbing & water",
  "Medical & diagnostics",
  "Fire & security",
  "Fleet & field service",
  "Industrial & manufacturing",
  "Food service",
  "Appliances & home",
  "IT & networking",
  "Audio / video",
  "Power & energy",
  "Logistics & storage",
  "Tools & site work",
  "Safety & compliance",
  "Building & access",
  "General",
] as const

type IconRow = readonly [string, string, string, LucideIcon]

const ICON_ROWS: IconRow[] = [
${tuples}
]

export const EQUIPMENT_TYPE_ICON_CATALOG = ICON_ROWS.map(([name, category, keywords]) => ({
  name,
  category,
  keywords,
}))

export const ICON_OPTIONS = ICON_ROWS.map(([name]) => name) as readonly string[]

export type IconName = string

const EQUIPMENT_TYPE_ICON_MAP = Object.fromEntries(ICON_ROWS.map(([name, , , Icon]) => [name, Icon])) as Record<
  string,
  LucideIcon
>

export function EquipmentTypeIcon({
  name,
  size = 16,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const Icon = EQUIPMENT_TYPE_ICON_MAP[name] ?? Wrench
  return <Icon size={size} className={className} />
}

export function getEquipmentTypeLucideIcon(name: string): LucideIcon {
  return EQUIPMENT_TYPE_ICON_MAP[name] ?? Wrench
}
`

if (!names.includes("Wrench")) {
  console.error("Wrench missing from names")
  process.exit(1)
}

const lucide = req("lucide-react")
for (const n of names) {
  if (!(n in lucide)) {
    console.error("Missing export on lucide-react:", n)
    process.exit(1)
  }
}

fs.writeFileSync(out, header)
console.log("wrote", out, "icons:", names.length, "rows:", ROWS.length)
