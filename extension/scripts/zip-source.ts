import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const extensionDir = process.cwd();
  const packageJsonPath = join(extensionDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const repoRoot = execSync('git rev-parse --show-toplevel', {
    cwd: extensionDir,
    encoding: 'utf8',
  }).trim();

  if (repoRoot !== join(extensionDir, '..')) {
    throw new Error(`Expected to run inside the extension workspace, but repo root resolved to ${repoRoot}`);
  }

  const dirtyTree = execSync('git status --porcelain --untracked-files=all -- extension', {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  if (dirtyTree) {
    throw new Error(
      `Refusing to create a source archive from a dirty extension tree.\nCommit or stash these changes first:\n${dirtyTree}`,
    );
  }

  const version = packageJson.version;

  if (!version) {
    throw new Error('Could not find version in package.json');
  }

  const trackedScriptPath = execSync(
    'git ls-files --error-unmatch extension/scripts/zip-source.ts',
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  ).trim();

  if (trackedScriptPath !== 'extension/scripts/zip-source.ts') {
    throw new Error('zip-source script must be tracked in git before archive creation');
  }

  const outDir = join(extensionDir, 'builds', 'source');
  mkdirSync(outDir, { recursive: true });

  const archiveName = `ctrl-extension-${version}-source.zip`;
  const relativeArchiveOutPath = `extension/builds/source/${archiveName}`;
  const archivePath = join(outDir, archiveName);

  const includePathspecs = [
    'extension/.gitignore',
    'extension/CHANGELOG.md',
    'extension/LINUX_SETUP.md',
    'extension/babel.config.js',
    'extension/e2e',
    'extension/eslint.config.js',
    'extension/package-lock.json',
    'extension/package.json',
    'extension/playwright.config.ts',
    'extension/postcss.config.js',
    'extension/scripts',
    'extension/src',
    'extension/tailwind.config.js',
    'extension/tests',
    'extension/tsconfig.json',
    'extension/vitest.config.ts',
    'extension/vitest.setup.ts',
    'extension/wxt.config.ts',
    ':(exclude)extension/tests/e2e/.persistent-data',
  ];

  console.log(`Creating AMO source archive for v${version} from clean HEAD...`);

  const quotedPathspecs = includePathspecs.map((pathspec) => `"${pathspec}"`).join(' ');
  execSync(
    `git archive --format=zip --output "${relativeArchiveOutPath}" HEAD ${quotedPathspecs}`,
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  console.log(`Successfully created source archive: ${archivePath}`);
} catch (error) {
  console.error('\nFailed to create source archive:', error);
  process.exit(1);
}
