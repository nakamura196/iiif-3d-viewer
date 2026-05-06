// IIIF Presentation API 4 (3D TSG) types used by the viewer.
// Aligned with: https://iiif.github.io/3d/temp-draft-4.html

export type IIIFLocalized = Record<string, string[]>;
export type IIIFMotivation = string | string[];

export interface PointSelectorV4 {
  type: 'PointSelector';
  x: number;
  y: number;
  z: number;
}

export interface WKTSelectorV4 {
  type: 'WKTSelector';
  value: string;
}

export type SelectorV4 = PointSelectorV4 | WKTSelectorV4;

export interface SpecificResourceV4 {
  type: 'SpecificResource';
  source: Array<{ id?: string; type?: string }>;
  selector?: SelectorV4[];
}

export interface AnnotationBodyTextual {
  type: 'TextualBody';
  value: string;
  format?: string;
  language?: string;
  label?: string;
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
  body?: AnnotationBodyV4;
  bodyValue?: string;
  target: SpecificResourceV4 | string;
  seeAlso?: AnnotationLinkV4[];
  // Linkage to a PerspectiveCamera annotation that captures the
  // recommended viewing camera for this annotation. Convention used
  // by this viewer: `${annotation.id}/camera`.
  cameraAnnotation?: string;
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
  items: SceneV4[];
  // Pass-through fields preserved as-is.
  [extra: string]: unknown;
}
