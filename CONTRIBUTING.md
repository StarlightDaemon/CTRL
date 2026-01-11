# Contributing to CTRL

Thank you for your interest in contributing to CTRL! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/CTRL.git`
3. Install dependencies: `cd extension && npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Check types
npm run compile

# Build for production
npm run build
```

## Code Standards

- Follow the [Project SOP](research/docs/PROJECT_SOP.md)
- Use TypeScript strict mode
- Follow Feature-Sliced Design principles
- Write tests for new features

## Commit Messages

Follow [Conventional Commits](https://conventionalcommits.org):

```
feat(adapters): add new client adapter
fix(popup): resolve crash on empty state
docs: update README
```

## Pull Requests

1. Update tests and documentation
2. Ensure CI passes
3. Request review from maintainers
4. Squash commits before merge

## Questions?

Open a [Discussion](https://github.com/USER/CTRL/discussions) or [Issue](https://github.com/USER/CTRL/issues).
