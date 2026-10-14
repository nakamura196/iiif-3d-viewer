// /viewer の ?tab= に指定できるタブ。ViewerContent が URL を読むときと、
// ユースケース・サンプルが「開いたあとに選ぶタブ」を書くときの両方で使う
export const VIEWER_TABS = [
  'metadata',
  'pages',
  'structure',
  'layers',
  'rights',
  'transcript',
  'annotationTranscript',
  'canvasAnnotations',
  'annotations',
  'inference',
] as const;

export type ViewerTab = (typeof VIEWER_TABS)[number];

export const isViewerTab = (v: string | null | undefined): v is ViewerTab =>
  !!v && (VIEWER_TABS as readonly string[]).includes(v);
