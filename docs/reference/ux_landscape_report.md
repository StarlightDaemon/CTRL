<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Modern Web Extension UX/UI Landscape 2025

### CTRL – Torrent Management Extension


***

## 1. Aesthetic Design Trends (2025)

### 1.1 “Modern Linux” / Libadwaita / KDE Plasma

**Visual DNA**

- High-contrast, mostly solid surfaces
- Clear separations: 1px borders, subtle elevation, not “card soup”
- Tight, information-dense layouts that still feel breathable
- Strong system integration: respects system accent, prefers neutral backgrounds
- Iconography: symbolic, minimal, monochrome with accent tints

**Pros (for CTRL)**

- Excellent legibility at high data density (torrent tables, logs)
- Fits your user base (Linux/seedbox/homelab crowd) emotionally
- Easy to maintain; avoids trend-rot compared to glassmorphism
- Works well in constrained popup UIs and full-page dashboards
- Easy to match OS/window-manager feel (KDE/Breeze, Libadwaita, etc.)

**Cons**

- Can look “plain” or “GTK demo app” if typography, spacing, and color aren’t carefully tuned.
- Risk of looking like generic settings dialogs rather than a “flagship” tool.

**How to Make It Premium (Not Basic)**

Key is *detail work*:

1. **Micro-elevation and layers**
    - Use 2–3 elevation tiers max: background, surface, “primary panel”.
    - Example:

```css
:root {
  --bg: #05060a;
  --surface: #0c0f16;
  --surface-raised: #111623;
  --border-subtle: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.16);
  --accent: #4fd1c5;
  --accent-soft: rgba(79,209,197,0.16);
  --radius-sm: 6px;
  --radius-md: 10px;
}

.surface {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.surface--primary {
  background: radial-gradient(circle at top left, #151826, #080a11);
  border: 1px solid var(--border-strong);
  box-shadow: 0 18px 45px rgba(0,0,0,0.65);
}
```

2. **VL-weighted typography**
    - Use a “functional” set:
        - UI: `system-ui, Inter, Geist, SF Pro Text`
        - Code/monospace: `JetBrains Mono, Fira Code`
    - Tighten line-height and tracking for “power tool” feel:

```css
.label-xs {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}

.headline {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

3. **Accent as function, not decoration**
    - Use accent only for:
        - Primary action
        - Selected row / active filter chip
        - Critical states (with hue shifts)
    - Avoid large accent backgrounds; keep most surfaces neutral/dark.
4. **KDE/Libadwaita touches**
    - Rounded but not pill-heavy corners (`6–10px`).
    - Split views with draggable divider for settings vs torrent list.
    - Simple iconography (symbolic icons, ~16px, monochrome + accent stroke).

**Suitability for CTRL:**
Ideal as your **baseline theme** for power users. Feels native on Linux, still premium if typography, spacing, and border/elevation work are polished.

***

### 1.2 Glassmorphism 2.0 / Arc / Windows 11 Mica

**Modern Interpretation (2025)**

- Not heavy blur blobs everywhere; instead:
    - Subtle, low-radius blur on top-level panel
    - Tinting with underlying wallpaper/accent
    - Strong contrast-preserving overlays (scrim layers)
- Linear and others now combine dark linear layouts with *selective* frosted elements instead of full glass UIs.

**Pros**

- Instantly “premium” and emotional.
- Great for marketing-like views: new tab replacement, hero surfaces, “Now Playing”, “Active torrent overview”.
- Helps distinguish layers without thick borders.

**Cons**

- Performance hit in extension popups on weaker hardware.
- Risk of low contrast on busy backgrounds (especially inside page content).
- Harder to maintain consistent feel in content scripts where host page backgrounds vary.

**Implementation Principles for CTRL**

1. **Use glass only on “frame” surfaces**
    - Example: popup root or pinned dashboard panel, not inside every sub-card.
    - Use a tone-mapped, opaque panel behind heavy data tables.
2. **Guard rails for readability**
    - Always add a color overlay over blur:

```css
[data-theme='glass'] .shell {
  background:
    radial-gradient(circle at top left, rgba(79,209,197,0.08), transparent 60%),
    linear-gradient(to bottom right, rgba(6,10,18,0.9), rgba(2,4,9,0.9));
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255,255,255,0.08);
}
```

3. **Performance mode toggle**
    - Detect `prefers-reduced-transparency` when possible, and add an in-app switch “Reduce visual effects” → falls back to solid theme (no `backdrop-filter`).
4. **Avoid glass in content scripts**
    - In tracker overlays, stick to solid/dimmed surfaces; glass there becomes unreadable vs site backgrounds.

**Suitability for CTRL:**
Use as a **“premium toggle”** for dashboard / pinned views, *not* as your default everywhere. Great for “CTRL Pro / Neon” theme or “Glass overlay” mode.

***

### 1.3 “Linear-like” / Neobrutalism / Power User (Linear, Vercel, Raycast)

**Characteristics** (2025 view [source: Linear design analyses, Raycast patterns])

- Dark surfaces, faint hairline borders, sparse but strong accent colors.
- Layouts are simple, direct, and highly keyboard-driven.
- Dense but well-structured tables and lists.
- High reliance on command palettes and search, minimal nested menus.

**Pros**

- Perfect fit for CTRL’s power user audience.
- Excellent for dense data, keyboard shortcuts, multi-client control.
- Aesthetically aligned with developer tools and modern SaaS.

**Cons**

- Trend oversaturation – many apps now look same-y.
- If overdone, can feel “generic SaaS template” rather than unique.

**How To Make It “Yours”**

1. **Adopt the *system*, not the skin**
    - Use:
        - Single dominant accent color family (e.g. teal).
        - Hairline borders (1px, low-opacity).
        - Dark neutral background, often almost black with subtle gradients.
        - Bold section headings with small caps labels above.
2. **Introduce brand idiosyncrasies**
    - A signature **torrent status strip** style (mini sparklines, ratio tags).
    - Unique torrent “badge” design (compact inline tags with subtle background).
    - Distinctive keyboard hint style (`⌘K` chips, `Ctrl+T` badges).
3. **Micro-details in interaction**
    - Subtle scale/opacity hover on rows.
    - Focus rings that are crisp and visible but not huge.
    - Micro-animations on state transitions (Downloading → Completed).

**Example Table Row (CSS Skeleton)**

```css
.torrent-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 80px 80px 70px 90px 80px 32px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: background 120ms ease-out, border-color 120ms ease-out;
}

.torrent-row:hover {
  background: rgba(255,255,255,0.02);
  border-color: rgba(255,255,255,0.06);
}

.torrent-row--active {
  background: rgba(79,209,197,0.08);
  border-color: rgba(79,209,197,0.35);
}
```

**Suitability for CTRL:**
This should be your **core interaction style** for lists, tables, filters, and command palette, across all themes.

***

### 1.4 Bento Grid Layouts (Dashboards)

**Use Cases in CTRL**

- Top-level “CTRL Dashboard” page with:
    - Current client overview(s)
    - Recent torrents
    - Transfer graph
    - Error/failed items
    - Tracker health / integration status

**Best Practices**

- Keep card count small (6–8 max on default view).
- Cards are functional, not decorative:
    - Each card has a clear primary action or key metric.
- Group by mental model:
    - “Now” (current activity)
    - “Capacity” (disk, bandwidth)
    - “Quality / Health” (errors, stalled, tracker status)
    - “Automation” (watch folders, RSS, categories)

**Layout Skeleton**

```tsx
// React
<section className="bento-grid">
  <Card span="2x1">Now Playing / Active Torrents</Card>
  <Card span="1x1">Transfer Speeds</Card>
  <Card span="1x2">Queue / Upcoming</Card>
  <Card span="1x1">Errors & Warnings</Card>
  <Card span="2x1">Client Summary</Card>
</section>
```

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 120px;
  gap: 10px;
}

.card {
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  padding: 10px 12px;
}

.card--span-2x1 { grid-column: span 8; grid-row: span 2; }
.card--span-1x1 { grid-column: span 4; grid-row: span 2; }
.card--span-1x2 { grid-column: span 4; grid-row: span 4; }
```

**Suitability for CTRL:**
Excellent for the options page / full dashboard. Not appropriate inside a tiny popup but perfect for your “world class” management view.

***

## 2. Best-in-Class Extension / App References

### 2.1 Raindrop.io (Collections Management)

Patterns to copy:

- **2-pane layout**: Sidebar (folders/tags) + main list grid.
- **Contextual detail pane**: Clicking item reveals detail without full navigation.
- **Search \& filter first**: Large, always-visible search with smart filters.
- **Batch operations**: Multi-select, bulk actions with a compact toolbar.

For CTRL:

- Left: Torrent client(s) \& categories/tags.
- Center: Torrent list.
- Right (optional): Details: file list, peers, tracker info.


### 2.2 Raycast

Patterns:

- **Command palette as primary entry point** (Ctrl+K / Alt+K):
    - Actions as first-class citizens.
    - Consistent hotkey hints everywhere.
- **Flat list with icons** and small descriptive subtitles.
- **Quick previews** (e.g. details pane on right).

For CTRL:

- Global command palette:
    - “Add torrent from URL”
    - “Pause all”
    - “Move selected to category…”
    - “Switch client to Transmission@NAS”
- Palette accessible from:
    - Popup (Ctrl+K)
    - Options page (Ctrl+K)
    - Tracker overlays (limited command subset).


### 2.3 Momentum / Arc

Patterns:

- High-emotion / minimal UI for the new tab.
- Strong typography, background imagery or gradients.
- Subtle widgets (time, quick actions).

For CTRL:

- If you ever do a “torrent dashboard new tab”:
    - Hero: “Now transferring: X torrents” + main speed graph.
    - Minimalist; no config sprawl.


### 2.4 Ghostery / AdGuard

Patterns:

- Complex settings structured with:
    - Left nav sections
    - Right sub-pages with grouped controls
    - Strong use of toggles and contextual help
- Clear safe defaults, and “Advanced” expandable sections.

For CTRL:

- Options page “Settings”:
    - Group into 5–7 primary sections (Clients, Trackers, UI, Automation, Security, Advanced).
    - Secondary groups with headings and inline help per setting.

***

## 3. UX Patterns for Complex Extensions

### 3.1 Deep Settings Hierarchies (50+ Settings)

**Approach**

1. **Search-first settings UX**
    - Global “Search settings” input at top.
    - Fuzzy search by label, description, and tags.
2. **Split-pane layout**
    - Left: High-level categories.
    - Right: Scrollable content with anchor-based sub-sections.
3. **Progressive disclosure**
    - Basic vs Advanced groups:
        - Default: show safe/basic.
        - Advanced: collapsed, labeled clearly.
4. **Pattern Example (Structure)**
```tsx
// Settings layout
<SettingsShell>
  <SettingsSidebar>
    <NavItem icon="client" label="Clients" />
    <NavItem icon="tracker" label="Trackers" />
    <NavItem icon="ui" label="Interface" />
    <NavItem icon="automation" label="Automation" />
    <NavItem icon="security" label="Security" />
    <NavItem icon="advanced" label="Advanced" />
  </SettingsSidebar>
  <SettingsContent>
    <SettingsSearch />
    <SettingsSection id="clients">
      <SettingsGroup title="Client Connections" description="Manage your torrent clients">
        {/* controls */}
      </SettingsGroup>
      <SettingsGroup title="Connection Defaults" variant="advanced">
        {/* advanced controls */}
      </SettingsGroup>
    </SettingsSection>
  </SettingsContent>
</SettingsShell>
```


### 3.2 Data Density: Torrents List

**Recommended Default: Compact table-like list (not full data-grid, not cards)**

- Use “pseudo-table” with CSS grid (easier in React + responsive).
- Columns:
    - Name (main, truncated with tooltip on hover)
    - Size
    - Progress (bar + percentage)
    - Download / Upload speed
    - Peers
    - ETA
    - Status (icon + label)
- Optional: Expandable row for files/trackers.

**Row Structure Example**

```tsx
<div className="torrent-row torrent-row--downloading">
  <div className="torrent-row__name">
    <span className="name">Dune Audiobook - Part 1</span>
    <div className="meta">
      <span className="tag">audiobook</span>
      <span className="tag">ctrl@nas</span>
    </div>
  </div>
  <div className="torrent-row__size">1.4 GB</div>
  <div className="torrent-row__progress">
    <div className="progress-bar">
      <div className="progress-bar__fill" style={{ width: '63%' }} />
    </div>
    <span className="progress-label">63%</span>
  </div>
  <div className="torrent-row__speed">4.2 MB/s</div>
  <div className="torrent-row__peers">12 (24)</div>
  <div className="torrent-row__eta">18m</div>
  <div className="torrent-row__status">
    <StatusPill variant="downloading">Downloading</StatusPill>
  </div>
</div>
```


### 3.3 Navigation: Popup vs Options Page

**Popup (Quick Control)**

- Single-column layout with:
    - Header: client selector + global state (total speeds).
    - Middle: 5–10 most recent/active torrents.
    - Footer:
        - “View Full Dashboard” link
        - `Ctrl+K` hint to open command palette
- Avoid deep navigation; rely on:
    - Quick filters (All / Active / Completed / Errors).
    - Inline actions: pause/resume, prioritize, open in client.

**Options / Dashboard Page**

- Full SPA layout:
    - Top bar: search, client switcher, global actions.
    - Left sidebar: navigation (Dashboard / Torrents / Settings / Logs).
    - Main: bento dashboard + detailed views.

**Command Palette**

- Consistent global entry (Ctrl+K).
- Categories: Actions, Torrents, Clients, Settings.
- Fuzzy search across:
    - torrent names
    - client labels
    - actions
    - settings


### 3.4 Interactive States \& Micro-Animations

**State communication**

- **Downloading**:
    - Progress bar with slow, continuous “indeterminate shimmer” overlay.
    - Speed text in accent color.
- **Paused**:
    - Progress bar static, muted color.
    - Status pill “Paused” in neutral gray.
- **Error**:
    - Row gets subtle red left border.
    - Status pill “Error” with icon, small shake animation on first appearance.
- **Completed/Seeding**:
    - Status pill “Seeding” in soft green.
    - Optional celebratory pulse on completion threshold.

**Implementation Example (CSS)**

```css
@keyframes progressShimmer {
  0% { background-position: -40px 0; }
  100% { background-position: 40px 0; }
}

.progress-bar__fill--active {
  background-image: linear-gradient(
    90deg,
    rgba(255,255,255,0.08) 25%,
    rgba(255,255,255,0.18) 50%,
    rgba(255,255,255,0.08) 75%
  );
  background-size: 40px 100%;
  animation: progressShimmer 900ms linear infinite;
}

@keyframes errorShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-1px); }
  40% { transform: translateX(1px); }
  60% { transform: translateX(-0.5px); }
  80% { transform: translateX(0.5px); }
}

.torrent-row--error {
  border-left: 2px solid rgba(244, 63, 94, 0.9);
}

.torrent-row--error.is-new {
  animation: errorShake 260ms ease-out;
}
```


***

## 4. Technical Implementation \& Architecture

### 4.1 Theming Architecture – Glass vs Solid vs Linear

**Core Principle:** Single design system with theme tokens per variant.

```ts
// theme-tokens.ts
export type ThemeName = 'linux' | 'glass' | 'linear';

export const baseTokens = {
  radiusSm: '6px',
  radiusMd: '10px',
  fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`,
  fontMono: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`,
};

export const themeTokens: Record<ThemeName, Record<string, string>> = {
  linux: {
    '--bg': '#05060a',
    '--surface': '#0b0e15',
    '--surface-raised': '#111623',
    '--border-subtle': 'rgba(255,255,255,0.05)',
    '--border-strong': 'rgba(255,255,255,0.18)',
    '--accent': '#4fd1c5',
    '--accent-soft': 'rgba(79,209,197,0.16)',
    '--blur-strength': '0px',
    '--panel-opacity': '1',
  },
  glass: {
    '--bg': 'transparent',
    '--surface': 'rgba(7,10,18,0.75)',
    '--surface-raised': 'rgba(9,13,23,0.86)',
    '--border-subtle': 'rgba(255,255,255,0.06)',
    '--border-strong': 'rgba(255,255,255,0.22)',
    '--accent': '#4fd1c5',
    '--accent-soft': 'rgba(79,209,197,0.22)',
    '--blur-strength': '18px',
    '--panel-opacity': '0.9',
  },
  linear: {
    '--bg': '#02040a',
    '--surface': '#050711',
    '--surface-raised': '#080b16',
    '--border-subtle': 'rgba(255,255,255,0.04)',
    '--border-strong': 'rgba(255,255,255,0.14)',
    '--accent': '#7c5cff',
    '--accent-soft': 'rgba(124,92,255,0.18)',
    '--blur-strength': '0px',
    '--panel-opacity': '1',
  },
};
```

**React provider:**

```tsx
export const ThemeProvider: React.FC<{ theme: ThemeName }> = ({ theme, children }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    const tokens = themeTokens[theme];
    Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [theme]);
  return <>{children}</>;
};
```

**CSS usage:**

```css
.shell {
  background-color: var(--bg);
  font-family: var(--font-family, system-ui, sans-serif);
}

.panel {
  background-color: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--blur-strength));
  -webkit-backdrop-filter: blur(var(--blur-strength));
}
```

Switching between aesthetics is now just toggling `ThemeProvider` and a persistent preference.

### 4.2 Shadow DOM Consistency for Content Scripts

**Challenges**

- Need consistent theme for overlays inside trackers.
- Must avoid leaking Ctrl styles into page.
- Must support dark/light backgrounds of host sites.

**Pattern**

1. **Always use Shadow DOM** for injected UI:
    - Single root `#ctrl-root` element inserted.
    - Attach shadow root: `mode: 'open'`.
    - Inject compiled CSS (or CSS variables + base styles) into shadow root.
2. **Pass theme as data attribute + CSS variables**:
    - Use shared theme tokens from extension core (injected via messaging or storage).
    - On injection, set `data-theme` attribute on shadow root host.
3. **Avoid global selectors**:
    - All styles scoped to `.shell`, `.panel`, etc., inside Shadow DOM.

**Pseudo-code**

```ts
function injectOverlay(theme: ThemeName) {
  const host = document.createElement('div');
  host.id = 'ctrl-root';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = CSS_BUNDLE_STRING; // from built CSS
  shadow.appendChild(style);

  const appContainer = document.createElement('div');
  appContainer.className = 'ctrl-shell';
  appContainer.setAttribute('data-theme', theme);

  shadow.appendChild(appContainer);

  // mount React app into appContainer
  createRoot(appContainer).render(
    <ThemeProvider theme={theme}>
      <OverlayApp />
    </ThemeProvider>
  );
}
```

**Result:**
Dashboard and overlays share a design system while remaining isolated from tracker CSS.

### 4.3 Animation – Framer Motion vs CSS Transitions

**Context:** Extension environment, React + TS, want low overhead.

**Recommendation**

- **Default:** CSS transitions for:
    - Hover, focus, color changes, progress bar effects.
- **Framer Motion (or Motion One)** only for:
    - Command palette entrance/exit.
    - Fancy bento card transitions.
    - State-rich views where spring physics matter.

**Rationale**

- Extensions must be lightweight; extra runtime libs should be justified.
- CSS is perfectly adequate for 90% of micro-interaction needs.

**Example: Command Palette (Framer Motion)**

```tsx
import { motion, AnimatePresence } from 'framer-motion';

const CommandPalette = ({ open, onClose }: Props) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="cmd-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="cmd-panel"
          initial={{ y: 12, opacity: 0.6, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 8, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {/* content */}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
```


### 4.4 Typography: Modern Functional UI

**Recommended Stack for CTRL**

- **Primary UI font:**
    - `Geist Sans` or `Inter` (fallback to system)
- **Monospace:**
    - `JetBrains Mono` for speeds, ports, code fields.

```css
:root {
  --font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

body {
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.4;
}

.code, .metric-mono {
  font-family: var(--font-mono);
  font-feature-settings: "calt" 0, "liga" 0; /* optional for crisp digits */
}
```


***

## 5. Menu of Options – Style Comparison

| Style | Visual Traits | UX Strengths | UX Risks / Cons | Where to Use in CTRL |
| :-- | :-- | :-- | :-- | :-- |
| **Linux / KDE** | Solid surfaces, clear borders, system-tuned colors | Legible, fast, “native” feel for power users | Can feel basic if not polished | Default theme, popup, options/settings |
| **Glass 2.0** | Frosted panels, depth, subtle gradients | Premium, emotional, good for high-level overview | Perf hit, readability on noisy backgrounds | Dashboard shell, optional “Neon/Glass” mode |
| **Linear-like** | Dark neutral bg, hairline borders, strong accent, bold labels | Perfect for tables, keyboard-centric workflows | Risk of generic SaaS look | Primary list/table layout, command palette |
| **Bento** | Modular cards in grid, each with focused function | Quick scanning of system state, flexible layouts | Can become dashboard clutter | Dashboard/home in options page; not for popup |


***

## 6. Proposed CTRL Design System

### 6.1 High-Level Strategy

- **Base**: Linear-like power tool interaction model.
- **Theme Variants**:
    - `linux` (default, solid, KDE-ish).
    - `glass` (frosted, premium shell).
    - `linear` (alt accent/brand colors).
- Shared:
    - Typography
    - Layout primitives
    - Components (rows, cards, command palette)


### 6.2 Core Components

- **Layout**
    - `Shell`, `Sidebar`, `TopBar`, `Pane`, `BentoGrid`
- **Data**
    - `TorrentRow`, `TorrentStatusPill`, `MetricChip`, `ProgressBar`
- **Navigation**
    - `CommandPalette`, `Tabs`, `Breadcrumb`, `SectionNav`
- **Settings**
    - `SettingsShell`, `SettingsSidebar`, `SettingsGroup`, `SettingsControl`
- **Feedback**
    - `Toast`, `InlineAlert`, `EmptyState`


### 6.3 Example: TorrentRow Component Structure (React)

```tsx
interface TorrentRowProps {
  name: string;
  size: string;
  progress: number;
  downSpeed: string;
  upSpeed: string;
  peers: string;
  eta: string;
  status: 'downloading' | 'paused' | 'error' | 'seeding';
  isSelected?: boolean;
}

export const TorrentRow: React.FC<TorrentRowProps> = (props) => {
  const { name, size, progress, downSpeed, peers, eta, status, isSelected } = props;

  return (
    <div
      className={[
        'torrent-row',
        `torrent-row--${status}`,
        isSelected && 'torrent-row--selected',
      ].filter(Boolean).join(' ')}
    >
      <div className="torrent-row__name">
        <div className="name" title={name}>{name}</div>
        <div className="meta">
          <span className="meta-item">{size}</span>
        </div>
      </div>
      <div className="torrent-row__progress">
        <div className="progress-bar">
          <div
            className={['progress-bar__fill', status === 'downloading' && 'progress-bar__fill--active']
              .filter(Boolean)
              .join(' ')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-label">{progress}%</span>
      </div>
      <div className="torrent-row__down">{downSpeed}</div>
      <div className="torrent-row__peers">{peers}</div>
      <div className="torrent-row__eta">{eta}</div>
      <div className="torrent-row__status">
        <StatusPill status={status} />
      </div>
    </div>
  );
};
```


***

## 7. Concrete Recommendation for CTRL

1. **Default look:**
    - “Modern Linux / Linear hybrid”:
        - Solid surfaces, high contrast.
        - Hairline borders, compact spacing.
        - Geist/Inter + JetBrains Mono.
2. **Optional “Neon” / Glass mode:**
    - Shell uses glassmorphism 2.0.
    - Interior data tables remain mostly solid for performance and clarity.
3. **Information architecture:**
    - Popup = quick control (10 recent torrents, simple filters, command palette).
    - Options = SPA dashboard:
        - Bento top section (system overview).
        - Main “Torrents” table view.
        - Rich “Settings” in split-pane with searchable settings.
4. **Interaction model:**
    - Keyboard-centric:
        - Global `Ctrl+K` → command palette.
        - `J/K` navigation or arrow key support in lists.
    - Micro-animations for state change, but no heavy continuous animations.
5. **Technical stack alignment:**
    - React 18 + TS (as you already use).
    - CSS Modules or CSS-in-JS with extracted static CSS for extension.
    - Theme via data attributes + CSS variables, applied in popup, options, and Shadow DOM overlays.
    - CSS transitions by default; Framer Motion only where justified.

If you’d like, next step I can do is design a **fully-specified theme token file + example popup layout** tailored to your exact CTRL panels (clients, trackers, torrents, logs) so you can drop it into your React/TS extension.
<span style="display:none">[^1_1][^1_10][^1_2][^1_3][^1_4][^1_5][^1_6][^1_7][^1_8][^1_9]</span>

<div align="center">⁂</div>

[^1_1]: https://blog.logrocket.com/ux-design/linear-design/

[^1_2]: https://www.figma.com/community/file/1367387900890415538/raycast-com-web-pages-ui

[^1_3]: https://community.kde.org/Plasma/Plasma_6

[^1_4]: https://everhour.com/blog/what-is-linear-app/

[^1_5]: https://www.raycast.com/store/category/design-tools

[^1_6]: https://discuss.kde.org/t/theming-libadwaita-in-kde/34963

[^1_7]: https://linear.app/changelog/2025-10-16-mobile-app-redesign

[^1_8]: https://apps.apple.com/us/app/raycast-ai-notes-and-more/id6503428327

[^1_9]: https://forum.zorin.com/t/how-much-libadwaita-has-removed/50705

[^1_10]: https://linear.app/now/linear-liquid-glass

