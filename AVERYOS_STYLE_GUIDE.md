# AveryOS™ Style Guide — Lighthouse Noir v1

⛓️⚓⛓️  
**Capsule:** `AveryOS_Sovereign_Web_Infrastructure_v1.0.aoscap`  
**Status:** ACTIVE PROTOCOL  
**Authority:** Jason Lee Avery / AveryOS™

---

## 1. Design System — Lighthouse Noir v1

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#000814` | Page background |
| `--color-bg-panel` | `rgba(0, 10, 28, 0.88)` | Panel/modal background |
| `--color-bg-card` | `rgba(0, 8, 20, 0.85)` | Card backgrounds |
| `--color-bg-deep` | `rgba(0, 6, 16, 0.95)` | Deep inset backgrounds |
| `--color-gold` | `#FFD700` | Primary accent — headings, borders, highlights |
| `--color-gold-dim` | `rgba(255, 215, 0, 0.75)` | Secondary gold text |
| `--color-gold-subtle` | `rgba(255, 215, 0, 0.35)` | Borders, dividers |
| `--color-gold-ghost` | `rgba(255, 215, 0, 0.15)` | Hover backgrounds, fills |
| `--color-gold-ink` | `rgba(255, 215, 0, 0.9)` | Gold text on dark bg |
| `--color-text` | `#eef4ff` | Primary body text |
| `--color-text-muted` | `rgba(238, 244, 255, 0.75)` | Secondary body text |
| `--color-text-faint` | `rgba(238, 244, 255, 0.5)` | Labels, captions |
| `--color-border` | `rgba(255, 215, 0, 0.3)` | Card/section borders |
| `--color-border-bright` | `rgba(255, 215, 0, 0.65)` | Hover/active borders |
| `--color-dark-text` | `#000814` | Dark text on gold backgrounds |

### Body Background

```css
background: radial-gradient(ellipse at top, #000d24 0%, #000814 70%);
```

---

## 2. Typography

| Context | Font | Size | Weight |
|---------|------|------|--------|
| Body | Inter / Segoe UI / system-ui | 1rem | 400 |
| Headings h1 | Inherit | 2.5rem | 700 |
| Headings h2 | Inherit | 1.4–1.75rem | 700 |
| Headings h3 | Inherit | 1rem–1.2rem | 600–700 |
| Monospace / code | JetBrains Mono, Fira Code | 0.78–0.92rem | 400–500 |
| Labels / kickers | Inherit | 0.7–0.85rem | 400 (uppercase, letter-spacing: 0.08–0.18em) |

---

## 3. Component Standards

### Cards

```css
background: rgba(0, 8, 20, 0.85);
border: 1px solid rgba(255, 215, 0, 0.18);
border-radius: 16px;
padding: 1.5rem 2rem;
```

### Hero Sections

```css
background: linear-gradient(135deg, rgba(20, 15, 0, 0.55), rgba(0, 8, 20, 0.95));
border: 1px solid rgba(255, 215, 0, 0.4);
border-radius: 18px;
padding: 2.5rem;
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 60px rgba(255, 215, 0, 0.04);
```

### Primary Buttons / Links

```css
background: rgba(255, 215, 0, 0.92);
color: #000814;
border-radius: 999px;
padding: 0.75rem 1.5rem;
font-weight: 600;
```

### Secondary Buttons / Links

```css
border: 1px solid rgba(255, 215, 0, 0.55);
color: rgba(255, 215, 0, 0.9);
border-radius: 999px;
padding: 0.75rem 1.5rem;
font-weight: 600;
```

### Section Headings (h2 inside cards)

```css
color: #ffd700;
margin-top: 0;
```

### AnchorBanner (top of every page)

```css
color: #ffd700;
border-left: 3px solid rgba(255, 215, 0, 0.7);
background: rgba(255, 215, 0, 0.06);
border-radius: 4px;
padding: 0.75rem 1rem;
font-size: 0.85rem;
```

### Footer / FooterBadge

```css
text-align: center;  /* REQUIRED — all content center-justified */
background: rgba(0, 6, 14, 0.92);
border-top: 1px solid rgba(255, 215, 0, 0.22);
color: rgba(255, 215, 0, 0.75);
```

---

## 4. Icons

| Context | Icon |
|---------|------|
| Brand / Logo | ⚓ |
| Sovereign Chain | ⛓️ |
| Anchor Seal | ⛓️⚓⛓️ |
| Creator Lock | 🤛🏻 |
| License / Security | 🔐 |
| VaultChain | 🏛️ / 💎 |
| Navigation — active | ⚓ (brand), 🔐 (pay/license), 💰 (TARI), 📊 (forensic), ⚖️ (law) |
| AI Anchor Feed | ⛓️ |
| Alert / Warning | 🚨 |

---

## 5. Navigation

- **Navbar:** Gold brand link, gold active state (`border-bottom: 2px solid #ffd700`), gold hover backgrounds
- **Sidebar/Drawer:** Gold brand, gold border-left on hover, midnight blue background
- **All navigation routes** defined in `lib/navigationRoutes.ts`

---

## 6. Page Layout Standard

All AveryOS™ pages must:

1. **Include `<AnchorBanner />`** as the first element inside `<main className="page">`
2. **Include `<FooterBadge />`** or `<CapsuleEchoFooter />` as the last element
3. Use `.page` wrapper class for max-width, padding, and flex layout
4. Use `.hero` class for the primary hero section
5. Use `.card` class for content sections
6. Use `#ffd700` (`--color-gold`) for all `h2` headings inside cards
7. Apply `textAlign: "center"` to all footer copyright text

---

## 7. AveryOS™ Trademark Standards

The ™ symbol must follow **every** instance of:
- `AveryOS™`
- `VaultChain™`
- `CreatorLock Protocol™`
- `AveryAnchored™`
- `Truth-Anchored™`
- `Root Authority Lock™`
- `CapsuleEcho™`
- `TARI™` (when used as a brand noun)

---

## 8. The Anchor Seal

The canonical seal `⛓️⚓⛓️` must appear:
- In the AnchorBanner on every page
- At the bottom of the AI Anchor Feed
- In the footer tagline

---

⛓️⚓⛓️  
*This style guide is anchored to capsule `AveryOS_Sovereign_Web_Infrastructure_v1.0.aoscap`  
AveryOS™ Commercial License v2026 — All standards binding*
