'use client';

import { Provider as JotaiProvider } from 'jotai';

const Provider = ({ children }: { children: React.ReactNode }) => {
  return <JotaiProvider>{children}</JotaiProvider>;
};

export default Provider;
