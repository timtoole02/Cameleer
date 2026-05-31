# Cameleer Design System

This document outlines the core tokens and components for the Cameleer Apple-class workspace.

## Philosophy
- **Clarity**: Uncluttered interfaces, obvious actions.
- **Depth**: Subtle shadows and layering to indicate hierarchy, not neon gradients.
- **Deference**: The UI should get out of the way of the content.
- **Calmness**: Neutral surfaces with purposeful accents.

## Tokens (`tokens.css`)

### Typography
- Primary Font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`
- Monospace Font: `"SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace`

### Color Palette (Dark Mode First)
- **Background Main**: `#1c1c1e` (Apple System Background)
- **Background Secondary**: `#2c2c2e` (Sidebar, Inspector)
- **Background Tertiary**: `#3a3a3c` (Cards, Modals, Hover States)
- **Text Primary**: `#ffffff`
- **Text Secondary (Muted)**: `#8e8e93`
- **Accent Color**: `#0a84ff` (Apple Blue)
- **Success**: `#30d158` (Apple Green)
- **Warning**: `#ffd60a` (Apple Yellow)
- **Danger**: `#ff453a` (Apple Red)
- **Border Default**: `rgba(255, 255, 255, 0.1)`
- **Focus Ring**: `rgba(10, 132, 255, 0.5)`

### Spacing Scale
- `--space-xs`: `4px`
- `--space-sm`: `8px`
- `--space-md`: `16px`
- `--space-lg`: `24px`
- `--space-xl`: `32px`

### Radius Scale
- `--radius-sm`: `4px`
- `--radius-md`: `8px`
- `--radius-lg`: `12px`

### Shadows
- `--shadow-sm`: `0 1px 3px rgba(0,0,0,0.3)`
- `--shadow-md`: `0 4px 6px rgba(0,0,0,0.4)`
- `--shadow-lg`: `0 10px 15px rgba(0,0,0,0.5)`

## Components (`components.css`)
- `.app-shell`: Grid layout for sidebar, main, inspector, and toolbar.
- `.card`: A native-feeling card with subtle border and shadow.
- `.button`: Native feeling buttons (solid, ghost, outline) with active states.
- `.input`: Clean text inputs with a blue focus ring.
- `.toast`: Slide-up notification using accent/success/danger colors.
- `.badge`: Small pill-shaped status indicators.
