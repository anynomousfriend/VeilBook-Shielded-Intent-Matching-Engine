// Tests verifying that stale codemod scripts (contract/*.cjs) and dev scratch
// files (veilbook-cli/test-decode.*, test-native.*) have been removed, and
// that nothing in the repo references them.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a path relative to the repo root (two levels up from src/test/). */
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

/** Check whether a file exists on disk. */
const fileExists = (relPath: string): boolean => {
  return fs.existsSync(path.join(repoRoot, relPath));
};

/**
 * Recursively collect all file paths under a directory (relative to repoRoot).
 * Skips node_modules and dist.
 */
const walkFiles = (dir: string): string[] => {
  const results: string[] = [];
  const absDir = path.join(repoRoot, dir);
  if (!fs.existsSync(absDir)) return results;

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      results.push(...walkFiles(rel));
    } else {
      results.push(rel);
    }
  }
  return results;
};

/**
 * Search all text files in the repo for a pattern.
 * Returns array of { file, line, content } matches.
 * Skips lock files and this test file.
 */
const grepRepo = (pattern: RegExp, dirs: string[] = ['contract', 'veilbook-cli', 'frontend']): Array<{
  file: string;
  line: number;
  content: string;
}> => {
  const matches: Array<{ file: string; line: number; content: string }> = [];

  for (const dir of dirs) {
    const files = walkFiles(dir).filter(
      (f) => /\.(ts|js|json|md|yml|yaml|sh)$/.test(f) && !f.includes('lock') && !f.includes('.next'),
    );
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(repoRoot, file), 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            matches.push({ file, line: i + 1, content: lines[i] });
          }
        }
      } catch {
        // Skip binary or unreadable files
      }
    }
  }

  return matches;
};

// ---------------------------------------------------------------------------
// The stale codemod .cjs files that must be removed
// ---------------------------------------------------------------------------

const STALE_CJS_FILES = [
  'contract/fix_all.cjs',
  'contract/fix_cli.cjs',
  'contract/remove_workaround.cjs',
  'contract/script.cjs',
  'contract/update_api.cjs',
  'contract/update_cli.cjs',
  'contract/update_cli2.cjs',
  'contract/update_cli3.cjs',
  'contract/update_readme.cjs',
];

// Dev scratch files that must be removed
const STALE_SCRATCH_FILES = [
  'veilbook-cli/test-decode.js',
  'veilbook-cli/test-decode.ts',
  'veilbook-cli/test-native.ts',
  'veilbook-cli/src/test-native.ts',
];

// ---------------------------------------------------------------------------
// 1. Verify stale codemod .cjs files are deleted
// ---------------------------------------------------------------------------

describe('stale codemod .cjs files removed from contract/', () => {
  for (const file of STALE_CJS_FILES) {
    it(`${path.basename(file)} does not exist`, () => {
      expect(fileExists(file)).toBe(false);
    });
  }

  it('no .cjs files remain in contract/ at all', () => {
    const contractDir = path.join(repoRoot, 'contract');
    if (!fs.existsSync(contractDir)) return; // contract dir may not exist in some setups
    const remaining = fs.readdirSync(contractDir).filter((f) => f.endsWith('.cjs'));
    expect(remaining).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Verify dev scratch files are deleted
// ---------------------------------------------------------------------------

describe('dev scratch files removed from veilbook-cli/', () => {
  for (const file of STALE_SCRATCH_FILES) {
    it(`${path.basename(file)} does not exist`, () => {
      expect(fileExists(file)).toBe(false);
    });
  }

  it('no test-decode.* files in veilbook-cli/ root', () => {
    const cliDir = path.join(repoRoot, 'veilbook-cli');
    const remaining = fs.readdirSync(cliDir).filter((f) => f.startsWith('test-decode'));
    expect(remaining).toEqual([]);
  });

  it('no test-native.* files in veilbook-cli/ root', () => {
    const cliDir = path.join(repoRoot, 'veilbook-cli');
    const remaining = fs.readdirSync(cliDir).filter((f) => f.startsWith('test-native'));
    expect(remaining).toEqual([]);
  });

  it('no test-native.* files in veilbook-cli/src/', () => {
    const srcDir = path.join(repoRoot, 'veilbook-cli', 'src');
    const remaining = fs.readdirSync(srcDir).filter((f) => f.startsWith('test-native'));
    expect(remaining).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. No references to removed files anywhere in the repo
// ---------------------------------------------------------------------------

describe('no references to removed files in repo source', () => {
  // Build a pattern matching the stale .cjs filenames (with extension to avoid
  // false positives on generic words like "script") and the scratch file prefixes.
  const stalePatterns = [
    ...STALE_CJS_FILES.map((f) => path.basename(f)),
    'test-decode',
    'test-native',
  ];

  // Escape regex special chars and join with alternation
  const patternStr = stalePatterns
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(patternStr);

  it('no import/require/reference to any stale codemod script', () => {
    const matches = grepRepo(pattern);
    // Filter out this test file itself and AGENTS.md (which documents the removal)
    const realMatches = matches.filter(
      (m) => !m.file.includes('stale-scripts-removed.test.ts') && !m.file.endsWith('AGENTS.md'),
    );

    if (realMatches.length > 0) {
      const details = realMatches
        .map((m) => `  ${m.file}:${m.line}: ${m.content.trim()}`)
        .join('\n');
      expect.fail(`Found references to removed files:\n${details}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Structural integrity: contract/ and veilbook-cli/ still have their
//    essential files after the cleanup
// ---------------------------------------------------------------------------

describe('structural integrity after cleanup', () => {
  const ESSENTIAL_CONTRACT_FILES = [
    'contract/package.json',
    'contract/src/managed/veilbook/contract/index.js',
  ];

  const ESSENTIAL_CLI_FILES = [
    'veilbook-cli/package.json',
    'veilbook-cli/src/api.ts',
    'veilbook-cli/src/config.ts',
    'veilbook-cli/vitest.config.ts',
  ];

  for (const file of ESSENTIAL_CONTRACT_FILES) {
    it(`${file} still exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }

  for (const file of ESSENTIAL_CLI_FILES) {
    it(`${file} still exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }

  it('contract/package.json is valid JSON', () => {
    const content = fs.readFileSync(path.join(repoRoot, 'contract/package.json'), 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('veilbook-cli/package.json is valid JSON', () => {
    const content = fs.readFileSync(path.join(repoRoot, 'veilbook-cli/package.json'), 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('contract/ directory itself still exists', () => {
    expect(fs.existsSync(path.join(repoRoot, 'contract'))).toBe(true);
  });

  it('only .cjs files were targeted - other contract files untouched', () => {
    const contractFiles = walkFiles('contract');
    // Should have files remaining (package.json, managed/, compact source, etc.)
    expect(contractFiles.length).toBeGreaterThan(0);
  });

  it('veilbook-cli/src/ still has source files', () => {
    const srcFiles = fs.readdirSync(path.join(repoRoot, 'veilbook-cli', 'src'));
    expect(srcFiles).toContain('api.ts');
    expect(srcFiles).toContain('config.ts');
  });

  it('removal did not introduce any new .cjs files elsewhere', () => {
    // Check that no new .cjs files appeared in repo root or veilbook-cli
    const rootCjs = fs.readdirSync(repoRoot).filter((f) => f.endsWith('.cjs'));
    const cliCjs = fs.readdirSync(path.join(repoRoot, 'veilbook-cli')).filter((f) => f.endsWith('.cjs'));
    expect(rootCjs).toEqual([]);
    expect(cliCjs).toEqual([]);
  });

  it('contract/src/managed/ contains legitimate build outputs that were not removed', () => {
    const managedDir = path.join(repoRoot, 'contract', 'src', 'managed');
    if (!fs.existsSync(managedDir)) return; // skip if managed doesn't exist

    const managedFiles = walkFiles('contract/src/managed').filter((f) => /\.(js|d\.ts)$/.test(f));
    // These are real build artifacts, not codemods - they should exist
    expect(managedFiles.length).toBeGreaterThan(0);
  });
});
