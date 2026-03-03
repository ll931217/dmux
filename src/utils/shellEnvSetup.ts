import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const BLOCK_START = '# >>> dmux ai >>>';
const BLOCK_END = '# <<< dmux ai <<<';

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function quoteForPosix(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function quoteForFish(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
  return `"${escaped}"`;
}

export function isFishShell(shellPath?: string): boolean {
  return path.basename(shellPath || '').toLowerCase().includes('fish');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export function getShellConfigCandidates(shellPath: string | undefined, homeDir: string): string[] {
  const shellName = path.basename(shellPath || '').toLowerCase();

  if (shellName.includes('zsh')) {
    return [
      path.join(homeDir, '.zshrc'),
      path.join(homeDir, '.zprofile'),
    ];
  }

  if (shellName.includes('bash')) {
    return [
      path.join(homeDir, '.bashrc'),
      path.join(homeDir, '.bash_profile'),
      path.join(homeDir, '.profile'),
    ];
  }

  if (shellName.includes('fish')) {
    return [
      path.join(homeDir, '.config', 'fish', 'config.fish'),
    ];
  }

  return [path.join(homeDir, '.profile')];
}

export async function resolveShellConfigPath(shellPath: string | undefined, homeDir: string): Promise<string> {
  const candidates = getShellConfigCandidates(shellPath, homeDir);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function buildExportLine(varName: string, value: string, shellPath?: string): string {
  const trimmedValue = value.trim();
  if (isFishShell(shellPath)) {
    return `set -gx ${varName} ${quoteForFish(trimmedValue)}`;
  }

  return `export ${varName}=${quoteForPosix(trimmedValue)}`;
}

export function upsertEnvVarBlock(existingContent: string, exportLine: string): string {
  const normalizedContent = existingContent.replace(/\r\n/g, '\n');
  const block = `${BLOCK_START}\n${exportLine}\n${BLOCK_END}`;
  const blockPattern = new RegExp(
    `${escapeRegex(BLOCK_START)}[\\s\\S]*?${escapeRegex(BLOCK_END)}\\n?`,
    'm'
  );

  if (blockPattern.test(normalizedContent)) {
    const replaced = normalizedContent.replace(blockPattern, `${block}\n`);
    return replaced.endsWith('\n') ? replaced : `${replaced}\n`;
  }

  if (!normalizedContent) {
    return `${block}\n`;
  }

  const withTrailingNewline = normalizedContent.endsWith('\n')
    ? normalizedContent
    : `${normalizedContent}\n`;

  return `${withTrailingNewline}\n${block}\n`;
}

export async function persistEnvVarToShell(
  varName: string,
  value: string,
  options?: { shellPath?: string; homeDir?: string }
): Promise<{ shellConfigPath: string; exportLine: string }> {
  const homeDir = options?.homeDir || process.env.HOME || os.homedir();
  if (!homeDir) {
    throw new Error('Unable to determine HOME directory');
  }

  const shellPath = options?.shellPath || process.env.SHELL;
  const shellConfigPath = await resolveShellConfigPath(shellPath, homeDir);

  let existingContent = '';
  try {
    existingContent = await fs.readFile(shellConfigPath, 'utf-8');
  } catch {
    // Expected if shell config does not exist yet
  }

  const exportLine = buildExportLine(varName, value, shellPath);
  const updatedContent = upsertEnvVarBlock(existingContent, exportLine);

  await fs.mkdir(path.dirname(shellConfigPath), { recursive: true });
  await fs.writeFile(shellConfigPath, updatedContent, 'utf-8');

  return { shellConfigPath, exportLine };
}
