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

- **Theme:** Auto (follow the phone) is the default. Light always uses Electric, dark always uses Midnight.

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
| `shadowFloat` | Floating tab bar | Deep black drop (bar keeps a 1px border) | Soft primary-tinted lift |

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
Five slots: Home · Activity · **+** · Insights · Accounts. The bar floats; it isn't attached to the screen edge.

- **Bar:** a rounded pill, 64 high, 16 in from each side, 10 above the phone's safe area (`src/components/tabBarSpace.ts`). `surface` fill, 1px `line` border, `shadowFloat`.
- **Active tab:** one `accentSoft` highlight slides to the open tab (spring). Active icon + label use `accentInk`, the rest `muted`.
- **+ button:** 62 round, raised 22 above the bar's middle, so it pops out of the pill. `fab` / `onFab` / `shadowRaised`, with a 4px ring in `surface` so it reads as part of the bar. It is drawn as its own layer (not inside the pill) so the raised part still takes taps on Android.
- **Fade:** a short fade from clear to `bg` sits under the bar so scrolled content doesn't cut hard against it.
- **Screens:** every tab screen ends its scroll with `useTabBarSpace()` padding, so the last row can scroll clear of the bar.

### Logo
A wallet with two bills tucked in and a coin on the clasp. Shapes: `src/lib/logo.ts` (1024 grid). Colours: `palette.logo`, worked out from the family colour, so the logo follows your pick.

- **Light (Electric):** tile in the primary colour (lighter top-left), white wallet, a gold bill and a gold coin (the highlight colour), soft coloured drop shadow. Chosen over a white tile because it stays clear at 24-32px on light pages.
- **Dark (Midnight):** near-black tile with a thin border in the bright colour, bills and wallet in that colour, yellow coin, soft glow.
- `LogoTile` adds the shadow/glow only from 48px up; below that it stays flat so it is crisp in the header.
- `Wordmark` = tile + "Kharcha" in Sora Bold + a dot in the accent colour (the coin, echoed).
- App icon files (launcher, Android adaptive + themed one-colour icon, splash, favicon) are generated from the same shapes: run `npx tsx scripts/make-icons.ts` (writes `assets/brand/*.svg`), then render them to PNG at 1024 px. The launcher uses Electric Blue (light version).
- Rules: don't add text or extra shapes inside the tile; keep at least 25% of the tile's size as space around it; never recolour it by hand, use the palette.

## Money and currencies

Facts about how amounts work (code: `src/lib/currency.ts`, `src/lib/money.ts`):

- **Every payment can have its own currency**, read from the SMS (₹ / Rs / INR, $ / USD, € , £, AED, S$, CA$, A$, ¥). An Indian bank SMS with no sign means rupees.
- **One home currency** is used for totals: your pick in Settings → Currency, or Auto (the currency most payments in the last 4 months use), or the phone's region when there are no payments yet.
- **Totals never mix currencies.** Kharcha is offline and has no exchange rates, so payments in other currencies show in lists with their own sign and a small code tag (USD), and Home shows an info notice: "1 payment in USD · Not in your ₹ totals". Activity gets an "Other currencies" filter only when there are some.
- **Formatting:** always `money(amount, { currency })`, never a hand-written "₹". Rupees use Indian grouping (₹1,00,570) and no paise except small amounts; other currencies use 3-digit grouping and show cents when there are some ($1,299.99). `moneyCompact` gives ₹1.2L / ₹1.2Cr or $1.2K / $1.2M. Counts use `formatCount`. Dates use `shortDay` ("15 Nov", or "Nov 15" for USD/CAD).

Rules so the UI never breaks:

- Amounts are `tabular` text. Tabular text stays on **one line and shrinks to fit** by default, so a number can never wrap mid-way. Pass `numberOfLines` only when you really want wrapping.
- Big text (display, title, amount) ignores the phone's extra-large font setting past 1.15–1.25×; body text goes up to 1.6×.
- Rows with an amount on the right cap the amount at about half the width; the name gets the rest and ends with "…".
- Percentages are capped: ">9,999%" in text and "999%+" inside the budget ring.
- Test with the dev-only sample switch in Settings → Currency: **India (₹)**, **US ($)** and **Stress test** (huge, tiny and long values, five currencies, a tiny budget).

## Adding a colour to a family

1. Add an entry to `MIDNIGHT` or `ELECTRIC` in `src/lib/palette.ts`.
2. Run `npm test`. The contrast checks must pass, and they tell you which pair is too weak.
3. Run `npx tsx scripts/design-system-md.ts` to refresh the tables above.
4. Check it on a phone: `kharcha://design-system`.
