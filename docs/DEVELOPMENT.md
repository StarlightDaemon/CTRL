# CTRL Development Guide

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 10+

## Quick Start

```bash
# Clone and install
cd extension
npm install

# Development server (Chrome)
npm run dev

# Development server (Firefox)
npm run dev:firefox
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Chrome) |
| `npm run dev:firefox` | Start dev server (Firefox) |
| `npm run build` | Build both browsers |
| `npm run build:chrome` | Build Chrome extension |
| `npm run build:firefox` | Build Firefox extension |
| `npm run compile` | TypeScript type check |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |

## Project Structure

```
extension/src/
├── app/          # App configuration
├── entrypoints/  # WXT entry points
├── features/     # Feature modules (FSD)
├── entities/     # Domain models (FSD)
└── shared/       # Shared utilities (FSD)
```

See [PROJECT_SOP.md](../research/docs/PROJECT_SOP.md) for complete structure.

## Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes following FSD patterns
3. Run `npm run compile` to check types
4. Run `npm run test` to verify tests
5. Build and test: `npm run build:chrome`
6. Submit PR with conventional commit messages

## Loading the Extension

### Chrome
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/builds/chrome-mv3`

### Firefox
1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `extension/builds/firefox-mv3/manifest.json`

## Debugging

- **Background Script**: Chrome DevTools → Extensions → Inspect service worker
- **Popup**: Right-click popup → Inspect
- **Content Scripts**: Open DevTools on the target page

## Testing

```bash
# Unit tests (Vitest)
npm run test

# Watch mode
npm run test -- --watch

# E2E tests (Playwright)
npm run test:e2e
```
