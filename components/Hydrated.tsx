'use client';

import { useEffect } from 'react';

// Marks the document once React has hydrated, so end to end tests click only when clicks will work.
export function Hydrated() {
  useEffect(() => {
    document.body.dataset.hydrated = '1';
  }, []);
  return null;
}
