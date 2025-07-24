# Contributing to aws-node-prometheus

Thank you for your interest in contributing to aws-node-prometheus! We welcome contributions from everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible using our bug report template.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please use our feature request template and provide as much detail as possible.

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

- **Node.js**: Version 20.0.0 or higher (we recommend using the latest LTS version)
- **Yarn**: Version 4.6.0 (managed via Corepack)

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/llevintza/aws-node-prometheus.git
   cd aws-node-prometheus
   ```

2. Set up the correct Node.js version (if using nvm):
   ```bash
   nvm use
   ```

3. Enable Corepack to use the correct Yarn version:
   ```bash
   corepack enable
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
