'use client';

import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import {
  aboutHasContent,
  aboutScopeHasContent,
  aboutOf,
  safeAboutUrl,
  type AboutAgent,
  type AboutLink,
  type AboutPlace,
  type AboutScope,
} from '../../core';
import { manifestAtom } from '../atoms';
import { useLocale, useTranslations } from '../env';
import { MetadataList, SafeHtml } from './SafeHtml';
import type { Panel, PanelContext } from './types';

const LINK_CLASS = 'text-blue-600 dark:text-blue-400 hover:underline break-words';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="border-b pb-2 border-gray-200 dark:border-gray-700">
    <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
    <div className="text-gray-900 dark:text-gray-100 space-y-1">{children}</div>
  </div>
);

const Links = ({ links }: { links: AboutLink[] }) => (
  <>
    {links.map((l, i) => {
      const href = safeAboutUrl(l.id);
      return (
        <div key={i}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              {l.label}
            </a>
          ) : (
            <span>{l.label}</span>
          )}
          {(l.format || l.type) && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{l.format || l.type}</span>
          )}
        </div>
      );
    })}
  </>
);

const Agent = ({ agent }: { agent: AboutAgent }) => {
  const href = safeAboutUrl(agent.homepage[0]?.id ?? agent.id ?? '');
  const logos = agent.logos.map((src) => safeAboutUrl(src)).filter(Boolean);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {logos.slice(0, 1).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" className="h-8 w-auto max-w-[8rem] object-contain" />
        ))}
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {agent.label || href}
          </a>
        ) : (
          <span>{agent.label}</span>
        )}
      </div>
      {agent.homepage.length > 1 && <Links links={agent.homepage.slice(1)} />}
    </div>
  );
};

// 場所は座標の一覧と OpenStreetMap への外部リンクで示す（地図の部品は持たない）。
const Place = ({ place }: { place: AboutPlace }) => {
  const t = useTranslations('About');
  const c = place.center;
  return (
    <div>
      {place.label && <div>{place.label}</div>}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {place.geometry} {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
        {place.points > 1 && ` (${t('vertices', { count: place.points })})`}
      </div>
      {place.target && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('region')}: {place.target.replace(/^#/, '')}
        </div>
      )}
      <a href={place.url} target="_blank" rel="noopener noreferrer" className={`${LINK_CLASS} text-sm`}>
        {t('openMap')}
      </a>
    </div>
  );
};

function ScopeView({ scope, full }: { scope: AboutScope; full: boolean }) {
  const t = useTranslations('About');
  const links: [string, AboutLink[]][] = [
    [t('homepage'), scope.homepage],
    [t('download'), scope.rendering],
    [t('seeAlso'), scope.seeAlso],
    [t('partOf'), scope.partOf],
  ];
  return (
    <div className="space-y-4">
      {full && scope.summary.length > 0 && (
        <Section title={t('description')}>
          {scope.summary.map((h, i) => (
            <SafeHtml key={i} html={h} as="div" />
          ))}
        </Section>
      )}
      {full && scope.metadata.length > 0 && (
        <Section title={t('metadata')}>
          <MetadataList items={scope.metadata} />
        </Section>
      )}
      {(scope.rights || scope.requiredStatement) && (
        <Section title={t('rights')}>
          {scope.requiredStatement && <MetadataList items={[scope.requiredStatement]} />}
          {scope.rights &&
            (safeAboutUrl(scope.rights.url) ? (
              <a href={safeAboutUrl(scope.rights.url)} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {scope.rights.label}
              </a>
            ) : (
              <span>{scope.rights.label}</span>
            ))}
        </Section>
      )}
      {scope.providers.length > 0 && (
        <Section title={t('provider')}>
          {scope.providers.map((a, i) => (
            <Agent key={i} agent={a} />
          ))}
        </Section>
      )}
      {links.map(([title, list]) =>
        list.length > 0 ? (
          <Section key={title} title={title}>
            <Links links={list} />
          </Section>
        ) : null,
      )}
      {scope.navDate && (
        <Section title={t('date')}>
          <time dateTime={scope.navDate.iso}>{scope.navDate.text}</time>
        </Section>
      )}
      {scope.places.length > 0 && (
        <Section title={t('place')}>
          {scope.places.map((p, i) => (
            <Place key={i} place={p} />
          ))}
        </Section>
      )}
      {full && scope.thumbnails.length > 0 && (
        <Section title={t('thumbnail')}>
          <div className="flex flex-wrap gap-2">
            {scope.thumbnails.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={safeAboutUrl(src)}
                alt=""
                className="max-h-32 w-auto rounded border border-gray-200 dark:border-gray-700 object-contain"
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function AboutView({ container, manifest }: PanelContext) {
  const t = useTranslations('About');
  const ti = useTranslations('Info');
  const locale = useLocale();
  const fromAtom = useAtomValue(manifestAtom);
  const info = aboutOf(manifest ?? fromAtom, container?.id, locale);
  if (!info || !aboutHasContent(info)) {
    return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('empty')}</div>;
  }
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{ti('about')}</h2>
      {/* 資料全体のメタデータと説明は「メタデータ」タブにあるので、ここでは出さない */}
      <ScopeView scope={info.manifest} full={false} />
      {info.container && aboutScopeHasContent(info.container) && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">
            {t('thisPage')}
            {info.container.label && <span className="ml-2 font-normal">{info.container.label}</span>}
          </h3>
          <ScopeView scope={info.container} full />
        </div>
      )}
      {info.ranges.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t('ranges')}</h3>
          {info.ranges.map((r) => (
            <div key={r.id} className="space-y-2">
              <div className="font-medium text-gray-700 dark:text-gray-300">{r.label || r.id}</div>
              <ScopeView scope={r} full />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const aboutPanel: Panel = {
  id: 'about',
  // 追加で見せるものがあるときだけタブを出す（言語は問わない）
  available: ({ manifest, container }) => {
    const info = aboutOf(manifest, container?.id, 'en');
    return !!info && aboutHasContent(info);
  },
  Component: (ctx) => <AboutView {...ctx} />,
};
