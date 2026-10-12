import { annotationsPanel } from './AnnotationsPanel';
import { canvasAnnotationsPanel } from './CanvasAnnotationsPanel';
import { metadataPanel } from './MetadataPanel';
import { transcriptPanel } from './TranscriptTab';
import type { Panel } from './types';

// タブの並び順。新しいタブは、ここに 1 行足す。
export const PANELS: Panel[] = [metadataPanel, transcriptPanel, annotationsPanel, canvasAnnotationsPanel];
