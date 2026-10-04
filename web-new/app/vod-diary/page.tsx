'use client';

/**
 * Legacy /vod-diary route.
 * The diary lives at `/` — this only forwards old links there, keeping any query
 * string. A client-side replace because `output: 'export'` cannot do server redirects.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VodDiaryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${window.location.search}`);
  }, [router]);

  return null;
}
