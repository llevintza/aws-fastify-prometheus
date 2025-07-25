# Contributing to @xoon/fastify-prometheus-metrics

Thank you for your interest in contributing to `@xoon/fastify-prometheus-metrics`! We welcome contributions from everyone and have established a streamlined process to make contributing as easy as possible.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Quick Links

- 📋 [Branching and Release Strategy](./docs/BRANCHING_STRATEGY.md)
- 🛠️ [Development Guide](./docs/DEVELOPMENT.md)
- 🐛 [Report a Bug](https://github.com/llevintza/aws-fastify-prometheus/issues/new?template=bug_report.yml)
- 💡 [Request a Feature](https://github.com/llevintza/aws-fastify-prometheus/issues/new?template=feature_request.yml)

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible using our bug report template.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please use our feature request template and provide as much detail as possible.

### Pull Requests

We follow a **trunk-based development** model. Please read our [Branching Strategy](./docs/BRANCHING_STRATEGY.md) for detailed information.

**Quick Overview:**
1. Fork the repo and create a feature branch from `main`: `feature/your-feature-name`
2. Develop your feature using [conventional commits](https://www.conventionalcommits.org/)
3. Test your changes with the automatically generated alpha releases
4. Create a pull request to merge back to `main`
5. After review and approval, your changes will be included in the next stable release

## Development Setup

### Prerequisites

- **Node.js**: Version 20.0.0 or higher (we recommend using the latest LTS version)
- **Yarn**: Version 4.6.0 (managed via Corepack)

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/llevintza/aws-fastify-prometheus.git
   cd aws-fastify-prometheus
   ```

2. Set up the correct Node.js version (if using nvm):
   ```bash
   nvm use
   ```

3. Enable Corepack to use the correct Yarn version:
   ```bash
   corepack enable
   ```
   ```

4. Install dependencies:
   ```bash
   yarn install
   ```

5. Run tests:
   ```bash
   yarn test
   ```

6. Run linting:
   ```bash
   yarn lint
   ```

5. Build the project:
   ```bash
   yarn build
   ```

## Branching and Release Workflow

We follow a **trunk-based development** approach with automated releases. For complete details, see our [Branching Strategy Guide](./docs/BRANCHING_STRATEGY.md).

### Feature Development

1. **Create Feature Branch**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Develop and Test**:
   ```bash
   # Make your changes
   git add .
   git commit -m "feat: add new metrics configuration"
   git push origin feature/your-feature-name
   ```

3. **Test Alpha Release**:
   - Pushing to your feature branch automatically creates an alpha release (e.g., `1.0.0-alpha.1`)
   - Test the alpha release to ensure your changes work correctly
   - Install with: `npm install @xoon/fastify-prometheus-metrics@alpha`

4. **Create Pull Request**:
   - Create PR from your feature branch to `main`
   - Include thorough description and testing notes
   - Reference any related issues

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Common Types:**
- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)
- `docs:` - Documentation changes (patch version bump)
- `refactor:` - Code refactoring (patch version bump)
- `test:` - Test changes (no release)
- `chore:` - Maintenance tasks (no release)

**Breaking Changes:**
```bash
feat!: redesign plugin API

BREAKING CHANGE: Configuration format has changed.
See migration guide for details.
```

### Development Workflow

We use Yarn for all development tasks:

- `yarn test` - Run all tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage report
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues automatically
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check if code is properly formatted
- `yarn build` - Build the TypeScript project
- `yarn build:watch` - Build in watch mode
- `yarn type-check` - Run TypeScript type checking

## Coding Standards

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint and Prettier)
- Write meaningful commit messages
- Add tests for new functionality
- Update documentation as needed

## Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

Examples:
- `feat: add prometheus metrics collection`
- `fix: resolve memory leak in metric aggregation`
- `docs: update API documentation`

## Release Process

1. All changes must be made via pull requests
2. Pull requests must be approved by a maintainer
3. All checks must pass before merging
4. Releases are created by maintainers using semantic versioning

## Questions?

Feel free to open an issue with the question label, or reach out to the maintainers directly.

Thank you for contributing! 🎉
