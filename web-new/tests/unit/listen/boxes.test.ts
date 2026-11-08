import { describe, it, expect } from 'vitest';
import { readBoxHeader, childBoxes, findPath } from '@/lib/listen/boxes';
import { ListenError } from '@/lib/listen/types';

function box(type: string, payload: number[] = []): number[] {
  const size = 8 + payload.length;
  return [size >>> 24, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...Array.from(type, (c) => c.charCodeAt(0)), ...payload];
}
const bytes = (a: number[]) => Uint8Array.from(a);

describe('readBoxHeader', () => {
  it('reads a 32-bit size header', () => {
    expect(readBoxHeader(bytes(box('free', [1, 2, 3])), 0)).toEqual({ type: 'free', start: 0, size: 11, headerSize: 8 });
  });

  it('reads a 64-bit largesize header', () => {
    const b = new Uint8Array(16);
    const v = new DataView(b.buffer);
    v.setUint32(0, 1);
    b.set([0x6d, 0x64, 0x61, 0x74], 4); // 'mdat'
    v.setBigUint64(8, BigInt(27_039_093_331));
    expect(readBoxHeader(b, 0)).toEqual({ type: 'mdat', start: 0, size: 27_039_093_331, headerSize: 16 });
  });

  it('returns null when the header is truncated', () => {
    expect(readBoxHeader(bytes([0, 0, 0, 9, 0x66]), 0)).toBeNull();
  });
});

describe('childBoxes / findPath', () => {
  const tree = bytes(box('moov', [...box('mvhd', [0, 0, 0, 0]), ...box('trak', box('mdia', box('hdlr', [9])))]));

  it('lists children in order', () => {
    const root = readBoxHeader(tree, 0)!;
    expect(childBoxes(tree, root.start + root.headerSize, root.size).map((b) => b.type)).toEqual(['mvhd', 'trak']);
  });

  it('finds a nested box by path', () => {
    const hdlr = findPath(tree, readBoxHeader(tree, 0)!, ['trak', 'mdia', 'hdlr']);
    expect(hdlr?.type).toBe('hdlr');
    expect(tree[hdlr!.start + 8]).toBe(9);
  });

  it('returns null for a missing path', () => {
    expect(findPath(tree, readBoxHeader(tree, 0)!, ['trak', 'minf'])).toBeNull();
  });

  it('throws ListenError when a child overruns its parent', () => {
    const bad = bytes(box('moov', [0, 0, 0, 99, 0x66, 0x72, 0x65, 0x65]));
    expect(() => childBoxes(bad, 8, bad.length)).toThrow(ListenError);
  });
});
