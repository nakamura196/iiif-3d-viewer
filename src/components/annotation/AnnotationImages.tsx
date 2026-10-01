import type { AnnotationImage } from '@/types/main';

// A thumbnail URL for an Image body: from its IIIF Image API service when present
// (the full image may be large), otherwise the image itself.
export const thumbnailOf = (image: AnnotationImage, size = 240): string =>
  image.service ? `${image.service}/full/!${size},${size}/0/default.jpg` : image.id;

// Pictures of the annotated place (Image bodies). Each opens the holding
// institution's page when given, otherwise the image itself.
export default function AnnotationImages({ images }: { images: AnnotationImage[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((image) => (
        <a
          key={image.id}
          href={image.homepage ?? image.id}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-28"
          title={image.homepageLabel ?? image.label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external IIIF images */}
          <img
            src={thumbnailOf(image)}
            alt={image.label ?? ''}
            loading="lazy"
            className="w-28 h-28 object-cover rounded border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
          />
          {image.label && (
            <span className="mt-1 block text-xs leading-snug text-gray-600 dark:text-gray-300 line-clamp-2">
              {image.label}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
