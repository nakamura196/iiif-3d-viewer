// Shared Region extension: annotations whose target Specific Resources share
// an id annotate the same region, and are shown as one group.
// Grouping is by id only — equal coordinates alone never merge annotations.

// Works for the 3D annotations and for the annotations on a Canvas (2D): anything with an id and a regionId.

export interface Regional {
  id: string;
  regionId?: string;
}

export interface RegionGroup<T extends Regional = Regional> {
  // regionId when shared, otherwise the lone annotation's id.
  key: string;
  // In document order. The first one supplies the region's geometry.
  annotations: T[];
}

export const groupByRegion = <T extends Regional>(annotations: T[]): RegionGroup<T>[] => {
  const groups: RegionGroup<T>[] = [];
  const byRegion = new Map<string, RegionGroup<T>>();
  for (const annotation of annotations) {
    const regionId = annotation.regionId;
    const existing = regionId ? byRegion.get(regionId) : undefined;
    if (existing) {
      existing.annotations.push(annotation);
      continue;
    }
    const group: RegionGroup<T> = { key: regionId ?? annotation.id, annotations: [annotation] };
    groups.push(group);
    if (regionId) byRegion.set(regionId, group);
  }
  return groups;
};
