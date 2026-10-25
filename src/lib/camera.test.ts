import { describe, it, expect, vi } from 'vitest';
import { stopCamera } from './camera';

describe('camera cleanup', () => {
  it('stops every track and tolerates null / already-stopped streams', () => {
    const a = { stop: vi.fn() }; const b = { stop: vi.fn() };
    stopCamera({ getTracks: () => [a, b] } as unknown as MediaStream);
    expect(a.stop).toHaveBeenCalledTimes(1);
    expect(b.stop).toHaveBeenCalledTimes(1);
    expect(() => stopCamera(null)).not.toThrow();
    expect(() => stopCamera(undefined)).not.toThrow();
    const failing = { stop: () => { throw new Error('gone'); } };
    expect(() => stopCamera({ getTracks: () => [failing] } as unknown as MediaStream)).not.toThrow();
  });
});
