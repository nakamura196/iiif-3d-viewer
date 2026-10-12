// IIIF Presentation API 4 (3D TSG) types used by the viewer.
// Aligned with: https://iiif.github.io/3d/temp-draft-4.html

export type IIIFLocalized = Record<string, string[]>;
export type IIIFMotivation = string | string[];

export interface PointSelectorV4 {
  type: 'PointSelector';
  x: number;
  y: number;
  z: number;
  // Non-standard extension: outward normal of the annotated feature (from
  // Voyager `direction`). Lets the viewer frame the feature head-on.
  normal?: [number, number, number];
}

// Presentation 4 spells it `WktSelector`. `WKTSelector` is the spelling this
// viewer's converter emitted before; both are accepted on input.
export interface WKTSelectorV4 {
  type: 'WktSelector' | 'WKTSelector';
  value: string;
}

export type SelectorV4 = PointSelectorV4 | WKTSelectorV4;

export interface SpecificResourceV4 {
  // Required by Presentation 4. Annotations whose targets share this id
  // annotate the same region (Shared Region extension).
  id?: string;
  type: 'SpecificResource';
  source: Array<{ id?: string; type?: string }>;
  selector?: SelectorV4[];
}

export interface AnnotationBodyTextual {
  type: 'TextualBody';
  value: string;
  format?: string;
  language?: string;
  // Presentation 4 requires a language map; plain strings are tolerated.
  label?: string | IIIFLocalized;
  // `tagging` marks a tag; its `label` is the tag's key (Keyed Tag extension).
  purpose?: string | string[];
}

export interface AnnotationBodyModel {
  id: string;
  type: 'Model';
  format?: string;
}

export type AnnotationBodyV4 =
  | AnnotationBodyTextual
  | AnnotationBodyModel
  | Record<string, unknown>;

export interface AnnotationLinkV4 {
  id: string;
  type?: string;
  label?: string | string[] | IIIFLocalized;
  format?: string;
}

export interface AnnotationV4 {
  id: string;
  type: 'Annotation';
  motivation: IIIFMotivation;
  body?: AnnotationBodyV4 | AnnotationBodyV4[];
  bodyValue?: string;
  // W3C Web Annotation provenance.
  creator?: string | { id?: string; name?: string; nickname?: string } | Array<string | { id?: string; name?: string; nickname?: string }>;
  created?: string;
  target: SpecificResourceV4 | string;
  seeAlso?: AnnotationLinkV4[];
  // Linkage to a PerspectiveCamera annotation that captures the
  // recommended viewing camera for this annotation. Convention used
  // by this viewer: `${annotation.id}/camera`.
  cameraAnnotation?: string;
  // Presentation 4.0: the Annotation's own label (heading of a note), and `scope`,
  // which links a commenting Annotation to the Camera Annotation(s) to view it with.
  label?: string | string[] | IIIFLocalized;
  scope?: string | { id: string; type?: string } | Array<string | { id: string; type?: string }>;
  behavior?: string[];
}

export interface AnnotationPageV4 {
  id?: string;
  type: 'AnnotationPage';
  items: AnnotationV4[];
}

export interface SceneV4 {
  id: string;
  type: 'Scene';
  label?: string | string[] | IIIFLocalized;
  // Painting annotations placing models / cameras into the scene.
  items?: AnnotationPageV4[];
  // Commenting / georeferencing / other non-painting annotations.
  annotations?: AnnotationPageV4[];
}

// A Canvas (images, video) or a Timeline (audio) in Presentation 4. Like a Scene it holds
// painting Annotations in `items` and supplementing ones (captions, transcripts) in
// `annotations`, so the same page type serves all three.
export interface CanvasV4 {
  id: string;
  type: 'Canvas';
  label?: string | string[] | IIIFLocalized;
  width?: number;
  height?: number;
  duration?: number;
  items?: AnnotationPageV4[];
  annotations?: AnnotationPageV4[];
}

export interface TimelineV4 {
  id: string;
  type: 'Timeline';
  label?: string | string[] | IIIFLocalized;
  duration?: number;
  items?: AnnotationPageV4[];
  annotations?: AnnotationPageV4[];
}

export type ContainerV4 = SceneV4 | CanvasV4 | TimelineV4;

export interface ManifestV4 {
  '@context': string | string[];
  id: string;
  type: 'Manifest';
  label?: string | string[] | IIIFLocalized;
  summary?: string | string[] | IIIFLocalized;
  metadata?: Array<{ label: unknown; value: unknown }>;
  rights?: string;
  requiredStatement?: { label: unknown; value: unknown };
  provider?: unknown[];
  items: ContainerV4[];
  // Pass-through fields preserved as-is.
  [extra: string]: unknown;
}
