module.exports = {
  branches: [
    'main',
    {
      name: 'release/*',
      prerelease: 'beta',
    },
    {
      name: 'feature/*',
      prerelease: 'alpha',
    },
  ],
  plugins: [
    // Sole analyzeCommits implementation (wraps stock conventional rules + Dependabot contract table).
    './scripts/semantic-release-analyze-commits.js',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      '@semantic-release/npm',
      {
        npmPublish: true,
        tarballDir: 'dist',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
  preset: 'conventionalcommits',
  presetConfig: {
    // Replacing types replaces the whole default list — keep feat/fix/perf visible,
    // show deps chores in the changelog, then hide the catch-all chore.
    types: [
      { type: 'feat', section: 'Features' },
      { type: 'feature', section: 'Features' },
      { type: 'fix', section: 'Bug Fixes' },
      { type: 'perf', section: 'Performance Improvements' },
      { type: 'revert', section: 'Reverts' },
      { type: 'docs', section: 'Documentation', effect: 'hidden' },
      { type: 'style', section: 'Styles', effect: 'hidden' },
      { type: 'chore', scope: 'deps', section: 'Dependencies' },
      { type: 'chore', section: 'Miscellaneous Chores', effect: 'hidden' },
      { type: 'refactor', section: 'Code Refactoring', effect: 'hidden' },
      { type: 'test', section: 'Tests', effect: 'hidden' },
      { type: 'build', section: 'Build System', effect: 'hidden' },
      { type: 'ci', section: 'Continuous Integration', effect: 'hidden' },
    ],
  },
  releaseRules: [
    // Major version bumps (type-qualified so chore(release) notes cannot re-major)
    { type: 'feat', breaking: true, release: 'major' },
    { type: 'fix', breaking: true, release: 'major' },
    { type: 'perf', breaking: true, release: 'major' },
    { type: 'refactor', breaking: true, release: 'major' },

    // Minor version bumps
    { type: 'feat', release: 'minor' },
    { type: 'perf', release: 'minor' },

    // Patch version bumps
    { type: 'fix', release: 'patch' },
    { type: 'docs', scope: 'README', release: 'patch' },
    { type: 'refactor', release: 'patch' },
    { type: 'style', release: 'patch' },
    { type: 'perf', release: 'patch' },
    { type: 'build', release: 'patch' },
    { type: 'revert', release: 'patch' },

    // Manual version control
    { scope: 'major', release: 'major' },
    { scope: 'minor', release: 'minor' },
    { scope: 'patch', release: 'patch' },

    // No release — do not add chore/deps → patch; Dependabot bumps are scored by the plugin
    { type: 'chore', release: false },
    { type: 'test', release: false },
    { type: 'ci', release: false },
    { scope: 'no-release', release: false },
  ],
  parserOpts: {
    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
  },
  writerOpts: {
    commitsSort: ['subject', 'scope'],
  },
};
