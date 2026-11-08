'use client';

import { Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ListenButton({ onClick, resumeLabel }: { onClick: () => void; resumeLabel?: string }) {
  return (
    <Button type="button" onClick={onClick} className="h-14 w-full gap-2 bg-accent-green text-base text-white hover:bg-accent-green/90">
      <Headphones className="h-5 w-5" aria-hidden />
      Listen
      {resumeLabel ? <span className="font-mono text-sm">· from {resumeLabel}</span> : null}
    </Button>
  );
}
