// Minimal Background Fetch types (not in TypeScript's DOM lib) and feature detection.
export interface BgFetchRegistration extends EventTarget {
  readonly id: string;
  readonly downloaded: number;
  readonly downloadTotal: number;
  readonly result: '' | 'success' | 'failure';
  readonly failureReason: string;
  abort(): Promise<boolean>;
}
export interface BgFetchOptions {
  title?: string;
  icons?: { src: string; sizes?: string; type?: string }[];
  downloadTotal?: number;
}
export interface BgFetchManager {
  fetch(id: string, requests: RequestInfo[], options?: BgFetchOptions): Promise<BgFetchRegistration>;
  get(id: string): Promise<BgFetchRegistration | undefined>;
  getIds(): Promise<string[]>;
}

export function bgFetchOf(reg: ServiceWorkerRegistration | null | undefined): BgFetchManager | null {
  return (reg as (ServiceWorkerRegistration & { backgroundFetch?: BgFetchManager }) | null | undefined)?.backgroundFetch ?? null;
}

export function backgroundFetchSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'BackgroundFetchManager' in window;
}
