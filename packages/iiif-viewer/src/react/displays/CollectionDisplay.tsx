'use client';

import { useEffect, useState } from 'react';
import { collectionEntriesOf, fetchManifest, labelIn, type CollectionEntry } from '../../core';
import { useLocale, useTranslations } from '../env';
import { displayAfter } from './registry';
import { useManifestSwitch } from './structureState';
import type { Display, DisplayProps } from './types';

// A Collection (a manifest whose items are Manifests): choose one to open.
// The converter turns the items into empty Scenes, so the Collection is fetched again
// to know which entries are Manifests and which are Collections.
function CollectionDisplay(props: DisplayProps) {
  const { manifest, containers } = props;
  const t = useTranslations('Structure');
  const locale = useLocale();
  const { open } = useManifestSwitch();
  const isCollection = (manifest as { type?: string }).type === 'Collection';
  const [fetched, setFetched] = useState<{ id: string; entries: CollectionEntry[] } | null>(null);
  const [state, setState] = useState<{ id: string; kind: 'opening' | 'error' } | null>(null);

  useEffect(() => {
    if (!isCollection || !manifest.id) return;
    let cancelled = false;
    fetchManifest(manifest.id).then((raw) => {
      if (!cancelled && raw) setFetched({ id: manifest.id, entries: collectionEntriesOf(raw) });
    });
    return () => {
      cancelled = true;
    };
  }, [isCollection, manifest.id]);

  // not a Collection: an empty Scene is a Canvas that the converter turned into a Scene (a rotated image,
  // a Choice, a missing image). The displays after this one decide how it looks (imageCanvas, then scene).
  if (!isCollection) {
    const next = displayAfter(collectionDisplay.id, props.container);
    return next ? <next.Component {...props} /> : null;
  }

  const fromContainers: CollectionEntry[] = containers.map((c) => ({
    id: c.id,
    type: 'Manifest',
    label: c.label,
  }));
  const entries = fetched?.id === manifest.id && fetched.entries.length > 0 ? fetched.entries : fromContainers;

  const openEntry = async (e: CollectionEntry) => {
    setState({ id: e.id, kind: 'opening' });
    const ok = await open(e.id, true);
    if (!ok) setState({ id: e.id, kind: 'error' });
  };

  if (entries.length === 0) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]">{t('collectionEmpty')}</div>;
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-auto p-3">
      <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))' }}>
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => openEntry(e)}
              className="w-full h-full text-left rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] hover:bg-[var(--ds-surface-2)] p-2 text-sm text-[var(--ds-fg)] flex flex-col gap-1"
            >
              {e.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.thumbnail} alt="" loading="lazy" className="h-24 w-full object-contain bg-white/60" />
              ) : null}
              <span className="font-medium break-words">{labelIn(e.label, locale) || e.id}</span>
              <span className="text-xs opacity-70">
                {e.type === 'Collection' ? t('subCollection') : t('manifest')}
                {state?.id === e.id ? ` ・ ${t(state.kind === 'opening' ? 'opening' : 'openError')}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const collectionDisplay: Display = {
  id: 'collection',
  // a Collection arrives as empty Scenes; the component checks the manifest type
  match: (c) => c.kind === 'Scene' && c.painting.length === 0,
  Component: CollectionDisplay,
};
