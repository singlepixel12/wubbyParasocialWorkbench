import { ListenError } from './types';

export interface BoxHeader {
  type: string;
  start: number;
  /** Whole box size including header. Size 0 ("to end of parent") is resolved by childBoxes. */
  size: number;
  headerSize: number;
}

/** Read one ISO-BMFF box header at `offset`, or null if it doesn't fit in `bytes`. */
export function readBoxHeader(bytes: Uint8Array, offset: number): BoxHeader | null {
  if (offset + 8 > bytes.byteLength) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(offset);
  const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > bytes.byteLength) return null;
    size = Number(view.getBigUint64(offset + 8));
    headerSize = 16;
  }
  return { type, start: offset, size, headerSize };
}

/** The boxes laid end to end in bytes[start, end). */
export function childBoxes(bytes: Uint8Array, start: number, end: number): BoxHeader[] {
  const out: BoxHeader[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const header = readBoxHeader(bytes, offset);
    if (!header) break;
    const size = header.size === 0 ? end - offset : header.size;
    if (size < header.headerSize || offset + size > end) {
      throw new ListenError('malformed-mp4', `Box "${header.type}" at ${offset} (size ${size}) overruns its parent`);
    }
    out.push({ ...header, size });
    offset += size;
  }
  return out;
}

export function findChild(bytes: Uint8Array, parent: BoxHeader, type: string): BoxHeader | null {
  return childBoxes(bytes, parent.start + parent.headerSize, parent.start + parent.size).find((b) => b.type === type) ?? null;
}

export function findPath(bytes: Uint8Array, parent: BoxHeader, types: readonly string[]): BoxHeader | null {
  let current: BoxHeader | null = parent;
  for (const type of types) {
    if (!current) return null;
    current = findChild(bytes, current, type);
  }
  return current;
}
