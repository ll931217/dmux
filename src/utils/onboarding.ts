import { LogService } from '../services/LogService.js';
import { runTmuxConfigOnboardingIfNeeded } from './tmuxConfigOnboarding.js';
import { readAIConfig, detectProviderFromEnv, writeAIConfig, getProviderMeta } from './aiConfig.js';
import { runAIProviderSetupWizard } from './aiSetup.js';

export async function runAIProviderSetupIfNeeded(): Promise<void> {
  const logger = LogService.getInstance();

  try {
    const existingConfig = await readAIConfig();
    if (existingConfig) return;

    const detected = detectProviderFromEnv();
    if (detected) {
      const meta = getProviderMeta(detected);
      await writeAIConfig({
        provider: detected,
        models: { ...meta.defaultModels },
      });
      logger.debug(`Auto-configured AI provider from ${meta.envVar}`, 'onboarding');
      return;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      logger.debug('Skipping AI provider setup — non-interactive terminal', 'onboarding');
      return;
    }

    await runAIProviderSetupWizard();
  } catch (error) {
    logger.warn(
      `AI provider setup failed: ${error instanceof Error ? error.message : String(error)}`,
      'onboarding'
    );
  }
}

/**
 * Run all first-run onboarding checks in one place.
 * This currently includes:
 * - tmux config suggestion/setup
 * - AI provider setup (multi-provider wizard)
 */
export async function runFirstRunOnboardingIfNeeded(): Promise<void> {
  await runTmuxConfigOnboardingIfNeeded();
  await runAIProviderSetupIfNeeded();
}
