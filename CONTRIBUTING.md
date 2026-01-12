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

# Lint code
npm run lint

# Build for production
npm run build
```

## Code Standards

### General

- Use TypeScript strict mode
- Follow Feature-Sliced Design principles
- Write tests for new features
- Zero ESLint errors allowed (warnings are acceptable during development)

### ESLint Rules

Our ESLint v9 flat config enforces:

| Rule | Enforcement |
|------|-------------|
| `no-unused-vars` | Prefix with `_` if intentionally unused |
| `@ts-ignore` | Use `@ts-expect-error` with explanation instead |
| React Hooks rules | `exhaustive-deps` at warning level |
| `explicit-any` | Avoid; use `unknown` and type guards |

### State Management (Zustand)

We use Zustand for state management. Follow these patterns:

```typescript
// Good: Small, focused stores
const useTorrentStore = create<TorrentState>((set) => ({
    torrents: [],
    setTorrents: (torrents) => set({ torrents }),
}));

// Avoid: Monolithic stores with mixed concerns
```

## Contribution Guides

| Guide | Description |
|-------|-------------|
| [Adding a Client Adapter](docs/adding-a-client.md) | Step-by-step guide for adding torrent client support |
| [Development Setup](docs/DEVELOPMENT.md) | Environment setup and build instructions |
| [E2E Troubleshooting](docs/E2E_TROUBLESHOOTING.md) | Debugging Playwright/E2E test issues |

## Commit Messages

Follow [Conventional Commits](https://conventionalcommits.org):

```
feat(adapters): add new client adapter
fix(popup): resolve crash on empty state
docs: update README
chore: update dependencies
```

## Pull Requests

1. **Run tests locally**: `npm run test && npm run lint`
2. Update tests and documentation
3. Ensure CI passes (lint → typecheck → test → build → E2E)
4. Request review from maintainers
5. Squash commits before merge

### PR Checklist

- [ ] Tests added/updated
- [ ] No ESLint errors
- [ ] TypeScript compiles without errors
- [ ] Docs updated (if applicable)
- [ ] Commit messages follow convention

## Questions?

Open a [Discussion](https://github.com/StarlightDaemon/CTRL/discussions) or [Issue](https://github.com/StarlightDaemon/CTRL/issues).

