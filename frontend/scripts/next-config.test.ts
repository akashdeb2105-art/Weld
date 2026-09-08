// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

// Regression: next.config.ts used to hard-code `output: 'standalone'`, which is
// only wanted for the Docker image — it makes `next start` warn and breaks
// Netlify's Next runtime. It must now be gated on DOCKER_BUILD=true.
async function loadConfig() {
  vi.resetModules();
  const mod = await import('../next.config');
  return mod.default as { output?: string };
}

afterEach(() => {
  delete process.env.DOCKER_BUILD;
});

describe('next.config output target', () => {
  it('does NOT emit standalone for a normal (local / Netlify) build', async () => {
    delete process.env.DOCKER_BUILD;
    const config = await loadConfig();
    expect(config.output).toBeUndefined();
  });

  it('emits standalone only when DOCKER_BUILD=true', async () => {
    process.env.DOCKER_BUILD = 'true';
    const config = await loadConfig();
    expect(config.output).toBe('standalone');
  });

  it('ignores a non-"true" DOCKER_BUILD value', async () => {
    process.env.DOCKER_BUILD = '1';
    const config = await loadConfig();
    expect(config.output).toBeUndefined();
  });
});
