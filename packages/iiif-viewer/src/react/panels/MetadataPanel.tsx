'use client';

import Metadata from '../metadata/Metadata';
import type { Panel } from './types';

export const metadataPanel: Panel = {
  id: 'metadata',
  available: () => true,
  Component: () => <Metadata />,
};
