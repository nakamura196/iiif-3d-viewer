'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { messages as bundled, type ViewerMessages } from './messages';

export type ViewerLocale = 'ja' | 'en';
export type ResolvedTheme = 'light' | 'dark';

interface Env {
  locale: string;
  messages: ViewerMessages;
  resolvedTheme: ResolvedTheme;
}

// Without a provider the viewer still works: Japanese, light.
const DEFAULT_ENV: Env = { locale: 'ja', messages: bundled.ja, resolvedTheme: 'light' };

const EnvContext = createContext<Env>(DEFAULT_ENV);

export function ViewerEnv({
  locale = 'ja',
  messages,
  resolvedTheme = 'light',
  children,
}: {
  locale?: string;
  /** Defaults to the messages bundled with the package for `locale`. */
  messages?: ViewerMessages;
  resolvedTheme?: ResolvedTheme;
  children: ReactNode;
}) {
  const value = useMemo<Env>(
    () => ({
      locale,
      messages: messages ?? (locale === 'en' ? bundled.en : bundled.ja),
      resolvedTheme,
    }),
    [locale, messages, resolvedTheme],
  );
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

/** Replace `{name}` placeholders. Unknown names are left as they are. */
export function format(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Same call shape as next-intl: `const t = useTranslations('Info'); t('metadata')`. */
export function useTranslations(namespace: string): Translator {
  const { messages } = useContext(EnvContext);
  return useCallback(
    (key, values) => {
      const text = messages[namespace]?.[key];
      return text === undefined ? `${namespace}.${key}` : format(text, values);
    },
    [messages, namespace],
  );
}

export function useLocale(): string {
  return useContext(EnvContext).locale;
}

/** Same shape as next-themes' useTheme, reduced to what the viewer reads. */
export function useTheme(): { resolvedTheme: ResolvedTheme } {
  return { resolvedTheme: useContext(EnvContext).resolvedTheme };
}
