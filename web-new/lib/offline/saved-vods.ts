// Downloaded VODs as ordinary `Video`s, for /watch and the diary with no signal.
import type { DownloadManifest } from '../listen/download-model';
import { getManifest } from '../listen/offline-store';
import type { Video } from '../../types/video';

/** The saved row, or a minimal one built from the manifest (downloads from before Phase 3b). */
export function videoFromManifest(m: DownloadManifest): Video {
  return (
    m.video ?? {
      url: m.url,
      title: m.title,
      platform: 'unknown',
      summary: '',
      tags: [],
      date: new Date(m.createdAt).toISOString(),
      videoHash: m.hash,
      thumbnailUrl: m.thumbnailUrl,
    }
  );
}

/** The saved details of a downloaded VOD, or null (not downloaded, or no IndexedDB). */
export async function savedVideo(hash: string): Promise<Video | null> {
  try {
    const m = await getManifest(hash);
    return m ? videoFromManifest(m) : null;
  } catch {
    return null;
  }
}
