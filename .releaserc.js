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
    {
      name: 'hotfix/*',
      prerelease: 'rc',
    },
    {
      name: 'next',
      prerelease: 'next',
    },
    { 
      name: 'latest',
      channel: 'latest',
      prerelease: false,
    },
    { 
      name: 'stable',
      channel: 'stable',
      prerelease: false,
    },
    { 
      name: 'next',
      channel: 'next',
      prerelease: true,
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
    { type: 'docs', scope: 'README', release: 'patch' },
    { type: 'refactor', release: 'patch' },
    { type: 'style', release: 'patch' },
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
