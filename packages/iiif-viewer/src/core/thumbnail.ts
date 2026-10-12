import type { AnnotationImage } from './types/main';

// A thumbnail URL for an Image body: from its IIIF Image API service when present
// (the full image may be large), otherwise the image itself.
export const thumbnailOf = (image: AnnotationImage, size = 240): string =>
  image.service ? `${image.service}/full/!${size},${size}/0/default.jpg` : image.id;
