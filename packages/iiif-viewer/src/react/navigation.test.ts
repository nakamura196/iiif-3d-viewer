import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ViewerEnv } from './env';
import { CanvasNavigationContext, indexOfCanvas } from './navigation';
import { Body } from './panels/CanvasAnnotationsPanel';

describe('indexOfCanvas', () => {
  const cs = [{ id: 'https://e/c1' }, { id: 'https://e/c2' }];
  it('finds a Canvas by id', () => {
    expect(indexOfCanvas(cs, 'https://e/c2')).toBe(1);
  });
  it('returns -1 for an unknown id', () => {
    expect(indexOfCanvas(cs, 'https://e/zzz')).toBe(-1);
  });
});

describe('annotation link body', () => {
  const render = (url: string, labels: Map<string, string>) =>
    renderToStaticMarkup(
      createElement(
        ViewerEnv as FunctionComponent<{ locale: string; resolvedTheme: 'light' }>,
        { locale: 'en', resolvedTheme: 'light' },
        createElement(
          CanvasNavigationContext.Provider,
          { value: { goToCanvas: () => true } },
          createElement(Body, { body: { kind: 'resource', url }, canvasLabels: labels }),
        ),
      ),
    );

  it('renders a Canvas of this item as a button, not a new-tab link', () => {
    const html = render('https://e/c2', new Map([['https://e/c2', 'Page 2']]));
    expect(html).toContain('<button');
    expect(html).toContain('Page 2');
    expect(html).not.toContain('target="_blank"');
  });
  it('keeps an external URL as a new-tab link', () => {
    const html = render('https://example.org/x', new Map());
    expect(html).toContain('<a ');
    expect(html).toContain('target="_blank"');
  });
});
