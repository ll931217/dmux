import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  escapeRegex,
  quoteForPosix,
  quoteForFish,
  isFishShell,
  fileExists,
  getShellConfigCandidates,
  resolveShellConfigPath,
  buildExportLine,
  upsertEnvVarBlock,
  persistEnvVarToShell,
} from '../src/utils/shellEnvSetup.js';

describe('escapeRegex', () => {
  it('escapes all regex special characters', () => {
    const input = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(input);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeRegex('hello')).toBe('hello');
    expect(escapeRegex('abc123')).toBe('abc123');
  });

  it('escapes characters embedded in normal text', () => {
    expect(escapeRegex('price: $10.00')).toBe('price: \\$10\\.00');
  });
});

describe('quoteForPosix', () => {
  it('wraps a simple value in single quotes', () => {
    expect(quoteForPosix('hello')).toBe("'hello'");
  });

  it('escapes single quotes within the value', () => {
    expect(quoteForPosix("it's")).toBe("'it'\\''s'");
  });

  it('handles empty string', () => {
    expect(quoteForPosix('')).toBe("''");
  });

  it('handles value with multiple single quotes', () => {
    expect(quoteForPosix("a'b'c")).toBe("'a'\\''b'\\''c'");
  });

  it('does not escape double quotes', () => {
    expect(quoteForPosix('say "hi"')).toBe('\'say "hi"\'');
  });
});

describe('quoteForFish', () => {
  it('wraps a simple value in double quotes', () => {
    expect(quoteForFish('hello')).toBe('"hello"');
  });

  it('escapes backslashes', () => {
    expect(quoteForFish('a\\b')).toBe('"a\\\\b"');
  });

  it('escapes dollar signs', () => {
    expect(quoteForFish('$HOME')).toBe('"\\$HOME"');
  });

  it('escapes backticks', () => {
    expect(quoteForFish('run `cmd`')).toBe('"run \\`cmd\\`"');
  });

  it('escapes double quotes', () => {
    expect(quoteForFish('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('escapes multiple special characters together', () => {
    expect(quoteForFish('$a\\b"c`d')).toBe('"\\$a\\\\b\\"c\\`d"');
  });

  it('handles empty string', () => {
    expect(quoteForFish('')).toBe('""');
  });
});

describe('isFishShell', () => {
  it('returns true for /usr/bin/fish', () => {
    expect(isFishShell('/usr/bin/fish')).toBe(true);
  });

  it('returns true for /usr/local/bin/fish', () => {
    expect(isFishShell('/usr/local/bin/fish')).toBe(true);
  });

  it('returns true for case-insensitive fish path', () => {
    expect(isFishShell('/usr/bin/Fish')).toBe(true);
  });

  it('returns false for /bin/bash', () => {
    expect(isFishShell('/bin/bash')).toBe(false);
  });

  it('returns false for /bin/zsh', () => {
    expect(isFishShell('/bin/zsh')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFishShell(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isFishShell('')).toBe(false);
  });
});

describe('fileExists', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dmux-fileexists-'));
  });

  it('returns true for an existing file', async () => {
    const filePath = join(tempDir, 'exists.txt');
    writeFileSync(filePath, 'content', 'utf-8');
    expect(await fileExists(filePath)).toBe(true);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns false for a non-existent path', async () => {
    expect(await fileExists(join(tempDir, 'nope.txt'))).toBe(false);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns false for a directory', async () => {
    expect(await fileExists(tempDir)).toBe(false);
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('getShellConfigCandidates', () => {
  const home = '/home/testuser';

  it('returns .zshrc and .zprofile for zsh', () => {
    expect(getShellConfigCandidates('/bin/zsh', home)).toEqual([
      '/home/testuser/.zshrc',
      '/home/testuser/.zprofile',
    ]);
  });

  it('returns .bashrc, .bash_profile, .profile for bash', () => {
    expect(getShellConfigCandidates('/bin/bash', home)).toEqual([
      '/home/testuser/.bashrc',
      '/home/testuser/.bash_profile',
      '/home/testuser/.profile',
    ]);
  });

  it('returns fish config path for fish', () => {
    expect(getShellConfigCandidates('/usr/bin/fish', home)).toEqual([
      '/home/testuser/.config/fish/config.fish',
    ]);
  });

  it('returns .profile for unknown shell', () => {
    expect(getShellConfigCandidates('/bin/csh', home)).toEqual([
      '/home/testuser/.profile',
    ]);
  });

  it('returns .profile for undefined shell', () => {
    expect(getShellConfigCandidates(undefined, home)).toEqual([
      '/home/testuser/.profile',
    ]);
  });
});

describe('resolveShellConfigPath', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dmux-resolve-'));
  });

  it('returns the first existing candidate', async () => {
    const zshrcPath = join(tempDir, '.zshrc');
    writeFileSync(zshrcPath, '', 'utf-8');
    const result = await resolveShellConfigPath('/bin/zsh', tempDir);
    expect(result).toBe(zshrcPath);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the second candidate when first does not exist', async () => {
    const zprofilePath = join(tempDir, '.zprofile');
    writeFileSync(zprofilePath, '', 'utf-8');
    const result = await resolveShellConfigPath('/bin/zsh', tempDir);
    expect(result).toBe(zprofilePath);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('falls back to first candidate when none exist', async () => {
    const result = await resolveShellConfigPath('/bin/zsh', tempDir);
    expect(result).toBe(join(tempDir, '.zshrc'));
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('buildExportLine', () => {
  it('produces POSIX export for bash', () => {
    const line = buildExportLine('MY_VAR', 'my-value', '/bin/bash');
    expect(line).toBe("export MY_VAR='my-value'");
  });

  it('produces POSIX export for zsh', () => {
    const line = buildExportLine('API_KEY', 'sk-123', '/bin/zsh');
    expect(line).toBe("export API_KEY='sk-123'");
  });

  it('produces fish set -gx for fish shell', () => {
    const line = buildExportLine('MY_VAR', 'my-value', '/usr/bin/fish');
    expect(line).toBe('set -gx MY_VAR "my-value"');
  });

  it('trims whitespace from value', () => {
    const line = buildExportLine('VAR', '  spaced  ', '/bin/bash');
    expect(line).toBe("export VAR='spaced'");
  });

  it('defaults to POSIX when shellPath is undefined', () => {
    const line = buildExportLine('VAR', 'val');
    expect(line).toBe("export VAR='val'");
  });

  it('handles values with single quotes in POSIX mode', () => {
    const line = buildExportLine('VAR', "it's", '/bin/bash');
    expect(line).toBe("export VAR='it'\\''s'");
  });

  it('handles values with dollar signs in fish mode', () => {
    const line = buildExportLine('VAR', '$HOME/path', '/usr/bin/fish');
    expect(line).toBe('set -gx VAR "\\$HOME/path"');
  });
});

describe('upsertEnvVarBlock', () => {
  const BLOCK_START = '# >>> dmux ai >>>';
  const BLOCK_END = '# <<< dmux ai <<<';

  it('inserts block into empty content', () => {
    const exportLine = "export MY_VAR='hello'";
    const result = upsertEnvVarBlock('', exportLine);

    expect(result).toBe(
      `${BLOCK_START}\n${exportLine}\n${BLOCK_END}\n`
    );
  });

  it('appends block to existing content without trailing newline', () => {
    const existing = '# some config';
    const exportLine = "export MY_VAR='hello'";
    const result = upsertEnvVarBlock(existing, exportLine);

    expect(result).toBe(
      `# some config\n\n${BLOCK_START}\n${exportLine}\n${BLOCK_END}\n`
    );
  });

  it('appends block to existing content with trailing newline', () => {
    const existing = '# some config\n';
    const exportLine = "export MY_VAR='hello'";
    const result = upsertEnvVarBlock(existing, exportLine);

    expect(result).toBe(
      `# some config\n\n${BLOCK_START}\n${exportLine}\n${BLOCK_END}\n`
    );
  });

  it('replaces an existing managed block', () => {
    const existing = [
      '# preamble',
      BLOCK_START,
      "export MY_VAR='old'",
      BLOCK_END,
      '',
      '# postamble',
    ].join('\n');

    const exportLine = "export MY_VAR='new'";
    const result = upsertEnvVarBlock(existing, exportLine);

    expect(result).not.toContain('old');
    expect(result).toContain("export MY_VAR='new'");
    expect(result).toContain(BLOCK_START);
    expect(result).toContain(BLOCK_END);
    expect(result).toContain('# preamble');
    expect(result).toContain('# postamble');
  });

  it('normalizes CRLF to LF', () => {
    const existing = '# config\r\n';
    const exportLine = "export VAR='val'";
    const result = upsertEnvVarBlock(existing, exportLine);

    expect(result).not.toContain('\r');
    expect(result).toContain(BLOCK_START);
  });

  it('result always ends with newline', () => {
    const exportLine = "export VAR='val'";

    expect(upsertEnvVarBlock('', exportLine).endsWith('\n')).toBe(true);
    expect(upsertEnvVarBlock('content', exportLine).endsWith('\n')).toBe(true);
    expect(upsertEnvVarBlock('content\n', exportLine).endsWith('\n')).toBe(true);
  });
});

describe('persistEnvVarToShell', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dmux-persist-'));
  });

  it('writes export to an existing zshrc', async () => {
    const zshrcPath = join(tempDir, '.zshrc');
    writeFileSync(zshrcPath, '# existing config\n', 'utf-8');

    const result = await persistEnvVarToShell('MY_VAR', 'test-value', {
      shellPath: '/bin/zsh',
      homeDir: tempDir,
    });

    expect(result.shellConfigPath).toBe(zshrcPath);
    expect(result.exportLine).toBe("export MY_VAR='test-value'");

    const content = readFileSync(zshrcPath, 'utf-8');
    expect(content).toContain('# >>> dmux ai >>>');
    expect(content).toContain("export MY_VAR='test-value'");
    expect(content).toContain('# <<< dmux ai <<<');
    expect(content).toContain('# existing config');

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates the config file when it does not exist', async () => {
    const result = await persistEnvVarToShell('API_KEY', 'sk-123', {
      shellPath: '/bin/zsh',
      homeDir: tempDir,
    });

    const zshrcPath = join(tempDir, '.zshrc');
    expect(result.shellConfigPath).toBe(zshrcPath);

    const content = readFileSync(zshrcPath, 'utf-8');
    expect(content).toContain("export API_KEY='sk-123'");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates parent directories for fish config', async () => {
    const result = await persistEnvVarToShell('VAR', 'value', {
      shellPath: '/usr/bin/fish',
      homeDir: tempDir,
    });

    const fishConfigPath = join(tempDir, '.config', 'fish', 'config.fish');
    expect(result.shellConfigPath).toBe(fishConfigPath);
    expect(result.exportLine).toBe('set -gx VAR "value"');

    const content = readFileSync(fishConfigPath, 'utf-8');
    expect(content).toContain('set -gx VAR "value"');

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('updates existing managed block on repeated calls', async () => {
    const zshrcPath = join(tempDir, '.zshrc');
    writeFileSync(zshrcPath, '', 'utf-8');

    await persistEnvVarToShell('VAR', 'first', {
      shellPath: '/bin/zsh',
      homeDir: tempDir,
    });

    await persistEnvVarToShell('VAR', 'second', {
      shellPath: '/bin/zsh',
      homeDir: tempDir,
    });

    const content = readFileSync(zshrcPath, 'utf-8');
    expect(content).not.toContain('first');
    expect(content).toContain("export VAR='second'");

    const blockStartCount = content.split('# >>> dmux ai >>>').length - 1;
    expect(blockStartCount).toBe(1);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns correct exportLine for fish shell', async () => {
    mkdirSync(join(tempDir, '.config', 'fish'), { recursive: true });
    writeFileSync(join(tempDir, '.config', 'fish', 'config.fish'), '', 'utf-8');

    const result = await persistEnvVarToShell('TOKEN', 'abc$def', {
      shellPath: '/usr/bin/fish',
      homeDir: tempDir,
    });

    expect(result.exportLine).toBe('set -gx TOKEN "abc\\$def"');

    rmSync(tempDir, { recursive: true, force: true });
  });
});
