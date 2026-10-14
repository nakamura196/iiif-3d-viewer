import { infoPanel, rightsPanel } from './AboutPanel';
import { inferencePanel } from './InferencePanel';
import { annotationTranscriptPanel } from './AnnotationTranscriptPanel';
import { annotationsPanel } from './AnnotationsPanel';
import { canvasAnnotationsPanel } from './CanvasAnnotationsPanel';
import { layersPanel } from './LayersPanel';
import { mapPanel } from './MapPanel';
import { pagesPanel } from './PagesPanel';
import { structurePanel } from './StructurePanel';
import { transcriptPanel } from './TranscriptTab';
import type { Panel } from './types';

// タブの並び順。新しいタブは、ここに 1 行足す。
export const PANELS: Panel[] = [
  infoPanel,
  pagesPanel,
  structurePanel,
  layersPanel,
  mapPanel,
  rightsPanel,
  transcriptPanel,
  annotationTranscriptPanel,
  canvasAnnotationsPanel,
  annotationsPanel,
  inferencePanel,
];
