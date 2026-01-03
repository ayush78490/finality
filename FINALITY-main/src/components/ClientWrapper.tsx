'use client';

import { Web3Provider } from '@/components/Web3Provider';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Web3Provider>
      {mounted ? children : null}
      <Toaster position="top-right" richColors />
    </Web3Provider>
  );
}