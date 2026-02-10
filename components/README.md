# AveryOS Dynamic Navigation System

This directory contains the dynamic navigation components for the AveryOS Sovereign Runtime.

## Components

### NavBar.tsx
Classic horizontal navigation bar with icons. Displays at the top of the page on desktop and is hidden on mobile.

**Features:**
- Horizontal layout with brand logo
- Icon + label for each navigation item
- Responsive hover effects
- Sticky positioning

### Sidebar.tsx
Collapsible sidebar navigation for desktop layouts. Can be toggled open/closed.

**Features:**
- Vertical layout with brand at top
- Collapsible (shows only icons when closed)
- Toggle button to expand/collapse
- Fixed positioning on left side

### Drawer.tsx
Mobile drawer navigation that slides in from the left.

**Features:**
- Hidden by default, opens with hamburger button
- Backdrop overlay when open
- Slides in from left with smooth animation
- Auto-closes when clicking a link or backdrop

### SidebarLayout.tsx
Alternative layout component using Sidebar instead of NavBar.

**Usage:**
To use the sidebar layout instead of the top navigation bar, modify `pages/_app.tsx`:

```tsx
import SidebarLayout from "../components/SidebarLayout";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <SidebarLayout>
      <Component {...pageProps} />
    </SidebarLayout>
  );
};
```

## Route Configuration

All navigation routes are centrally defined in `lib/navigationRoutes.ts`:

```typescript
export type NavigationRoute = {
  path: string;
  label: string;
  icon: string;
};

export const navigationRoutes: NavigationRoute[] = [
  { path: "/start", label: "Start", icon: "🚀" },
  { path: "/buy", label: "Buy", icon: "💳" },
  // ... more routes
];
```

To add or modify navigation items, edit this single file. All navigation components will automatically update.

## Responsive Behavior

- **Mobile (< 768px):** Shows drawer toggle button (☰), hides navbar and sidebar
- **Desktop (≥ 769px):** Shows navbar by default, hides drawer toggle

## Styling

Navigation styles are defined in `styles/globals.css` with classes prefixed by component name:
- `.navbar-*` - NavBar styles
- `.sidebar-*` - Sidebar styles  
- `.drawer-*` - Drawer styles

All components use the same color scheme and design language as the rest of the site.

## Adding New Pages

1. Create the page in `pages/` directory
2. Add route definition to `lib/navigationRoutes.ts`
3. Navigation components will automatically include the new page

Example:
```typescript
{ path: "/new-page", label: "New Page", icon: "✨" }
```
