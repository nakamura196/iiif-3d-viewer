// main.js（素の JavaScript）の入口の型
export function startGallery(root: HTMLElement, opts?: { lang?: string; basePath?: string }): Promise<void>;
export function stopGallery(): void;
export function onResize(): void;
