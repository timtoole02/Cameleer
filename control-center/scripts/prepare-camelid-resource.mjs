import { copyFileSync, chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

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
const destination = resolve(process.cwd(), 'src-tauri/camelid');

if (!existsSync(source)) {
  throw new Error(`Expected built Camelid binary at ${source}`);
}

copyFileSync(source, destination);
chmodSync(destination, 0o755);
console.log(`Prepared Camelid runtime resource: ${destination}`);
