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
    '@semantic-release/commit-analyzer',
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
  releaseRules: [
    // Major version bumps
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
    
    // No release
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
