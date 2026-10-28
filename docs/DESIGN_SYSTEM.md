# Kharcha design system

Kharcha has **two colour families, one per mode**:

| Mode | Family | Feel | Colours to pick from |
| --- | --- | --- | --- |
| Dark | **Midnight** | Near-black page, one bright accent | Lime (default), Mango, Aqua, Lilac |
| Light | **Electric** | Soft tinted page, one strong primary + a warm highlight | Blue (default), Violet, Emerald, Magenta |

People pick one colour for each family in **Settings › Appearance**. The phone (or the System / Light / Dark switch) decides which family is showing.

See it live: **Settings › About › Design system** in a development build, or open `kharcha://design-system`.

---

## Rules

1. **Use roles, never hex.** Write `p.accent`, not `#C8F65D`. Get colours with `const p = usePalette()`.
2. **Colour never works alone.** Every coloured bar, dot or badge has a word or number next to it.
3. **One loud thing per screen.** The hero card is the loud thing. Everything else sits on calm cards.
4. **Readable everywhere.** Text is at least 4.5:1 against its background, chart marks and icons at least 3:1. `npm test` checks this for all 8 themes, including see-through colours on the hero card.
5. **Simple words.** "Money in", not "Credits". "Needs a look", not "Uncategorised".

---

## Files

| File | What lives there |
| --- | --- |
| `src/lib/palette.ts` | All colour and shadow tokens, both families, the saved-theme format. No React Native imports, so tests can read it. |
| `src/theme.ts` | Fonts, type scale, spacing, corner radius, `ThemeProvider`, `usePalette()`, `useTheme()`. |
| `src/components/ui.tsx` | Basic parts: `Txt`, `Card`, `Button`, `Chip`, `Segmented`, `Tag`, `PayBadge`, `AmountBar`, `MixBar`, `NoticeRow`, `ShareBar`, `Empty`. |
| `src/components/HeroCard.tsx` | The hero card (design 4a). |
| `src/components/charts.tsx` | `Ring` (progress ring), `Bars`, `SavingsLine`. |
| `src/components/finance.tsx` | Money parts: `TxnRow`, `MonthSwitcher`, `CategoryRow`, `billLine`. |
| `src/components/Logo.tsx` | `LogoTile`, `Wordmark`. |
| `src/app/design-system.tsx` | The live gallery. |

---

## Colour roles

### Midnight (dark mode)

<!-- midnight:start -->
| Role | Used for | Lime | Mango | Aqua | Lilac |
| --- | --- | --- | --- | --- | --- |
| `bg` | Page background | `#0A0A0B` | `#0B0A09` | `#070B0C` | `#0B0A12` |
| `surface` | Cards | `#151517` | `#171513` | `#111719` | `#15131F` |
| `surfaceAlt` | Chips, inputs, tracks | `#1C1C1F` | `#1F1C19` | `#182022` | `#1D1A2A` |
| `line` | Borders and dividers | `#26262A` | `#2A2622` | `#22292C` | `#262336` |
| `ink` | Main text | `#F4F4F5` | `#F4F4F5` | `#F4F4F5` | `#F4F4F5` |
| `muted` | Secondary text | `#A1A1AA` | `#A1A1AA` | `#A1A1AA` | `#A1A1AA` |
| `accent` | Active tab, links, bars | `#C8F65D` | `#FFB547` | `#5EEAD4` | `#C4B5FD` |
| `highlight` | Hero chip, logo arrow | `#C8F65D` | `#FFB547` | `#5EEAD4` | `#C4B5FD` |
| `hero` | Hero card fill | `#C8F65D` | `#FFB547` | `#5EEAD4` | `#C4B5FD` |
| `heroText` | Text on hero | `#0A0A0B` | `#0A0A0B` | `#0A0A0B` | `#0A0A0B` |
| `fab` | + button | `#C8F65D` | `#FFB547` | `#5EEAD4` | `#C4B5FD` |
| `card` | Deep slab (settings, account page) | `#1C1C1F` | `#1F1C19` | `#182022` | `#1D1A2A` |
| `income` | Money in | `#86EFAC` | `#86EFAC` | `#86EFAC` | `#86EFAC` |
| `warn` | Due soon, needs a look | `#FF8A5B` | `#FF8A5B` | `#FF8A5B` | `#FF8A5B` |
| `danger` | Late, over budget | `#F87171` | `#F87171` | `#F87171` | `#F87171` |
<!-- midnight:end -->

### Electric (light mode)

<!-- electric:start -->
| Role | Used for | Blue | Violet | Emerald | Magenta |
| --- | --- | --- | --- | --- | --- |
| `bg` | Page background | `#F4F6FF` | `#F7F4FF` | `#F1F8F4` | `#FDF4FF` |
| `surface` | Cards | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `surfaceAlt` | Chips, inputs, tracks | `#EBEEFF` | `#EFEAFC` | `#E5F2EB` | `#F6E9F8` |
| `line` | Borders and dividers | `#E1E5F7` | `#E6E0F5` | `#DAEBE2` | `#F0DDF3` |
| `ink` | Main text | `#0D1333` | `#1A1033` | `#0B2318` | `#2A0B2E` |
| `muted` | Secondary text | `#5B6285` | `#5F5680` | `#4F6B5E` | `#6E5470` |
| `accent` | Active tab, links, bars | `#3346FF` | `#6C2BD9` | `#03684C` | `#A21CAF` |
| `highlight` | Hero chip, logo arrow | `#FFC93C` | `#FFD166` | `#FDE047` | `#FDE68A` |
| `hero` | Hero card fill | `#3346FF` | `#6C2BD9` | `#03684C` | `#A21CAF` |
| `heroText` | Text on hero | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `fab` | + button | `#3346FF` | `#6C2BD9` | `#03684C` | `#A21CAF` |
| `card` | Deep slab (settings, account page) | `#0D1333` | `#1A1033` | `#0B2318` | `#2A0B2E` |
| `income` | Money in | `#15803D` | `#15803D` | `#15803D` | `#15803D` |
| `warn` | Due soon, needs a look | `#C2410C` | `#C2410C` | `#C2410C` | `#C2410C` |
| `danger` | Late, over budget | `#DC2626` | `#DC2626` | `#DC2626` | `#DC2626` |
<!-- electric:end -->

Also in every palette: `accentInk` (accent as text), `accentSoft` (tinted background), `onAccent`, `brand`, `onBrand`, `onHighlight`, `savings`, `incomeSoft`, `warnSoft`, `onWarn`, `dangerSoft`, `onDanger`, `cardText`, `cardMuted`, `cardAccent`, `cardIncome`, `heroMuted`, `heroValue`, `heroTrack`, `heroBar`, `heroRing`, `heroOrb`, `heroChip`, `heroChipText`, `heroTile`, `onFab`, `logoTile`, `logoStem`, `logoArrow`, `track`, `scrim`, `series[0..4]` (chart colours, payment methods), `onSeries`.

> These tables are generated. After changing `palette.ts`, run `npx tsx scripts/design-system-md.ts`.

---

## Type

Everything is set in **Sora** (bundled, never downloaded). Use `<Txt variant="…">`.

| Variant | Size / line | Weight | Use for |
| --- | --- | --- | --- |
| `display` | 40 / 46 | ExtraBold | The one big number on a screen |
| `title` | 26 / 32 | Bold | Screen titles |
| `amount` | 20 / 26 | Bold | Amounts in tiles and lists |
| `heading` | 16 / 22 | SemiBold | Section titles |
| `bodyStrong` | 15 / 21 | SemiBold | Row titles, buttons |
| `body` | 15 / 21 | Regular | Normal text |
| `smallStrong` | 13 / 18 | SemiBold | Chips, labels that matter |
| `small` | 13 / 18 | Regular | Secondary text |
| `tiny` | 11 / 14 | Medium | Dates, captions, chart labels |
| `label` | 11 / 14 | SemiBold, caps | Rare small headings |

Money always uses `tabular` so digits line up.

---

## Spacing, corners, shadows

- **Spacing** (`space`): 4 · 8 · 12 · 16 · 24 · 32. Screen side padding is 16. Sections are 24 apart.
- **Corners** (`radius`): small 10 (chips, inner boxes) · medium 16 (inputs) · cards 20 · hero 28 · pills 999.
- **Shadows** (CSS `boxShadow` strings, coloured by family):

| Token | Use | Midnight | Electric |
| --- | --- | --- | --- |
| `shadowCard` | Cards, notices | Deep black drop (cards also keep a 1px border) | Soft tint of the primary |
| `shadowHero` | Hero card | Glow in the accent colour | Strong primary-coloured lift |
| `shadowRaised` | + button | Accent glow | Primary-coloured lift |

---

## Components

### Hero card (`HeroCard`, design 4a)
The big card at the top of Home. Fill = `hero`. A ring sits in the top-right corner (`heroRing`); Electric adds a small highlight orb inside it (`heroOrb`). The shadow (`shadowHero`) is on the outer view and the ring is clipped by the inner view.

Inside, top to bottom: label (`smallStrong`, `heroText`) → big amount (`display`, `heroValue`) → chip (`heroChip` / `heroChipText`) → two tiles (`heroTile`) for money in and money out.

Only **one** hero per screen.

### Budget card with ring
`Card` + `Ring` (64px, 8 thick) + three lines of text. The ring colour says how it's going, and the text says the same in words:
`income` up to 85% · `warn` 85–100% · `danger` over 100%.

### Card
`surface` fill, hairline `line` border, `shadowCard`, 20 corners, 16 padding.

### NoticeRow
A row that tells you something: icon tile, title, one grey line, and a pill on the right. Pass a `tone` and it picks every colour (from `noticeColors` in `palette.ts`). Never pass colours by hand.

| Tone | Use it for | Look |
|---|---|---|
| `neutral` | Plain info: next card bill when nothing is urgent | Normal card + shadow, grey tile |
| `accent` | An invitation: set a budget | Normal card + shadow, accent tile |
| `info` | App status: sample data, SMS reading off | Normal card + shadow, blue tile |
| `warn` | Needs you soon: payments to check, bill due in 3 days or less | Tinted card, soft border (no shadow), solid tile |
| `danger` | Late or wrong: bill overdue | Tinted card, soft border (no shadow), solid tile |

Rules:
- **Pill** (`pill="Review"`): one or two words. Either what to do ("Review", "Set") or how urgent ("8 days", "Late"). A chevron shows inside it when the row is tappable.
- **Title** carries the number or the main fact. **Grey line** carries the detail. Keep each to one line where you can.
- **`compact`**: a slim row for app status, so it doesn't fight the hero card. Use it for "Sample data" only.
- No pill and no `onPress`: a plain message inside a screen (for example, on a payment that needs a look).
- `SmsNotice` uses the same colours (`info`, or `warn` when you must go to Android Settings).

### Buttons
`primary` (ink fill) for the main action · `accent` for save/confirm · `secondary` (outlined) · `quiet` (text only) · `danger` (tinted red). Minimum height 52 (compact 40).

### Chips and segmented control
Plain chips fill with `accent` when picked. Category chips use the category colour as a tint. The segmented control fills the picked option with `accent`.

### PayBadge
A small outlined label for how something was paid: `UPI`, `HDFC card ••7788`, `Cash`. Dashed when the payment isn't counted (card bill payments, self transfers).

### Charts
- `AmountBar`: label + amount + share, with a bar under it. Bars beat pies for comparing (Nielsen Norman Group).
- `MixBar`: one bar split into payment methods, always with a legend that names each part.
- Colours for series come from `series`, in a fixed order per payment method (UPI, card, cash, net banking, other).

### + button and tab bar
Five slots: Home · Activity · **+** · Insights · Accounts. The + uses `fab` / `onFab` / `shadowRaised`. The active tab uses `accentInk`, the rest use `muted`.

### Logo
A white ledger line + an arrow in `logoArrow`, on a `logoTile`. Midnight: bright arrow on a dark tile. Electric: highlight arrow on a primary tile.

---

## Adding a colour to a family

1. Add an entry to `MIDNIGHT` or `ELECTRIC` in `src/lib/palette.ts`.
2. Run `npm test`. The contrast checks must pass, and they tell you which pair is too weak.
3. Run `npx tsx scripts/design-system-md.ts` to refresh the tables above.
4. Check it on a phone: `kharcha://design-system`.
