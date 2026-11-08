import { describe, it, expect } from 'vitest';
import { mapLimit } from '@/lib/listen/concurrency';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('mapLimit', () => {
  it('keeps result order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([5, 4, 3, 2, 1], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      return n * 10;
    });
    expect(out).toEqual([50, 40, 30, 20, 10]);
    expect(peak).toBe(2);
  });

  it('rejects on the first error and starts no new items', async () => {
    const started: number[] = [];
    await expect(
      mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
        started.push(n);
        await tick();
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(started.length).toBeLessThanOrEqual(3);
  });
});
