import { copyFileSync, chmodSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const destination = resolve(process.cwd(), 'src-tauri/camelid');

function isValidBinary(path) {
  return existsSync(path) && statSync(path).size > 0;
}

// If a bundled Camelid runtime is already staged, reuse it. This keeps the
// packaging pipeline fast and lets it succeed under disk pressure without
// recompiling the entire inference engine. The build is only triggered when the
// binary is missing.
if (isValidBinary(destination)) {
  chmodSync(destination, 0o755);
  console.log(`Camelid runtime resource already present, reusing: ${destination}`);
  process.exit(0);
}

console.log('Camelid runtime resource missing; building from source...');
const build = spawnSync(
  'cargo',
  ['build', '--manifest-path', '../Cargo.toml', '-p', 'camelid', '--release'],
  { cwd: process.cwd(), stdio: 'inherit', encoding: 'utf8' }
);
if (build.status !== 0) {
  throw new Error('Failed to build Camelid runtime');
}

const metadata = spawnSync(
  'cargo',
  ['metadata', '--manifest-path', '../Cargo.toml', '--format-version=1', '--no-deps'],
  { cwd: process.cwd(), encoding: 'utf8' }
);
if (metadata.status !== 0) {
  throw new Error(`Failed to resolve Cargo target directory: ${metadata.stderr}`);
}

const targetDirectory = JSON.parse(metadata.stdout).target_directory;
const source = resolve(targetDirectory, 'release/camelid');
if (!existsSync(source)) {
  throw new Error(`Expected built Camelid binary at ${source}`);
}

copyFileSync(source, destination);
chmodSync(destination, 0o755);
console.log(`Prepared Camelid runtime resource: ${destination}`);
