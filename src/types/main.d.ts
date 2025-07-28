import type { Vector3 } from 'three';

export interface Annotation {
  id: string;
  creator: string;
  title: string;
  description: string;
  media: [];
  wikidata: [];
  bibliography: [];
  position: {
    x: number;
    y: number;
    z: number;
  };
  target_manifest?: string;
  data: {
    body: {
      value: string;
      label: string;
    };
    target: {
      selector: {
        type: string;
        value: [number, number, number];
        area: [number, number, number];
        camPos: [number, number, number];
      };
    };
  };
}

export interface NewAnnotation {
  id: string;
  creator: string;
  title: string;
  description: string;
  media: [];
  wikidata: [];
  bibliography: [];
  position: {
    x: number;
    y: number;
    z: number;
  };
  target_manifest: string;
  target_canvas: string;
  data: {
    body: {
      value: OutputData;
      label: string;
      type: string;
    };
    target: {
      selector: {
        type: string;
        value: [number, number, number];
        area: [number, number, number];
        camPos: [number, number, number];
      };
    };
  };
}

export interface IIIFAnnotation {
  id: string;
  type: string;
  motivation: string;
  body: { value: string; label: string; type: string };
  target: { source: string; selector: { value: [number, number, number]; type: string } };
}
interface MediaItem {
  type: string;
  source: string;
  caption: string;
}

interface WikidataItem {
  type: string;
  label: string;
  uri: string;
  wikipedia?: string;
  lat?: string;
  lng?: string;
}

interface BibliographyItem {
  author: string;
  title: string;
  year: string;
  page?: string;
  pdf?: string;
}

export interface InfoPanelContent {
  id: string;
  creator: string;
  title: string;
  description: string;
  media: MediaItem[];
  wikidata: WikidataItem[];
  bibliography: BibliographyItem[];
}

export interface Annotation3 {
  id: string;
  position: Vector3;
  content: string;
  cameraPosition: Vector3;
  targetPosition: Vector3;
}
