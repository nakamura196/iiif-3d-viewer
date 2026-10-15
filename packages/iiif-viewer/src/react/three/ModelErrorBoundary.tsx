'use client';

import { Component, type ReactNode } from 'react';

// Catches a model that fails to load (404, 403 behind an access check, a broken file)
// inside the 3D view. Without it the error reaches react-three-fiber's own boundary,
// which throws it again outside the canvas and the whole page goes down.
export default class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[iiif-viewer] could not load the 3D model:', error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
