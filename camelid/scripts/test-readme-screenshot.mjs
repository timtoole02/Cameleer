#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = new URL('..', import.meta.url)
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const expectedAsset = 'docs/assets/camelid-readme-chat-surface-dark.png'
const retiredLightAsset = 'docs/assets/ui-screenshot-v2.png'
const expectedSha256 = '7cd116017ab4f330ec5c0be6595c3514bbcc916aa67116db2dd1fbe363d943dc'

assert.match(
  readme,
  new RegExp(`!\\[Camelid WebUI chat surface\\]\\(${expectedAsset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`),
  'README must use the approved dark collapsed-rail Camelid chat screenshot',
)
assert.doesNotMatch(
  readme,
  new RegExp(retiredLightAsset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'README must not point at the retired light WebUI screenshot',
)
assert.match(
  readme,
  /dark, collapsed-rail chat surface/i,
  'README caption must preserve the intended dark collapsed-rail screenshot contract',
)

const assetBytes = readFileSync(join(repoRoot.pathname, expectedAsset))
const actualSha256 = createHash('sha256').update(assetBytes).digest('hex')
assert.equal(
  actualSha256,
  expectedSha256,
  'approved README screenshot bytes changed; update this guard only with explicit product approval',
)

console.log('README screenshot guard passed')
