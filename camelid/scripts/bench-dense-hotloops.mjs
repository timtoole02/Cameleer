#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const skipBuild = args.includes('--skip-build')
const passthrough = args.filter(arg => arg !== '--skip-build')

if (!skipBuild) {
  const build = spawnSync('cargo', ['build', '--release'], { stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

const bench = spawnSync(
  'target/release/camelid',
  ['bench-dense-hotloops', ...passthrough],
  { stdio: 'inherit' },
)
process.exit(bench.status ?? 1)
