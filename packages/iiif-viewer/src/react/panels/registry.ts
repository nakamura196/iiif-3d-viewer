import { aboutPanel } from './AboutPanel';
import { annotationTranscriptPanel } from './AnnotationTranscriptPanel';
import { annotationsPanel } from './AnnotationsPanel';
import { canvasAnnotationsPanel } from './CanvasAnnotationsPanel';
import { layersPanel } from './LayersPanel';
import { metadataPanel } from './MetadataPanel';
import { structurePanel } from './StructurePanel';
import { transcriptPanel } from './TranscriptTab';
import type { Panel } from './types';

// タブの並び順。新しいタブは、ここに 1 行足す。
export const PANELS: Panel[] = [
  metadataPanel,
  structurePanel,
  layersPanel,
  aboutPanel,
  transcriptPanel,
  annotationTranscriptPanel,
  canvasAnnotationsPanel,
  annotationsPanel,
];
