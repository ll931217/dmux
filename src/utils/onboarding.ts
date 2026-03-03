import { LogService } from '../services/LogService.js';
import { runTmuxConfigOnboardingIfNeeded } from './tmuxConfigOnboarding.js';
import { readAIConfig, detectProviderFromEnv, getProviderMeta, writeAIConfig, resolveBaseURL } from './aiConfig.js';
import { runAIProviderSetupWizard } from './aiSetup.js';

/**
 * Returns true if setup is satisfied (config exists, auto-detected, or wizard completed).
 * Returns false if user cancelled the wizard.
 */
export async function runAIProviderSetupIfNeeded(): Promise<boolean> {
  const logger = LogService.getInstance();

  try {
    const existingConfig = await readAIConfig();
    if (existingConfig) return true;

    // Auto-detect from env vars: if API key + model env var are both set, skip wizard
    const detected = detectProviderFromEnv();
    if (detected) {
      const meta = getProviderMeta(detected);
      const envModel = meta.modelEnvVar ? process.env[meta.modelEnvVar] : undefined;
      if (envModel) {
        logger.debug(`Auto-configuring ${detected} from environment (model: ${envModel})`, 'onboarding');
        await writeAIConfig({
          provider: detected,
          ...(resolveBaseURL(detected) && { baseURL: resolveBaseURL(detected) }),
          models: { fast: envModel, default: envModel },
        });
        return true;
      }
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      logger.debug('Skipping AI provider setup — non-interactive terminal', 'onboarding');
      return true;
    }

    return await runAIProviderSetupWizard();
  } catch (error) {
    logger.warn(
      `AI provider setup failed: ${error instanceof Error ? error.message : String(error)}`,
      'onboarding'
    );
    return true;
  }
}

/**
 * Run all first-run onboarding checks in one place.
 * Returns false if user cancelled a required setup step (AI provider).
 */
export async function runFirstRunOnboardingIfNeeded(): Promise<boolean> {
  await runTmuxConfigOnboardingIfNeeded();
  return await runAIProviderSetupIfNeeded();
}
