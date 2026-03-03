import { describe, it, expect, vi } from 'vitest';

// Mock AIProvider before importing slug
vi.mock('../src/services/AIProvider.js', () => ({
  getAIProvider: vi.fn(() => ({
    generate: vi.fn(() => Promise.resolve('refactor-app')),
    checkConfigured: vi.fn(() => Promise.resolve(true)),
  })),
  resetAIProvider: vi.fn(),
}));

import { generateSlug } from '../src/utils/slug.js';

describe('slug generation', () => {
  it('falls back to timestamp when no providers available', async () => {
    const slug = await generateSlug('');
    expect(slug.startsWith('dmux-')).toBe(true);
  });

  it('returns kebab-ish slug for prompt', async () => {
    const slug = await generateSlug('Refactor Dmux App');
    expect(typeof slug).toBe('string');
    expect(slug.length).toBeGreaterThan(0);
    expect(slug).toBe('refactor-app');
  });
});
