Project Architecture & Implementation Standard Operating Procedure (SOP): The CTRL Browser Extension1. Executive Summary and Architectural VisionThe development of browser extensions represents a distinct engineering challenge that diverges significantly from traditional web application paradigms. While a standard Single Page Application (SPA) operates within a cohesive, singular execution environment, a browser extension is inherently distributed. It functions across fragmented contexts—the persistent (or semi-persistent) background service worker, the transient popup interface, the isolated content scripts injected into third-party DOMs, and potentially side panels or developer tools. For the CTRL project, utilizing the WXT Framework, React, TypeScript, and Tailwind CSS, the complexity is compounded by the need for modern tooling and state synchronization across these disjointed environments.The current project state, characterized by significant evolution and a growing codebase rooted in Documents/Projects/CTRL, necessitates a transition from organic growth to a rigid, enterprise-grade architecture. Ad-hoc file organization, while sufficient for prototyping, inevitably leads to circular dependencies, tight coupling between business logic and view layers, and a cognitive load that hinders scalability. This document serves as the unified "Single Source of Truth" for the architectural standards of the CTRL project. It defines a "Best in Class" file hierarchy and operational procedure designed not just for human maintainability, but for AI-navigability—ensuring that automated coding assistants can infer context, dependency rules, and architectural intent solely from file paths and structural conventions.1.1 The Hybrid Architectural StrategyThe architectural vision for CTRL prioritizes the decoupling of Business Logic from Extension Entrypoints. We will adopt a hybrid architecture that integrates WXT’s file-system routing mechanisms with the rigorous organizational principles of Feature-Sliced Design (FSD).WXT Framework Role: WXT acts as the build system and "glue" layer. It handles the browser-specific configuration, manifest generation, and the bundling of entry points. It is the infrastructure provider.1Feature-Sliced Design Role: FSD provides the internal architectural rules. It dictates how React components, hooks, and utilities are organized based on business domain rather than technical function. This prevents the "spaghetti code" phenomenon where a component in a popup imports deeply nested logic from a content script, creating fragile, untestable code.3This SOP establishes strict boundaries. Code that defines what the application does (Features and Entities) must remain agnostic to where it runs (Popup vs. Sidepanel). This ensures that a user authentication flow developed for the Popup can be reused in the Options page or a Content Script UI without modification.1.2 Core Architectural PrinciplesTo guide all future development within the CTRL project, the following principles are immutable:Unidirectional Dependency Flow: Dependencies must flow strictly downwards through the architectural layers. A "Feature" may import an "Entity," but an "Entity" effectively never imports a "Feature." This eliminates circular references.5Context Agnosticism: Core business logic must be isolated from the browser extension API wherever possible. We wrap chrome.* APIs in typed utilities to ensure that logic can be unit-tested in Node.js environments without complex mocking.6Explicit Public APIs: Every architectural slice must expose a "Public API" via an index.ts barrel file. Internal implementation details are encapsulated, preventing "deep imports" that break refactoring.8Type Safety Over Runtime Checks: We leverage TypeScript's advanced features to enforce messaging protocols and storage schemas at compile time, reducing the class of runtime errors common in loosely typed message passing.92. Directory Structure and File HierarchyThe file hierarchy is the physical manifestation of our architectural rules. The current structure (extension/, research/) is a solid foundation but requires reorganization to support the scale of a complex React application. The mandatory structure moves the WXT source code into a dedicated src/ directory to separate configuration from source logic, a pattern strongly recommended for maintainability in large WXT projects.12.1 The Ideal File TreeThe root of the repository (Documents/Projects/CTRL) remains the orchestrator, containing project-level documentation, research, and the extension source.2.1.1 Root ConfigurationThe root directory manages the environment and tooling for the entire repository.PathPurposeRationaleDocuments/Projects/CTRL/Project RootThe absolute anchor for the project workspace.├── .github/CI/CD & TemplatesAutomates workflows and standardizes issue reporting.├── .vscode/Editor SettingsEnforces workspace settings for VS Code to ensure consistency across developers.12├── docs/ADR RepositoryStores Architecture Decision Records. Replaces ad-hoc documentation.13├── research/Knowledge BaseContains active specs (research/docs) and archival data (research/archive).├── extension/WXT RootThe isolated extension workspace.2.1.2 The WXT Root (extension/)The extension/ directory is where the WXT framework operates. By configuring srcDir: 'src' in wxt.config.ts, we create a clean separation between build artifacts and source code.1Plaintextextension/
├──.output/                   # Build artifacts (gitignored) - Do not touch 
├──.wxt/                      # WXT generated types (gitignored) - Auto-generated 
├── wxt.config.ts              # Main WXT configuration 
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
│
└── src/                       # Source Directory (srcDir: 'src') 
    ├── app/                   # Layer 1: App-wide configuration
    │   ├── styles/            # Global CSS, Tailwind directives, Fonts
    │   ├── providers/         # Global Context Providers (QueryClient, Theme)
    │   ├── router/            # Router configuration (if using hash routing) [14]
    │   └── types/             # Global type definitions (d.ts)
    │
    ├── entrypoints/           # WXT Entry Points - The "Glue" Layer [15]
    │   ├── background.ts      # Service Worker entry (Event Bus)
    │   ├── content.ts         # Main content script (UI Injection)
    │   ├── popup/             # Popup Entry Folder
    │   │   ├── index.html     # Popup HTML
    │   │   └── main.tsx       # Popup React Root
    │   ├── options/           # Options Entry Folder
    │   └── sidepanel/         # Sidepanel Entry Folder
    │
    ├── widgets/               # Layer 3: Compositional Blocks [16]
    │   ├── header/            # Reusable Header widget
    │   └── navigation/        # Sidebar navigation widget
    │
    ├── features/              # Layer 4: User Scenarios 
    │   ├── auth/              # Authentication Feature Slice
    │   │   ├── ui/            # LoginForm, LogoutButton
    │   │   ├── model/         # useLogin, useLogout hooks
    │   │   └── index.ts       # Public API
    │   └── theme-switcher/    # Theme Toggling Feature Slice
    │
    ├── entities/              # Layer 5: Business Domain Models [17]
    │   ├── user/              # User Entity
    │   │   ├── model/         # User type, Validation Schemas, Stores
    │   │   ├── ui/            # UserAvatar, UserCard
    │   │   └── index.ts       # Public API
    │   └── session/           # Session Entity
    │
    └── shared/                # Layer 6: Reusable Primitives [17]
        ├── ui/                # UI Kit (Buttons, Inputs, Cards) - "Dumb" components
        ├── lib/               # Utilities (Date formatting, String manipulation)
        ├── api/               # API Clients (Messaging wrappers, Storage wrappers)
        └── assets/            # Shared static assets (Icons, Images)
2.2 Decision Tree for File PlacementTo ensure consistency, every file creation must follow this logic tree. This prevents the "where do I put this?" ambiguity that degrades architectural integrity over time.Is this file required by the browser to boot the extension?Yes (e.g., manifest definition, background script, popup html): Place in src/entrypoints/.Does this code contain business logic specific to a domain concept (e.g., User, Product)?Yes: It belongs in src/entities/{domain}/.Does this code represent a complete user action or use case (e.g., "Log In", "Add to Cart")?Yes: It belongs in src/features/{feature_name}/.Is this a standalone UI block composed of features and entities (e.g., Header, DashboardGrid)?Yes: Place in src/widgets/{widget_name}/.Is this a generic utility or UI component usable in any project (e.g., Button, formatDate)?Yes: Place in src/shared/.Is this global configuration (styles, providers)?Yes: Place in src/app/.3. Feature-Sliced Design (FSD) Implementation StrategyThe CTRL project strictly adheres to Feature-Sliced Design. This methodology is chosen specifically to address the scalability issues inherent in complex React applications. Unlike "Layered" architectures (grouping by components, hooks, services), FSD groups by Domain, ensuring that related code sits together. This is critical for AI assistants, which can process a "Slice" as a coherent context unit.53.1 The Architectural LayersFSD organizes the codebase into standardized layers, ordered by abstraction level. The fundamental rule is the Dependency Rule: A module in a higher layer can only import from layers strictly below it.LayerFSD LevelResponsibilityExamplesAllowed ImportsApp1 (Top)Global app setup, styles, and providers.AppProvider, global.cssWidgets, Features, Entities, SharedPages2Full views constructed from widgets. In WXT, these are often consumed directly by entrypoints.SettingsPage, PopupViewWidgets, Features, Entities, SharedWidgets3Self-contained UI blocks acting as layout structures.Header, Sidebar, FeedFeatures, Entities, SharedFeatures4User interactions that deliver business value.AuthByEmail, ThemeSwitcherEntities, SharedEntities5Domain business models and data logic.User, Session, OrderSharedShared6 (Bottom)Domain-agnostic primitives.Button, Input, apiClientNone (External libs only)3.2 Anatomy of a SliceWithin the Entities, Features, and Widgets layers, code is organized into Slices. A slice is a directory representing a specific domain concept. Inside a slice, we use standardized Segments to separate concerns.4Example Slice: src/features/authenticationui/ (Segment): Contains React components. These should be focused on presentation and user interaction for this specific feature.Example: LoginForm.tsx, LogoutButton.tsx.model/ (Segment): Contains the "Brain" of the slice. This includes custom hooks, state management (Zustand/Context), Zod schemas, and business logic functions.Example: useLogin.ts, authSchema.ts, authStore.ts.api/ (Segment): Defines data fetching logic or message passing specific to this slice.Example: authRequests.ts (wrappers for messenger.sendMessage('login',...)).lib/ (Segment): Helper functions specific to this slice that aren't generic enough for Shared.Example: passwordValidator.ts.index.ts (The Public API): This file is mandatory. It exports only what is necessary for the rest of the app to use. It acts as a firewall, encapsulating internal implementation details.83.3 The Public API RuleThe integrity of FSD relies on the Public API. External modules must never import from the internal segments of a slice.✅ Allowed: import { LoginForm } from '@/features/authentication';❌ Forbidden: import { LoginForm } from '@/features/authentication/ui/LoginForm';This rule ensures that refactoring the internal structure of the authentication feature (e.g., renaming LoginForm.tsx to SignInComponent.tsx) does not break consuming code in Widgets or Pages. We will enforce this via ESLint (see Section 7).4. WXT-Specific Implementation PatternsWXT provides the build environment that hosting our FSD architecture. However, WXT has specific opinions about entry points that we must respect and integrate.4.1 Entrypoints: The Composition RootIn strict FSD, the "App" layer usually bootstraps the application. In WXT, we have multiple bootstraps—one for the Popup, one for the Background, one for Content Scripts, etc. We treat the src/entrypoints/ directory as a set of Composition Roots. Logic here should be minimal, focused solely on initializing the React tree and injecting global providers.15Standard Popup Entrypoint (src/entrypoints/popup/main.tsx):TypeScriptimport React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@/app/providers'; // Global providers (Query, Theme)
import { PopupPage } from '@/pages/popup';     // Import from Pages layer
import '@/app/styles/global.css';              // Tailwind imports

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <PopupPage />
    </AppProvider>
  </React.StrictMode>
);
This pattern decouples the PopupPage component from the WXT entry point. This makes it possible to render PopupPage in a Storybook or unit test environment without the full WXT context.4.2 Background Script ArchitectureThe background script (src/entrypoints/background.ts) operates in a Service Worker context (Manifest V3). It is event-driven and ephemeral. It acts as the central Event Bus and Orchestrator for the extension.19SOP for Background Scripts:No UI Code: Never import React components or UI-related libraries into the background script.Event Listeners: Register all listeners (chrome.runtime.onMessage, chrome.tabs.onUpdated) synchronously at the top level.Delegation: Delegate actual business logic to features or entities. The background script should act as a router, dispatching events to the appropriate handlers defined in the slices.TypeScript// src/entrypoints/background.ts
import { defineBackground } from 'wxt/sandbox';
import { setupAuthListeners } from '@/features/auth/model/background-listener';
import { setupNavigationListeners } from '@/features/navigation/model/background-listener';

export default defineBackground(() => {
  // Initialize Feature Listeners
  setupAuthListeners();
  setupNavigationListeners();

  console.log('CTRL Background Service Worker Initialized');
});
4.3 Content Scripts and Shadow DOMContent scripts (src/entrypoints/content.ts) inject UI into third-party pages. To prevent CSS conflicts (host page styles breaking extension UI, or vice versa), we strictly use Shadow DOM via WXT's createShadowRootUi.21SOP for Content Injection:Isolation: Always use createShadowRootUi.Tailwind Integration: Tailwind CSS must be injected inside the Shadow Root. WXT handles this if the CSS file is imported in the entrypoint, but we must ensure the style block is appended to the Shadow Root, not the document head.22Mounting: The content script should mount a Widget or Feature from the FSD layers.TypeScript// src/entrypoints/content.tsx
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@/app/providers';
import { OverlayWidget } from '@/widgets/overlay';
import '@/app/styles/global.css'; 

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui', // Injects imported CSS into the Shadow Root
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'ctrl-overlay',
      position: 'inline',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(
          <AppProvider>
            <OverlayWidget />
          </AppProvider>
        );
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
5. State Management and Data PersistenceExtensions require a nuanced approach to state because the "backend" (Service Worker) can sleep, and the "frontend" (Popup) is destroyed when closed. We categorize state into three buckets: Persistent, Server, and Ephemeral.5.1 Persistent Extension State (chrome.storage)We utilize @wxt-dev/storage to interact with the WebExtension Storage API. This provides a typed wrapper around chrome.storage.local and chrome.storage.sync.7SOP:Definition: Define storage items in the model segment of the relevant Entity.Versioning: Use the versioning feature of @wxt-dev/storage to handle schema migrations as the extension evolves.Naming: Use namespaced keys to prevent collisions (e.g., local:user-settings, sync:preferences).TypeScript// src/entities/settings/model/storage.ts
import { storage } from 'wxt/storage';

export interface AppSettings {
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
}

export const settingsStorage = storage.defineItem<AppSettings>('local:settings', {
  defaultValue: { theme: 'light', notificationsEnabled: true },
  version: 1,
});
5.2 Server State (TanStack Query)For data fetched from external APIs, we use TanStack Query (React Query). Crucially, we must ensure that cached data persists between Popup opens. If we don't, the user will see loading spinners every time they click the extension icon.24The Persister Pattern:We employ the persistQueryClient plugin with a custom storage adapter. This saves the query cache to localStorage (or chrome.storage.local) so that it survives the popup closing.25Configuration (src/app/providers/QueryProvider.tsx):TypeScriptimport { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,    // 5 minutes
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister: localStoragePersister,
});

export const AppQueryProvider = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
5.3 Client State (Zustand)For global UI state that is not persisted (e.g., "is the sidebar open?", "current modal step"), we use Zustand. It is preferred over Redux for its minimal boilerplate and smaller bundle size. These stores reside in the model segment of features or entities.6. Messaging and Inter-Context CommunicationCommunication between the isolated contexts (Content Script <-> Background <-> Popup) is a primary source of fragility. Raw usage of chrome.runtime.sendMessage relies on "stringly typed" event names, leading to runtime errors when messages are renamed or payloads change.6.1 Type-Safe Messaging SOPWe mandate the use of a type-safe messaging wrapper. We will use @webext-core/messaging (or a similar typed utility) to define a strict protocol.6Protocol Definition (src/shared/api/messaging.ts):We define a central mapping of all allowed messages, their argument types, and their return types.TypeScriptimport { defineExtensionMessaging } from '@webext-core/messaging';
import { User } from '@/entities/user';

interface ProtocolMap {
  'get-user-profile': (userId: string) => User;
  'logout': () => void;
  'track-event': (event: string, data: Record<string, unknown>) => void;
}

export const messenger = defineExtensionMessaging<ProtocolMap>();
Implementation (Background):The background script implements the handlers. TypeScript ensures the implementation matches the protocol.TypeScript// src/entrypoints/background.ts
messenger.onMessage('get-user-profile', async ({ data }) => {
  return await fetchUserFromApi(data);
});
Usage (UI Component):The UI invokes the message. TypeScript infers the return type automatically.TypeScript// src/features/profile/ui/Profile.tsx
const user = await messenger.sendMessage('get-user-profile', '123');
// user is typed as User automatically
6.2 The Proxy Service PatternFor complex logic, we can treat the Background Script as a "Server" and the UI as a "Client." By using a Proxy Service, we can call functions in the UI that transparently execute in the background context. This is useful for logic that requires persistent variables or access to APIs only available in the background (like chrome.alarms or specialized network requests).67. Tooling, Linting, and Code QualityArchitecture is only effective if enforced. We utilize ESLint and strict TypeScript configuration to automate adherence to the SOP.7.1 Strict TypeScript ConfigurationThe tsconfig.json must enforce strict typing to prevent the "any" type from creeping into the codebase, which undermines the safety of our messaging and storage patterns.9Key tsconfig.json Settings:"strict": true: Enables all strict type checking options."noImplicitAny": true: Raises error on implied any."baseUrl": ".": Sets root for paths."paths": { "@/*": ["src/*"] }: Enables the path alias for strict FSD imports.287.2 Enforcing Boundaries with ESLintWe use eslint-plugin-boundaries to strictly enforce the FSD dependency rules. This plugin analyzes imports and fails the build if a Shared module tries to import a Feature, or if a Feature tries to import a sibling Feature (if strictly enforced).29ESLint Config (eslint.config.js):JavaScriptimport boundaries from "eslint-plugin-boundaries";

export default [
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "pages", pattern: "src/pages" },
        { type: "widgets", pattern: "src/widgets" },
        { type: "features", pattern: "src/features" },
        { type: "entities", pattern: "src/entities" },
        { type: "shared", pattern: "src/shared" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "app", allow: ["pages", "widgets", "features", "entities", "shared"] },
            { from: "pages", allow: ["widgets", "features", "entities", "shared"] },
            { from: "widgets", allow: ["features", "entities", "shared"] },
            { from: "features", allow: ["entities", "shared"] },
            { from: "entities", allow: ["shared"] },
            { from: "shared", allow: }, // Shared can only import external libs
          ],
        },
      ],
    },
  },
];
This configuration transforms architectural rules from "conventions" into "constraints."7.3 Naming ConventionsStrict naming aids AI navigation and developer consistency.31ElementConventionExampleDirectorieskebab-caseauth-login, user-profileReact ComponentsPascalCaseLoginForm.tsx, PageLayout.tsxHookscamelCase (prefix 'use')useAuth.ts, useWindowSize.tsUtilitiescamelCaseformatDate.ts, apiClient.tsTypes/InterfacesPascalCaseUser, AuthResponseConstantsUPPER_SNAKE_CASEAPI_BASE_URL, MAX_RETRIES8. Documentation and Research ManagementThe project includes a research/ folder. Managing knowledge is as critical as managing code. We adopt Architecture Decision Records (ADRs) to formalize the transition from "Research" to "Implementation."8.1 The Documentation WorkflowResearch Phase: Active exploration happens in research/docs. This is for specs, competitor analysis, and rough notes.Decision Phase: When a research item informs a structural change (e.g., "We will use Zustand instead of Redux"), an ADR is created in docs/decisions/ using the MADR Markdown template.13Archive Phase: Once the decision is made and implemented, the raw research documents are moved to research/archive/ to keep the active folder clean.8.2 ADR Template StructureWe use the MADR template because it is machine-readable and standardizes the "Why" behind decisions.Template (docs/decisions/0000-template.md):Title: Short, imperative (e.g., "Use Feature-Sliced Design").Context: What is the problem? Why is the current solution insufficient?Decision: The specific technology or pattern chosen.Consequences: What becomes easier? What becomes harder (trade-offs)?9. Migration StrategyMoving from the current unstructured state to this SOP requires a phased approach to avoid halting development.Phase 1: Infrastructure & GroupingMove Source: Execute the move of assets, entrypoints, and public into extension/src/. Update wxt.config.ts.Configure Tools: Install eslint-plugin-boundaries and update tsconfig.json with path aliases (@/).Group Existing Code: Don't rewrite yet. Just move existing components into src/shared/ui (if generic) or src/features/legacy (if specific). This gets files into the right folders without requiring code changes.Phase 2: Layer ExtractionIdentify Entities: Look at your types. Do you have a User type? Create src/entities/user. Move the type and any related validators there.Identify Features: Look at your "pages". Are there distinct logical blocks (e.g., a form to update settings)? Extract that into src/features/update-settings.Phase 3: Strict EnforcementEnable ESLint Rules: Turn on the boundary checks.Refactor Circular Dependencies: The linter will light up with errors. Systematically resolve them by moving shared logic down to Entities or Shared.10. ConclusionThis SOP represents a maturation of the CTRL project from a prototype to a scalable engineering artifact. By embracing WXT for the build pipeline and Feature-Sliced Design for internal organization, we ensure that the codebase can withstand increasing complexity. The strict file hierarchy, coupled with automated enforcement via ESLint and TypeScript, provides a guardrail that keeps the architecture clean. This structure is explicitly designed to be navigable by AI agents, allowing for future automation of refactoring and code generation tasks. The immediate next step is to initialize the docs/decisions directory and ratify this document as the first Architectural Decision Record.
