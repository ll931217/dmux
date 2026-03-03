import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AIProviderConfig, AIProviderName } from '../types.js';

export interface ProviderMeta {
  label: string;
  envVar: string;
  defaultModels: { fast: string; default: string };
}

const PROVIDER_REGISTRY: Record<AIProviderName, ProviderMeta> = {
  openrouter: {
    label: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    defaultModels: { fast: 'google/gemini-2.5-flash', default: 'openai/gpt-4o-mini' },
  },
  openai: {
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    defaultModels: { fast: 'gpt-4o-mini', default: 'gpt-4o-mini' },
  },
  anthropic: {
    label: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    defaultModels: { fast: 'claude-haiku-3-5', default: 'claude-haiku-3-5' },
  },
  google: {
    label: 'Google AI',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    defaultModels: { fast: 'gemini-2.0-flash', default: 'gemini-2.0-flash' },
  },
};

const ENV_DETECTION_ORDER: AIProviderName[] = ['openrouter', 'openai', 'anthropic', 'google'];

export function getProviderRegistry(): Record<AIProviderName, ProviderMeta> {
  return PROVIDER_REGISTRY;
}

export function getProviderMeta(provider: AIProviderName): ProviderMeta {
  return PROVIDER_REGISTRY[provider];
}

export function getConfigPath(): string {
  return path.join(os.homedir(), '.dmux', 'ai-config.json');
}

export async function readAIConfig(): Promise<AIProviderConfig | null> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8');
    return JSON.parse(raw) as AIProviderConfig;
  } catch {
    return null;
  }
}

export async function writeAIConfig(config: AIProviderConfig): Promise<void> {
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function detectProviderFromEnv(): AIProviderName | null {
  for (const provider of ENV_DETECTION_ORDER) {
    if (process.env[PROVIDER_REGISTRY[provider].envVar]) {
      return provider;
    }
  }
  return null;
}

export function getAPIKey(provider: AIProviderName): string | undefined {
  return process.env[PROVIDER_REGISTRY[provider].envVar];
}

export async function resolveAIConfig(): Promise<AIProviderConfig> {
  const saved = await readAIConfig();
  if (saved) {
    return saved;
  }

  const detected = detectProviderFromEnv();
  if (detected) {
    const meta = PROVIDER_REGISTRY[detected];
    return {
      provider: detected,
      models: { ...meta.defaultModels },
    };
  }

  const fallback = PROVIDER_REGISTRY.openrouter;
  return {
    provider: 'openrouter',
    models: { ...fallback.defaultModels },
  };
}
