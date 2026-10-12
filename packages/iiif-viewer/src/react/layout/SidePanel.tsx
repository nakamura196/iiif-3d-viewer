'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '../env';

// 右（狭い画面では下）の説明欄。ボタンで畳み、3D や地図の表示領域を広げる。
// 畳んだかどうかはページをまたいで同じ値をブラウザに保存する。保存が無ければ、狭い画面では畳んで始める。
const STORAGE_KEY = 'iiif3d.sidePanelOpen';
const NARROW = '(max-width: 639px)';

// Tailwind はクラス名を文字列のまま探すので、区切りの幅ごとに書き分ける
const CLASSES = {
  sm: {
    open: 'h-[50%] sm:h-full sm:w-[30%]',
    closed: 'h-10 sm:h-full sm:w-10 flex-row sm:flex-col border-t sm:border-t-0 sm:border-l',
    desktop: 'hidden sm:block',
    mobile: 'sm:hidden',
  },
  lg: {
    open: 'h-[40%] lg:h-full lg:w-96',
    closed: 'h-10 lg:h-full lg:w-10 flex-row lg:flex-col border-t lg:border-t-0 lg:border-l',
    desktop: 'hidden lg:block',
    mobile: 'lg:hidden',
  },
} as const;

const Chevron = ({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) => {
  const d = { left: 'M15 19l-7-7 7-7', right: 'M9 5l7 7-7 7', up: 'M5 15l7-7 7 7', down: 'M19 9l-7 7-7-7' }[dir];
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
};

type Props = {
  children: React.ReactNode;
  // 横に並ぶ幅（この幅より狭いと下に置く）
  breakpoint?: 'sm' | 'lg';
  className?: string;
};

export default function SidePanel({ children, breakpoint = 'sm', className = '' }: Props) {
  const t = useTranslations('SidePanel');
  const c = CLASSES[breakpoint];
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // 保存が使えないときは画面の幅だけで決める
    }
    setOpen(saved !== null ? saved === '1' : !window.matchMedia(NARROW).matches);
  }, []);

  const toggle = () => {
    setOpen(!open);
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? '0' : '1');
    } catch {
      // 保存できなくても開閉はできる
    }
  };

  const buttonClass =
    'flex items-center justify-center rounded text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)] transition-colors';

  if (!open) {
    return (
      <div
        className={`${c.closed} flex-none flex items-start px-1 py-1 bg-[var(--ds-surface)] border-[var(--ds-border)]`}
      >
        <button onClick={toggle} className={`${buttonClass} w-full py-1 gap-2`} title={t('open')} aria-expanded={false}>
          <span className={c.desktop}><Chevron dir="left" /></span>
          <span className={c.mobile}><Chevron dir="up" /></span>
          <span className={`${c.mobile} text-sm`}>{t('open')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`${c.open} flex-none relative ${className}`}>
      <button
        onClick={toggle}
        className={`${buttonClass} absolute top-1.5 right-1.5 z-20 w-7 h-7 bg-[var(--ds-surface)] border border-[var(--ds-border)]`}
        title={t('close')}
        aria-expanded={true}
      >
        <span className={c.desktop}><Chevron dir="right" /></span>
        <span className={c.mobile}><Chevron dir="down" /></span>
      </button>
      {children}
    </div>
  );
}
