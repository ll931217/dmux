import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AIProviderConfig, AIProviderName, ModelRole } from '../types.js';
import { resolveAIConfig, getAPIKey } from '../utils/aiConfig.js';

export interface GenerateOptions {
  role?: ModelRole;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

type ProviderFactory = (modelId: string) => Parameters<typeof generateText>[0]['model'];

export class AIProviderService {
  private config: AIProviderConfig | null = null;
  private providerInstance: ProviderFactory | null = null;

  private async ensureInitialized(): Promise<void> {
    if (this.config && this.providerInstance) return;

    this.config = await resolveAIConfig();
    const apiKey = getAPIKey(this.config.provider);
    if (!apiKey) {
      throw new Error(`API key not found for ${this.config.provider}`);
    }
    this.providerInstance = this.createProvider(this.config.provider, apiKey, this.config.baseURL);
  }

  private createProvider(provider: AIProviderName, apiKey: string, baseURL?: string): ProviderFactory {
    switch (provider) {
      case 'openrouter':
        return createOpenAI({
          baseURL: baseURL || 'https://openrouter.ai/api/v1',
          apiKey,
          headers: {
            'HTTP-Referer': 'https://github.com/dmux/dmux',
            'X-Title': 'dmux',
          },
        }) as unknown as ProviderFactory;
      case 'openai':
        return createOpenAI({ apiKey, ...(baseURL && { baseURL }) }) as unknown as ProviderFactory;
      case 'anthropic':
        return createAnthropic({ apiKey, ...(baseURL && { baseURL }) }) as unknown as ProviderFactory;
      case 'google':
        return createGoogleGenerativeAI({ apiKey, ...(baseURL && { baseURL }) }) as unknown as ProviderFactory;
    }
  }

  async generate(options: GenerateOptions): Promise<string> {
    await this.ensureInitialized();

    const role = options.role ?? 'fast';
    const modelId = this.config!.models[role];
    const model = this.providerInstance!(modelId);

    const result = await generateText({
      model,
      system: options.system,
      prompt: options.prompt,
      maxOutputTokens: options.maxTokens ?? 100,
      temperature: options.temperature ?? 0.1,
      abortSignal: options.signal,
    });

    return result.text;
  }

  async generateJSON<T = unknown>(options: GenerateOptions): Promise<T> {
    const text = await this.generate(options);
    return JSON.parse(text) as T;
  }

  isConfigured(): boolean {
    if (!this.config) return false;
    return !!getAPIKey(this.config.provider);
  }

  async checkConfigured(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return true;
    } catch {
      return false;
    }
  }

  getProviderName(): string | null {
    return this.config?.provider ?? null;
  }

  getModelId(role: ModelRole = 'fast'): string | null {
    return this.config?.models[role] ?? null;
  }

  reset(): void {
    this.config = null;
    this.providerInstance = null;
  }
}

let instance: AIProviderService | null = null;

export function getAIProvider(): AIProviderService {
  if (!instance) {
    instance = new AIProviderService();
  }
  return instance;
}

export function resetAIProvider(): void {
  instance?.reset();
  instance = null;
}
