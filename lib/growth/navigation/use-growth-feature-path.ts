"use client"

import { usePathname } from "next/navigation"
import {
  growthFeaturePath,
  resolveGrowthFeatureBasePath,
} from "@/lib/growth/navigation/growth-workspace-base-path"

export function useGrowthFeatureBasePath(): string {
  const pathname = usePathname()
  return resolveGrowthFeatureBasePath(pathname)
}

export function useGrowthFeaturePath(segment = ""): string {
  const pathname = usePathname()
  return growthFeaturePath(pathname, segment)
}
