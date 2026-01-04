# 001. Use Feature-Sliced Design Architecture

## Status

Accepted

## Context

The CTRL extension codebase was growing organically without clear architectural boundaries. This caused:
- Circular dependencies between modules
- Difficulty finding where code belongs
- Tight coupling between UI and business logic
- Poor testability

We needed a scalable architecture suitable for:
- Multi-context browser extension (popup, options, content scripts, background)
- React + TypeScript stack
- AI-navigable codebase

## Decision

Adopt **Feature-Sliced Design (FSD)** with the following layers:

1. `entrypoints/` - Browser extension entry points
2. `features/` - User-facing feature modules
3. `entities/` - Domain business models
4. `shared/` - Reusable utilities and components

Dependency rule: Lower layers cannot import from upper layers.

## Consequences

**Positive:**
- Clear boundaries prevent spaghetti code
- Features are self-contained and portable
- Easy to locate code by domain
- Testable in isolation

**Negative:**
- Learning curve for FSD concepts
- Requires discipline to maintain boundaries
- Some boilerplate (index.ts barrel files)

## References

- [Feature-Sliced Design](https://feature-sliced.design/)
- [PROJECT_SOP.md](../../research/docs/PROJECT_SOP.md)
