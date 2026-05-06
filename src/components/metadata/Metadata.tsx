import {
  Label,
  Metadata as CloverMetadata,
  SeeAlso,
  ResourceList,
  Summary,
  Provider,
  Rights,
  RequiredStatement,
  Thumbnail,
  Behavior,
  Chip,
  PrimitivesExternalWebResource,
  type IIIFLabel,
  type MetadataItem,
} from '@/components/iiif/primitives';
import { useTranslations } from 'next-intl';

import { useAtomValue } from 'jotai';
import { manifestAtom } from '@/atoms/infoPanelAtom';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-b pb-2 border-gray-200 dark:border-gray-700">
    <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
    <div className="text-gray-900 dark:text-gray-100">{children}</div>
  </div>
);

const Metadata = () => {
  const t = useTranslations('Metadata');
  const manifest = useAtomValue(manifestAtom);

  if (!manifest) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900">
        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t('metadata')}</h2>
      </div>
    );
  }

  const m = manifest as typeof manifest & {
    requiredStatement?: MetadataItem;
    navDate?: string;
    thumbnail?: PrimitivesExternalWebResource[];
    homepage?: PrimitivesExternalWebResource[];
    rendering?: PrimitivesExternalWebResource[];
    seeAlso?: PrimitivesExternalWebResource[];
    partOf?: PrimitivesExternalWebResource[];
    provider?: Parameters<typeof Provider>[0]['provider'];
    rights?: string;
    viewingDirection?: string;
    behavior?: string[];
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t('metadata')}</h2>
      <div className="space-y-4">
        <Section title={t('title')}>
          <Label label={m.label as IIIFLabel} as="span" />
        </Section>

        {m.thumbnail && m.thumbnail.length > 0 && (
          <Section title={t('thumbnail')}>
            <Thumbnail thumbnail={m.thumbnail as Parameters<typeof Thumbnail>[0]['thumbnail']} />
          </Section>
        )}

        {m.summary && (
          <Section title={t('description')}>
            <Summary summary={m.summary as IIIFLabel} />
          </Section>
        )}

        {m.metadata && (m.metadata as MetadataItem[]).length > 0 && (
          <Section title={t('metadata')}>
            <CloverMetadata metadata={(m.metadata || []) as MetadataItem[]} />
          </Section>
        )}

        {m.requiredStatement && (
          <Section title={t('requiredStatement')}>
            <RequiredStatement requiredStatement={m.requiredStatement as MetadataItem} />
          </Section>
        )}

        {m.rights && (
          <Section title={t('rights')}>
            <Rights rights={m.rights} />
          </Section>
        )}

        {m.navDate && (
          <Section title={t('navDate')}>
            <span>{m.navDate}</span>
          </Section>
        )}

        {m.provider && m.provider.length > 0 && (
          <Section title={t('provider')}>
            <Provider provider={m.provider} />
          </Section>
        )}

        {m.homepage && m.homepage.length > 0 && (
          <Section title={t('homepage')}>
            <ResourceList seeAlso={m.homepage as PrimitivesExternalWebResource[]} />
          </Section>
        )}

        {m.rendering && m.rendering.length > 0 && (
          <Section title={t('rendering')}>
            <ResourceList seeAlso={m.rendering as PrimitivesExternalWebResource[]} />
          </Section>
        )}

        {m.seeAlso && (m.seeAlso as PrimitivesExternalWebResource[]).length > 0 && (
          <Section title={t('seeAlso')}>
            <SeeAlso seeAlso={m.seeAlso as unknown as PrimitivesExternalWebResource[]} />
          </Section>
        )}

        {m.partOf && m.partOf.length > 0 && (
          <Section title={t('partOf')}>
            <ResourceList seeAlso={m.partOf as PrimitivesExternalWebResource[]} />
          </Section>
        )}

        {m.viewingDirection && (
          <Section title={t('viewingDirection')}>
            <Chip>{m.viewingDirection}</Chip>
          </Section>
        )}

        {m.behavior && m.behavior.length > 0 && (
          <Section title={t('behavior')}>
            <Behavior behavior={m.behavior} />
          </Section>
        )}
      </div>
    </div>
  );
};

export default Metadata;
