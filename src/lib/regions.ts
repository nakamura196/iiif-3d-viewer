// Shared Region extension: annotations whose target Specific Resources share
// an id annotate the same region, and are shown as one group.
// Grouping is by id only — equal coordinates alone never merge annotations.

import type { Annotation } from '@/types/main';

export interface RegionGroup {
  // regionId when shared, otherwise the lone annotation's id.
  key: string;
  // In document order. The first one supplies the region's geometry.
  annotations: Annotation[];
}

export const groupByRegion = (annotations: Annotation[]): RegionGroup[] => {
  const groups: RegionGroup[] = [];
  const byRegion = new Map<string, RegionGroup>();
  for (const annotation of annotations) {
    const regionId = annotation.regionId;
    const existing = regionId ? byRegion.get(regionId) : undefined;
    if (existing) {
      existing.annotations.push(annotation);
      continue;
    }
    const group = { key: regionId ?? annotation.id, annotations: [annotation] };
    groups.push(group);
    if (regionId) byRegion.set(regionId, group);
  }
  return groups;
};
