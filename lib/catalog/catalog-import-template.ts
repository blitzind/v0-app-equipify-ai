import { downloadCsv, rowsToCsv } from "@/lib/reporting/export-csv"

export const CATALOG_IMPORT_TEMPLATE_FILENAME = "equipify-catalog-import-template.csv"

export const CATALOG_IMPORT_TEMPLATE_HEADERS = [
  "Item Name",
  "Part Number",
  "SKU",
  "Description",
  "Type",
  "Category",
  "Manufacturer",
  "Vendor",
  "Unit",
  "Unit Cost",
  "List Price",
  "Effective Date",
  "Notes",
] as const

export type CatalogImportTemplateRow = Record<(typeof CATALOG_IMPORT_TEMPLATE_HEADERS)[number], string>

export const CATALOG_IMPORT_TEMPLATE_EXAMPLE_ROWS: CatalogImportTemplateRow[] = [
  {
    "Item Name": "Ultrasound probe cover",
    "Part Number": "USC-100",
    SKU: "MED-USC-100",
    Description: "Disposable ultrasound probe cover",
    Type: "Part",
    Category: "Imaging",
    Manufacturer: "Example Medical",
    Vendor: "Example Vendor",
    Unit: "each",
    "Unit Cost": "12.50",
    "List Price": "25.00",
    "Effective Date": "2026-01-01",
    Notes: "Replace with your real item data",
  },
  {
    "Item Name": "Preventive maintenance labor",
    "Part Number": "LAB-PM",
    SKU: "LAB-PM-001",
    Description: "Standard preventive maintenance labor line",
    Type: "Service",
    Category: "Labor",
    Manufacturer: "",
    Vendor: "",
    Unit: "hour",
    "Unit Cost": "75.00",
    "List Price": "125.00",
    "Effective Date": "2026-01-01",
    Notes: "Optional service/labor catalog item",
  },
]

/** Example row with commas/quotes to verify CSV escaping in tests. */
export const CATALOG_IMPORT_TEMPLATE_ESCAPING_EXAMPLE: CatalogImportTemplateRow = {
  "Item Name": 'Probe cover, large "XL"',
  "Part Number": "USC-200",
  SKU: "MED-USC-200",
  Description: "Line one\nLine two",
  Type: "Part",
  Category: "Imaging",
  Manufacturer: "Example Medical",
  Vendor: "Example Vendor",
  Unit: "each",
  "Unit Cost": "15.00",
  "List Price": "30.00",
  "Effective Date": "2026-01-01",
  Notes: 'Includes "starter kit", optional',
}

export function generateCatalogImportTemplateCsv(
  includeEscapingExample = false,
): string {
  const rows: string[][] = [[...CATALOG_IMPORT_TEMPLATE_HEADERS]]
  for (const example of CATALOG_IMPORT_TEMPLATE_EXAMPLE_ROWS) {
    rows.push(CATALOG_IMPORT_TEMPLATE_HEADERS.map((h) => example[h] ?? ""))
  }
  if (includeEscapingExample) {
    rows.push(CATALOG_IMPORT_TEMPLATE_HEADERS.map((h) => CATALOG_IMPORT_TEMPLATE_ESCAPING_EXAMPLE[h] ?? ""))
  }
  return rowsToCsv(rows)
}

export function downloadCatalogImportTemplate(): void {
  downloadCsv(CATALOG_IMPORT_TEMPLATE_FILENAME, generateCatalogImportTemplateCsv())
}
