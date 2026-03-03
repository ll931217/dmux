import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AIProviderName } from '../src/types.js';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

import fs from 'fs/promises';
import {
  getProviderRegistry,
  getProviderMeta,
  getConfigPath,
  readAIConfig,
  writeAIConfig,
  detectProviderFromEnv,
  getAPIKey,
  resolveAIConfig,
} from '../src/utils/aiConfig.js';

const PROVIDERS: AIProviderName[] = ['openrouter', 'openai', 'anthropic', 'google'];

const ENV_VARS = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
] as const;

describe('aiConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    for (const key of ENV_VARS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getProviderRegistry', () => {
    it('returns all 4 providers', () => {
      const registry = getProviderRegistry();
      expect(Object.keys(registry)).toHaveLength(4);
      for (const provider of PROVIDERS) {
        expect(registry[provider]).toBeDefined();
      }
    });

    it('each provider has label, envVar, and defaultModels', () => {
      const registry = getProviderRegistry();
      for (const provider of PROVIDERS) {
        const meta = registry[provider];
        expect(meta.label).toBeTypeOf('string');
        expect(meta.envVar).toBeTypeOf('string');
        expect(meta.defaultModels.fast).toBeTypeOf('string');
        expect(meta.defaultModels.default).toBeTypeOf('string');
      }
    });

    it('providers have correct envVar values', () => {
      const registry = getProviderRegistry();
      expect(registry.openrouter.envVar).toBe('OPENROUTER_API_KEY');
      expect(registry.openai.envVar).toBe('OPENAI_API_KEY');
      expect(registry.anthropic.envVar).toBe('ANTHROPIC_API_KEY');
      expect(registry.google.envVar).toBe('GOOGLE_GENERATIVE_AI_API_KEY');
    });

    it('providers have correct labels', () => {
      const registry = getProviderRegistry();
      expect(registry.openrouter.label).toBe('OpenRouter');
      expect(registry.openai.label).toBe('OpenAI');
      expect(registry.anthropic.label).toBe('Anthropic');
      expect(registry.google.label).toBe('Google AI');
    });
  });

  describe('getProviderMeta', () => {
    it('returns metadata for a known provider', () => {
      const meta = getProviderMeta('anthropic');
      expect(meta.label).toBe('Anthropic');
      expect(meta.envVar).toBe('ANTHROPIC_API_KEY');
      expect(meta.defaultModels).toEqual({
        fast: 'claude-haiku-3-5',
        default: 'claude-haiku-3-5',
      });
    });

    it('returns the same reference as the registry entry', () => {
      const registry = getProviderRegistry();
      for (const provider of PROVIDERS) {
        expect(getProviderMeta(provider)).toBe(registry[provider]);
      }
    });
  });

  describe('getConfigPath', () => {
    it('returns a path containing .dmux/ai-config.json', () => {
      const configPath = getConfigPath();
      expect(configPath).toContain('.dmux');
      expect(configPath).toMatch(/\.dmux[/\\]ai-config\.json$/);
    });
  });

  describe('readAIConfig', () => {
    it('returns parsed config when file exists', async () => {
      const config = { provider: 'openai', models: { fast: 'gpt-4o-mini', default: 'gpt-4o-mini' } };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await readAIConfig();
      expect(result).toEqual(config);
    });

    it('returns null when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await readAIConfig();
      expect(result).toBeNull();
    });

    it('returns null when file contains invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('not-json');

      const result = await readAIConfig();
      expect(result).toBeNull();
    });
  });

  describe('writeAIConfig', () => {
    it('creates directory and writes JSON', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = { provider: 'anthropic' as const, models: { fast: 'claude-haiku-3-5', default: 'claude-haiku-3-5' } };
      await writeAIConfig(config);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.dmux'),
        { recursive: true },
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.dmux[/\\]ai-config\.json$/),
        JSON.stringify(config, null, 2),
        'utf-8',
      );
    });
  });

  describe('detectProviderFromEnv', () => {
    it('returns null when no env vars are set', () => {
      expect(detectProviderFromEnv()).toBeNull();
    });

    it('returns openrouter when OPENROUTER_API_KEY is set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      expect(detectProviderFromEnv()).toBe('openrouter');
    });

    it('returns openai when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(detectProviderFromEnv()).toBe('openai');
    });

    it('returns anthropic when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      expect(detectProviderFromEnv()).toBe('anthropic');
    });

    it('returns google when GOOGLE_GENERATIVE_AI_API_KEY is set', () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
      expect(detectProviderFromEnv()).toBe('google');
    });

    it('returns first provider in priority order when multiple env vars are set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';
      expect(detectProviderFromEnv()).toBe('openai');
    });

    it('returns openrouter first when all env vars are set', () => {
      for (const key of ENV_VARS) {
        process.env[key] = 'test-key';
      }
      expect(detectProviderFromEnv()).toBe('openrouter');
    });
  });

  describe('getAPIKey', () => {
    it('returns undefined when env var is not set', () => {
      expect(getAPIKey('openai')).toBeUndefined();
    });

    it('returns the env var value for each provider', () => {
      process.env.OPENROUTER_API_KEY = 'or-key';
      process.env.OPENAI_API_KEY = 'oai-key';
      process.env.ANTHROPIC_API_KEY = 'ant-key';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'ggl-key';

      expect(getAPIKey('openrouter')).toBe('or-key');
      expect(getAPIKey('openai')).toBe('oai-key');
      expect(getAPIKey('anthropic')).toBe('ant-key');
      expect(getAPIKey('google')).toBe('ggl-key');
    });
  });

  describe('resolveAIConfig', () => {
    it('returns saved config when file exists', async () => {
      const saved = { provider: 'google' as const, models: { fast: 'gemini-2.0-flash', default: 'gemini-2.0-flash' } };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(saved));

      const result = await resolveAIConfig();
      expect(result).toEqual(saved);
    });

    it('returns auto-detected config when no saved config and env var is set', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const result = await resolveAIConfig();
      expect(result.provider).toBe('anthropic');
      expect(result.models).toEqual({
        fast: 'claude-haiku-3-5',
        default: 'claude-haiku-3-5',
      });
    });

    it('returns openrouter fallback when no saved config and no env vars', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await resolveAIConfig();
      expect(result.provider).toBe('openrouter');
      expect(result.models).toEqual({
        fast: 'google/gemini-2.5-flash',
        default: 'openai/gpt-4o-mini',
      });
    });

    it('returns a fresh models object (not a reference to registry defaults)', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      process.env.OPENAI_API_KEY = 'test-key';

      const result = await resolveAIConfig();
      const registryModels = getProviderMeta('openai').defaultModels;
      expect(result.models).toEqual(registryModels);
      expect(result.models).not.toBe(registryModels);
    });
  });
});
