import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateText = vi.hoisted(() => vi.fn());
const mockCreateOpenAI = vi.hoisted(() => vi.fn());
const mockCreateAnthropic = vi.hoisted(() => vi.fn());
const mockCreateGoogleGenerativeAI = vi.hoisted(() => vi.fn());
const mockResolveAIConfig = vi.hoisted(() => vi.fn());
const mockGetAPIKey = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: mockCreateAnthropic,
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: mockCreateGoogleGenerativeAI,
}));

vi.mock('../../src/utils/aiConfig.js', () => ({
  resolveAIConfig: mockResolveAIConfig,
  getAPIKey: mockGetAPIKey,
}));

import {
  AIProviderService,
  getAIProvider,
  resetAIProvider,
} from '../../src/services/AIProvider.js';

const DEFAULT_CONFIG = {
  provider: 'openrouter' as const,
  models: { fast: 'google/gemini-2.5-flash', default: 'openai/gpt-4o-mini' },
};

function setupInitializedProvider(
  config = DEFAULT_CONFIG,
  apiKey = 'test-api-key',
) {
  mockResolveAIConfig.mockResolvedValue(config);
  mockGetAPIKey.mockReturnValue(apiKey);

  const mockProviderFactory = vi.fn().mockReturnValue('mock-model');
  mockCreateOpenAI.mockReturnValue(mockProviderFactory);
  mockCreateAnthropic.mockReturnValue(mockProviderFactory);
  mockCreateGoogleGenerativeAI.mockReturnValue(mockProviderFactory);

  return mockProviderFactory;
}

describe('AIProviderService', () => {
  let service: AIProviderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIProviderService();
  });

  describe('ensureInitialized (via generate)', () => {
    it('calls resolveAIConfig and getAPIKey on first use', async () => {
      const mockFactory = setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: 'response' });

      await service.generate({ prompt: 'hello' });

      expect(mockResolveAIConfig).toHaveBeenCalledOnce();
      expect(mockGetAPIKey).toHaveBeenCalledWith('openrouter');
      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-api-key',
        headers: {
          'HTTP-Referer': 'https://github.com/dmux/dmux',
          'X-Title': 'dmux',
        },
      });
      expect(mockFactory).toHaveBeenCalledWith('google/gemini-2.5-flash');
    });

    it('skips re-initialization on subsequent calls', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: 'response' });

      await service.generate({ prompt: 'first' });
      await service.generate({ prompt: 'second' });

      expect(mockResolveAIConfig).toHaveBeenCalledOnce();
    });

    it('throws when API key is missing', async () => {
      mockResolveAIConfig.mockResolvedValue(DEFAULT_CONFIG);
      mockGetAPIKey.mockReturnValue(undefined);

      await expect(service.generate({ prompt: 'hello' })).rejects.toThrow(
        'API key not found for openrouter',
      );
    });
  });

  describe('createProvider', () => {
    it('creates openrouter provider with custom baseURL and headers', async () => {
      setupInitializedProvider({
        provider: 'openrouter',
        models: { fast: 'model-a', default: 'model-b' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'test' });

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-api-key',
        headers: {
          'HTTP-Referer': 'https://github.com/dmux/dmux',
          'X-Title': 'dmux',
        },
      });
    });

    it('creates openai provider with apiKey only', async () => {
      setupInitializedProvider({
        provider: 'openai',
        models: { fast: 'gpt-4o-mini', default: 'gpt-4o' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'test' });

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });

    it('creates anthropic provider', async () => {
      setupInitializedProvider({
        provider: 'anthropic',
        models: { fast: 'claude-haiku', default: 'claude-sonnet' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'test' });

      expect(mockCreateAnthropic).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });

    it('creates google provider', async () => {
      setupInitializedProvider({
        provider: 'google',
        models: { fast: 'gemini-flash', default: 'gemini-pro' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'test' });

      expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });
  });

  describe('generate', () => {
    it('calls generateText with correct default params', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: 'generated text' });

      const result = await service.generate({ prompt: 'hello world' });

      expect(result).toBe('generated text');
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: 'mock-model',
        system: undefined,
        prompt: 'hello world',
        maxOutputTokens: 100,
        temperature: 0.1,
        abortSignal: undefined,
      });
    });

    it('passes custom options through to generateText', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: 'result' });
      const controller = new AbortController();

      await service.generate({
        prompt: 'test prompt',
        system: 'you are a helper',
        maxTokens: 500,
        temperature: 0.8,
        signal: controller.signal,
      });

      expect(mockGenerateText).toHaveBeenCalledWith({
        model: 'mock-model',
        system: 'you are a helper',
        prompt: 'test prompt',
        maxOutputTokens: 500,
        temperature: 0.8,
        abortSignal: controller.signal,
      });
    });

    it('uses "fast" role by default and resolves the matching model', async () => {
      const mockFactory = setupInitializedProvider({
        provider: 'openai',
        models: { fast: 'fast-model', default: 'default-model' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'test' });

      expect(mockFactory).toHaveBeenCalledWith('fast-model');
    });

    it('uses the specified role to select model', async () => {
      const mockFactory = setupInitializedProvider({
        provider: 'openai',
        models: { fast: 'fast-model', default: 'default-model' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'test', role: 'default' });

      expect(mockFactory).toHaveBeenCalledWith('default-model');
    });
  });

  describe('generateJSON', () => {
    it('parses generate output as JSON', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: '{"key":"value","num":42}' });

      const result = await service.generateJSON({ prompt: 'give json' });

      expect(result).toEqual({ key: 'value', num: 42 });
    });

    it('throws on invalid JSON', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: 'not valid json' });

      await expect(
        service.generateJSON({ prompt: 'give json' }),
      ).rejects.toThrow();
    });

    it('supports generic type parameter', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({
        text: '{"name":"test","count":5}',
      });

      interface TestShape {
        name: string;
        count: number;
      }

      const result = await service.generateJSON<TestShape>({
        prompt: 'typed json',
      });

      expect(result.name).toBe('test');
      expect(result.count).toBe(5);
    });
  });

  describe('isConfigured', () => {
    it('returns false when not initialized', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('returns true when initialized and API key exists', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'init' });

      mockGetAPIKey.mockReturnValue('some-key');
      expect(service.isConfigured()).toBe(true);
    });

    it('returns false when initialized but API key is missing', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'init' });

      mockGetAPIKey.mockReturnValue(undefined);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('checkConfigured', () => {
    it('returns true when initialization succeeds', async () => {
      setupInitializedProvider();

      const result = await service.checkConfigured();

      expect(result).toBe(true);
    });

    it('returns false when initialization fails', async () => {
      mockResolveAIConfig.mockResolvedValue(DEFAULT_CONFIG);
      mockGetAPIKey.mockReturnValue(undefined);

      const result = await service.checkConfigured();

      expect(result).toBe(false);
    });
  });

  describe('getProviderName', () => {
    it('returns null when not initialized', () => {
      expect(service.getProviderName()).toBeNull();
    });

    it('returns provider name after initialization', async () => {
      setupInitializedProvider({
        provider: 'anthropic',
        models: { fast: 'claude-haiku', default: 'claude-sonnet' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'init' });

      expect(service.getProviderName()).toBe('anthropic');
    });
  });

  describe('getModelId', () => {
    it('returns null when not initialized', () => {
      expect(service.getModelId()).toBeNull();
      expect(service.getModelId('default')).toBeNull();
    });

    it('returns fast model by default', async () => {
      setupInitializedProvider({
        provider: 'openai',
        models: { fast: 'gpt-4o-mini', default: 'gpt-4o' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'init' });

      expect(service.getModelId()).toBe('gpt-4o-mini');
    });

    it('returns specified role model', async () => {
      setupInitializedProvider({
        provider: 'openai',
        models: { fast: 'gpt-4o-mini', default: 'gpt-4o' },
      });
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'init' });

      expect(service.getModelId('default')).toBe('gpt-4o');
      expect(service.getModelId('fast')).toBe('gpt-4o-mini');
    });
  });

  describe('reset', () => {
    it('clears config and provider so re-initialization is required', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'init' });
      expect(service.getProviderName()).toBe('openrouter');

      service.reset();

      expect(service.getProviderName()).toBeNull();
      expect(service.isConfigured()).toBe(false);
    });

    it('re-initializes on next generate after reset', async () => {
      setupInitializedProvider();
      mockGenerateText.mockResolvedValue({ text: '' });

      await service.generate({ prompt: 'first' });
      expect(mockResolveAIConfig).toHaveBeenCalledOnce();

      service.reset();

      await service.generate({ prompt: 'second' });
      expect(mockResolveAIConfig).toHaveBeenCalledTimes(2);
    });
  });
});

describe('getAIProvider', () => {
  afterEach(() => {
    resetAIProvider();
  });

  it('returns an AIProviderService instance', () => {
    const provider = getAIProvider();

    expect(provider).toBeInstanceOf(AIProviderService);
  });

  it('returns the same instance on repeated calls', () => {
    const first = getAIProvider();
    const second = getAIProvider();

    expect(first).toBe(second);
  });
});

describe('resetAIProvider', () => {
  it('clears singleton so next getAIProvider returns a new instance', () => {
    const first = getAIProvider();

    resetAIProvider();

    const second = getAIProvider();
    expect(second).not.toBe(first);
  });

  it('calls reset on the existing instance', async () => {
    const provider = getAIProvider();

    setupInitializedProvider();
    mockGenerateText.mockResolvedValue({ text: '' });
    await provider.generate({ prompt: 'init' });

    expect(provider.getProviderName()).toBe('openrouter');

    resetAIProvider();

    expect(provider.getProviderName()).toBeNull();
  });
});
