/** GE-AIOS-2J — Context package validation. Delegates to @fuzor/context. */

export {
  validatePlatformContextPackage as validateAiContextPackage,
  validatePlatformContextPackageContent as validateAiContextPackageContent,
  validatePlatformContextWorkOrderSection as validateAiContextWorkOrderSection,
} from "@fuzor/context"

export type { PlatformContextAssemblyValidationResult as AiContextAssemblyValidationResult } from "@fuzor/context"
