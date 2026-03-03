import {
  intro,
  outro,
  select,
  password,
  spinner,
  confirm,
  isCancel,
  cancel,
  note,
  text,
} from '@clack/prompts';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getAPIKey, getProviderMeta, writeAIConfig } from './aiConfig.js';
import { persistEnvVarToShell } from './shellEnvSetup.js';
import type { AIProviderName } from '../types.js';

const CUSTOM_MODEL_VALUE = '__custom__';

function getModelOptions(provider: AIProviderName) {
  const presets = getPresetModelOptions(provider);
  return [
    ...presets,
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID', hint: 'enter your own model identifier' },
  ];
}

function getPresetModelOptions(provider: AIProviderName) {
  switch (provider) {
    case 'openrouter':
      return [
        { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'fast, cheap (recommended)' },
        { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', hint: 'reliable' },
        { value: 'x-ai/grok-4-fast:free', label: 'Grok 4 Fast', hint: 'free tier' },
      ];
    case 'openai':
      return [
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini', hint: 'fast, cheap (recommended)' },
        { value: 'gpt-4o', label: 'GPT-4o', hint: 'higher quality' },
      ];
    case 'anthropic':
      return [
        { value: 'claude-haiku-3-5', label: 'Claude 3.5 Haiku', hint: 'fast, cheap (recommended)' },
        { value: 'claude-sonnet-4-5', label: 'Claude 4.5 Sonnet', hint: 'higher quality' },
      ];
    case 'google':
      return [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', hint: 'fast, cheap (recommended)' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'latest' },
      ];
  }
}

function createProviderForTest(provider: AIProviderName, apiKey: string, baseURL?: string) {
  switch (provider) {
    case 'openrouter':
      return createOpenAI({
        baseURL: baseURL || 'https://openrouter.ai/api/v1',
        apiKey,
        headers: {
          'HTTP-Referer': 'https://github.com/dmux/dmux',
          'X-Title': 'dmux',
        },
      });
    case 'openai':
      return createOpenAI({ apiKey, ...(baseURL && { baseURL }) });
    case 'anthropic':
      return createAnthropic({ apiKey, ...(baseURL && { baseURL }) });
    case 'google':
      return createGoogleGenerativeAI({ apiKey, ...(baseURL && { baseURL }) });
  }
}

export async function runAIProviderSetupWizard(): Promise<boolean> {
  intro('dmux AI Provider Setup');

  const provider = await select<AIProviderName>({
    message: 'Select your AI provider',
    options: [
      { value: 'openrouter', label: 'OpenRouter', hint: 'multi-model gateway (recommended)' },
      { value: 'openai', label: 'OpenAI', hint: 'direct API access' },
      { value: 'anthropic', label: 'Anthropic', hint: 'Claude models' },
      { value: 'google', label: 'Google AI', hint: 'Gemini models' },
    ],
  });
  if (isCancel(provider)) {
    cancel('Setup cancelled');
    return false;
  }

  const meta = getProviderMeta(provider);
  const existingKey = getAPIKey(provider);
  let apiKey: string | undefined;

  if (existingKey) {
    const useExisting = await confirm({
      message: `Found existing ${meta.envVar} in environment. Use it?`,
    });
    if (isCancel(useExisting)) {
      cancel('Setup cancelled');
      return false;
    }
    if (useExisting) {
      apiKey = existingKey;
    }
  }

  if (!apiKey) {
    const entered = await password({
      message: `Enter your ${meta.label} API key:`,
    });
    if (isCancel(entered) || !entered) {
      cancel('Setup cancelled');
      return false;
    }
    apiKey = entered;
  }

  const modelSelection = await select<string>({
    message: 'Choose your default model',
    options: getModelOptions(provider),
  });
  if (isCancel(modelSelection)) {
    cancel('Setup cancelled');
    return false;
  }

  let model = modelSelection;
  if (modelSelection === CUSTOM_MODEL_VALUE) {
    const customModel = await text({
      message: 'Enter custom model ID:',
      placeholder: meta.defaultModels.fast,
      validate: (value) => {
        if (!value || !value.trim()) return 'Model ID is required';
      },
    });
    if (isCancel(customModel)) {
      cancel('Setup cancelled');
      return false;
    }
    model = customModel;
  }

  // Optional base URL for corporate proxies
  const wantsBaseURL = await confirm({
    message: 'Use a custom base URL? (for corporate proxies)',
    initialValue: false,
  });
  if (isCancel(wantsBaseURL)) {
    cancel('Setup cancelled');
    return false;
  }

  let baseURL: string | undefined;
  if (wantsBaseURL) {
    const enteredURL = await text({
      message: 'Enter base URL:',
      placeholder: 'https://api.example.com/v1',
      validate: (value) => {
        if (!value || !value.trim()) return 'URL is required';
        try {
          new URL(value);
        } catch {
          return 'Must be a valid URL';
        }
      },
    });
    if (isCancel(enteredURL)) {
      cancel('Setup cancelled');
      return false;
    }
    baseURL = enteredURL;
  }

  const s = spinner();
  s.start('Testing connection...');
  try {
    const providerInstance = createProviderForTest(provider, apiKey, baseURL);
    await generateText({
      model: (providerInstance as unknown as (id: string) => Parameters<typeof generateText>[0]['model'])(model),
      prompt: 'Hi',
      maxOutputTokens: 5,
    });
    s.stop('Connected successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    s.stop(`Connection failed: ${errorMessage}`);

    const continueAnyway = await confirm({
      message: 'Connection test failed. Save configuration anyway?',
    });
    if (!continueAnyway || isCancel(continueAnyway)) {
      cancel('Setup cancelled');
      return false;
    }
  }

  await writeAIConfig({
    provider,
    ...(baseURL && { baseURL }),
    models: { fast: model, default: model },
  });

  if (apiKey !== existingKey) {
    const { shellConfigPath } = await persistEnvVarToShell(meta.envVar, apiKey);
    process.env[meta.envVar] = apiKey;
    note(
      `API key saved to ${shellConfigPath}\nRun: source ${shellConfigPath}`,
      'Shell Configuration'
    );
  }

  outro('AI provider configured successfully!');
  return true;
}
