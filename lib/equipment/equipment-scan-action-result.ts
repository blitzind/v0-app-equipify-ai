/** JSON-serializable Server Action payload for equipment AI scan (no Dates/Buffers/undefined). */

export type EquipmentScanFieldPayload = {
  name: string
  equipmentType: string
  subcategory: string
  manufacturer: string
  model: string
  serialNumber: string
  installDate: string
  warrantyExpiration: string
  lastServiceDate: string
  nextServiceDue: string
  nextCalibrationDue: string
  calibrationIntervalMonths: string
  serviceInterval: string
  notes: string
  documentCustomerHint: string
}

export type EquipmentScanData = {
  sourceKind: "image" | "pdf"
  fields: EquipmentScanFieldPayload
}

export type EquipmentScanActionOk = { ok: true; data: EquipmentScanData }

export type EquipmentScanActionErr = {
  ok: false
  code: string
  stage: string
  message: string
}

export type EquipmentScanActionResult = EquipmentScanActionOk | EquipmentScanActionErr
