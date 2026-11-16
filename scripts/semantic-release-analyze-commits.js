'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const RELEASE_TYPES = ['patch', 'minor', 'major'];
const SKIP_RELEASE_RE = /\[skip\s+release]|\[release\s+skip]/i;
const FP_FASTIFY_RE = /fastify\s*:\s*['"]([^'"]+)['"]/;
const PLUGIN_SOURCE = 'src/plugin.ts';

/**
 * Contract-aware analyzeCommits: sole semantic-release analyzer for this repo.
 * Wraps @semantic-release/commit-analyzer for conventional commits, then raises
 * (never lowers) using Dependabot updated-dependencies YAML + package.json diffs.
 */
async function analyzeCommits(pluginConfig, context) {
  const { commits = [], logger, cwd = process.cwd() } = context;
  const { analyzeCommits: stockAnalyze } = await import('@semantic-release/commit-analyzer');

  const activeCommits = commits.filter(({ message, hash }) => {
    if (!message || !String(message).trim()) {
      return false;
    }
    if (SKIP_RELEASE_RE.test(message)) {
      if (logger && logger.log) {
        logger.log('Skip commit %s ([skip release] / [release skip])', hash);
      }
      return false;
    }
    return true;
  });

  const stockType = await stockAnalyze(pluginConfig, {
    ...context,
    commits: activeCommits,
  });

  let releaseType = normalizeReleaseType(stockType);

  for (const commit of activeCommits) {
    const depType = await scoreDependabotCommit(commit, cwd, logger);
    releaseType = maxReleaseType(releaseType, depType);
    if (releaseType === 'major') {
      break;
    }
  }

  if (logger && logger.log) {
    logger.log(
      'Contract analyzeCommits complete: %s release (stock=%s)',
      releaseType || 'no',
      stockType || 'no'
    );
  }

  return releaseType || undefined;
}

function normalizeReleaseType(type) {
  if (!type || type === false) {
    return null;
  }
  return RELEASE_TYPES.includes(type) ? type : null;
}

function maxReleaseType(current, next) {
  const a = normalizeReleaseType(current);
  const b = normalizeReleaseType(next);
  if (!b) {
    return a;
  }
  if (!a) {
    return b;
  }
  return RELEASE_TYPES.indexOf(b) > RELEASE_TYPES.indexOf(a) ? b : a;
}

async function scoreDependabotCommit(commit, cwd, logger) {
  const message = commit.message || '';
  const items = parseUpdatedDependencies(message);
  if (!items || items.length === 0) {
    return null;
  }

  const productionItems = items.filter((item) => !isDevelopmentDependency(item));
  if (productionItems.length === 0) {
    log(logger, 'Dependabot commit %s: development-only updates → no release', commit.hash);
    return null;
  }

  const beforePkg = await readJsonAt(cwd, `${commit.hash}^`, 'package.json');
  const afterPkg = await readJsonAt(cwd, commit.hash, 'package.json');

  if (!manifestContractFieldsChanged(beforePkg, afterPkg)) {
    log(logger, 'Dependabot commit %s: lockfile-only / no manifest contract fields → no release', commit.hash);
    return null;
  }

  const contract = await analyzeContractDiff(cwd, commit.hash, beforePkg, afterPkg);
  let commitRelease = null;

  for (const item of productionItems) {
    const itemRelease = scoreDependencyItem(item, contract);
    commitRelease = maxReleaseType(commitRelease, itemRelease);
  }

  // Peer / engines contract changes apply at commit level even when the
  // triggering dependency row is not itself "fastify".
  if (contract.breaking) {
    commitRelease = maxReleaseType(commitRelease, 'major');
  } else if (contract.peerWiden) {
    commitRelease = maxReleaseType(commitRelease, 'minor');
  }

  log(
    logger,
    'Dependabot commit %s: scored %s (%d production items)',
    commit.hash,
    commitRelease || 'none',
    productionItems.length
  );

  return commitRelease;
}

function scoreDependencyItem(item, contract) {
  const name = item['dependency-name'] || '';
  const updateType = item['update-type'] || '';

  // Hold: prom-client majors and Prometheus client rename need a human subject.
  if (name === '@prometheus-io/client' || name.startsWith('@prometheus-io/')) {
    return null;
  }
  if (name === 'prom-client' && updateType === 'version-update:semver-major') {
    return null;
  }

  if (contract.breaking) {
    return 'major';
  }

  if (name === 'fastify' && contract.peerWiden) {
    return 'minor';
  }

  if (name === 'prom-client') {
    return 'patch';
  }

  if (name === 'fastify-plugin') {
    return 'patch';
  }

  if (name.startsWith('@aws-sdk/') || name === 'aws-sdk' || name.startsWith('aws-')) {
    return 'patch';
  }

  // Other production dependencies with no contract break → patch
  // (security fixes included; caller-visible minors are a human raise).
  return 'patch';
}

function isDevelopmentDependency(item) {
  const depType = item['dependency-type'] || '';
  return depType === 'direct:development' || depType === 'indirect:development';
}

function manifestContractFieldsChanged(beforePkg, afterPkg) {
  if (!afterPkg) {
    return false;
  }
  if (!beforePkg) {
    return true;
  }
  return (
    jsonFieldChanged(beforePkg, afterPkg, 'dependencies') ||
    jsonFieldChanged(beforePkg, afterPkg, 'peerDependencies') ||
    jsonFieldChanged(beforePkg, afterPkg, 'engines')
  );
}

function jsonFieldChanged(beforePkg, afterPkg, key) {
  return JSON.stringify(beforePkg[key] || null) !== JSON.stringify(afterPkg[key] || null);
}

async function analyzeContractDiff(cwd, hash, beforePkg, afterPkg) {
  const beforePeer = (beforePkg && beforePkg.peerDependencies && beforePkg.peerDependencies.fastify) || '';
  const afterPeer = (afterPkg && afterPkg.peerDependencies && afterPkg.peerDependencies.fastify) || '';
  const beforeEngines = beforePkg && beforePkg.engines && beforePkg.engines.node;
  const afterEngines = afterPkg && afterPkg.engines && afterPkg.engines.node;

  const beforeFp = await readFpFastifyRange(cwd, `${hash}^`);
  const afterFp = await readFpFastifyRange(cwd, hash);

  const peerBefore = extractFastifyMajors(beforePeer);
  const peerAfter = extractFastifyMajors(afterPeer);
  const fpBefore = extractFastifyMajors(beforeFp);
  const fpAfter = extractFastifyMajors(afterFp);

  const peerDropped = isMajorSetDropped(peerBefore, peerAfter);
  const fpDropped = isMajorSetDropped(fpBefore, fpAfter);
  const peerWiden = isMajorSetWidened(peerBefore, peerAfter) || isMajorSetWidened(fpBefore, fpAfter);
  const enginesRaised = isNodeEngineRaised(beforeEngines, afterEngines);

  return {
    breaking: peerDropped || fpDropped || enginesRaised,
    peerWiden: peerWiden && !peerDropped && !fpDropped,
  };
}

function extractFastifyMajors(range) {
  const majors = new Set();
  if (!range || typeof range !== 'string') {
    return majors;
  }
  for (const part of range.split('||')) {
    const match = part.trim().match(/(\d+)/);
    if (match) {
      majors.add(Number(match[1]));
    }
  }
  return majors;
}

function isMajorSetDropped(before, after) {
  if (before.size === 0) {
    return false;
  }
  for (const major of before) {
    if (!after.has(major)) {
      return true;
    }
  }
  // Floor raise inside a single major (e.g. ^4.0.0 → ^4.5.0) is not a host drop
  // for this plugin's peer/fp encoding; engines.node covers runtime floor moves.
  return false;
}

function isMajorSetWidened(before, after) {
  if (after.size === 0) {
    return false;
  }
  for (const major of before) {
    if (!after.has(major)) {
      return false;
    }
  }
  return after.size > before.size;
}

function isNodeEngineRaised(before, after) {
  const a = parseNodeFloor(before);
  const b = parseNodeFloor(after);
  if (!b) {
    return false;
  }
  if (!a) {
    return true;
  }
  for (let i = 0; i < 3; i += 1) {
    if (b[i] > a[i]) {
      return true;
    }
    if (b[i] < a[i]) {
      return false;
    }
  }
  return false;
}

function parseNodeFloor(engine) {
  if (!engine || typeof engine !== 'string') {
    return null;
  }
  const match = engine.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)];
}

async function readFpFastifyRange(cwd, rev) {
  const source = await gitShow(cwd, rev, PLUGIN_SOURCE);
  if (!source) {
    return '';
  }
  const match = source.match(FP_FASTIFY_RE);
  return match ? match[1] : '';
}

async function readJsonAt(cwd, rev, filePath) {
  const raw = await gitShow(cwd, rev, filePath);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function gitShow(cwd, rev, filePath) {
  try {
    const { stdout } = await execFileAsync('git', ['show', `${rev}:${filePath}`], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Parse Dependabot's updated-dependencies YAML trailer without adding a YAML dep.
 */
function parseUpdatedDependencies(message) {
  const start = message.indexOf('updated-dependencies:');
  if (start === -1) {
    return null;
  }

  let block = message.slice(start);
  const end = block.search(/\n(?:\.\.\.|Signed-off-by:|---(?:\n|$))/);
  if (end !== -1) {
    block = block.slice(0, end);
  }

  const items = [];
  let current = null;

  for (const line of block.split('\n')) {
    const nameMatch = line.match(/^\s*-\s*dependency-name:\s*"?([^"\n]+?)"?\s*$/);
    if (nameMatch) {
      if (current) {
        items.push(current);
      }
      current = { 'dependency-name': nameMatch[1].trim() };
      continue;
    }
    if (!current) {
      continue;
    }
    const fieldMatch = line.match(
      /^\s+(dependency-type|update-type|dependency-version|dependency-group):\s*(.+?)\s*$/
    );
    if (fieldMatch) {
      current[fieldMatch[1]] = fieldMatch[2].replace(/^["']|["']$/g, '').trim();
    }
  }

  if (current) {
    items.push(current);
  }

  return items.length > 0 ? items : null;
}

function log(logger, message, ...args) {
  if (logger && typeof logger.log === 'function') {
    logger.log(message, ...args);
  }
}

module.exports = { analyzeCommits };
// Exported for smoke / unit-style checks without running semantic-release.
module.exports.parseUpdatedDependencies = parseUpdatedDependencies;
module.exports.scoreDependencyItem = scoreDependencyItem;
module.exports.maxReleaseType = maxReleaseType;
module.exports.extractFastifyMajors = extractFastifyMajors;
