# Kharcha

An Android expense tracker that reads your bank SMS, skips OTPs and offers, and sorts every payment into a category on its own.

Built with **React Native + Expo** (SDK 58) and a small native module for reading SMS.

---

## Run it on your phone

You need:
- Node.js 20 or newer
- Android Studio (for the Android SDK), or just the SDK + platform tools
- An Android phone with **USB debugging** on, or an emulator

Steps:

1. Install packages
   ```bash
   npm install
   ```
2. Plug in your phone, then build and install the app
   ```bash
   npx expo run:android
   ```
   The first build takes a few minutes. After that, code changes reload instantly.
3. Open the app and tap **Allow SMS access**.

> **Why not Expo Go?** Expo Go can't read SMS. That needs native Android code, which lives in `modules/sms-reader`. `npx expo run:android` makes a "development build" (your own version of Expo Go that includes it).

### See it with sample data

Turned off for now in every build. To bring it back for development builds, set `SAMPLE_DATA_ENABLED` in `src/lib/demo.ts` (the comment there shows how); then tap **Explore with sample data** on the welcome screen or in Settings.

Sample data runs about 120 sample bank messages through the real SMS reader, including fake OTPs and offers that get thrown away.

---

## What the app does

| Screen | What you see |
| --- | --- |
| **Home** | Money spent this month, the change from last month, the category split, a calendar shaded by daily spending, top categories, and the latest payments |
| **Activity** | Every payment, grouped by day, with search and filters (Spent, Received, Not counted) |
| **Insights** | Last 6 months, per-day average, biggest spend, every category with its change from last month, the shops you spend most at, how you paid (UPI, card, ATM) and your spending by day of the week |
| **Payment details** | The amount, account, the original SMS, and a category picker ("use for all Swiggy payments"), plus a switch to stop counting it |
| **Add cash expense** | For things the bank never sees: chai, auto, vegetables |

---

## How the SMS reading works

1. **Native module** (`modules/sms-reader`): reads the inbox from the last 13 months. Messages from personal phone numbers (+91 98…) are dropped right here, so your chats never reach the app code.
2. **Parser** (`src/lib/parser.ts`): for each message it
   - skips **OTPs** ("123456 is your OTP…", "OTP for txn of Rs 500…")
   - skips **offers**, **bill-due reminders**, **failed payments** and **money requests**
   - keeps only messages that have an amount, a word like "debited / credited / spent / sent", and an account or known bank sender
   - pulls out the amount, money in or out, the shop or person, the account's last 4 digits, and the payment mode (UPI, card, ATM…)
3. **Categories** (`src/lib/categorize.ts`): keyword matching (Swiggy → Food, Blinkit → Groceries, BESCOM → Bills…). Credit card bill payments and self transfers are **not counted** as spending, so the same money isn't added twice.
4. **Your corrections win** (`src/lib/store.tsx`): change a category once and it can apply to every payment from that shop. Saved on the phone with AsyncStorage.

Works with HDFC, SBI, ICICI, Axis, Kotak, IDFC, Paytm and most other Indian banks. To add a shop, edit the keyword lists in `src/lib/categorize.ts`.

Check the parser any time:
```bash
npm run test:parser
```

---

## Project layout

```
modules/sms-reader/        native Kotlin module that reads the SMS inbox
src/app/                   screens (Expo Router)
  (tabs)/index.tsx         Home
  (tabs)/activity.tsx      Activity
  (tabs)/insights.tsx      Insights
  txn/[id].tsx             payment details
  add.tsx                  add cash expense
  category/[id].tsx        one category, one month
  day/[date].tsx           one day
  welcome.tsx              permission screen
src/lib/                   parser, categories, numbers, data store
src/components/            calendar, bars, rows, chips
src/theme.ts               colours and type
scripts/test-parser.ts     sample bank SMS checks
```

---

## Before putting it on the Play Store

- Google Play only allows `READ_SMS` for approved uses. Pick **"SMS based money management"** in Play Console's Permissions Declaration Form, and make SMS tracking the main feature in your store listing.
- Add a privacy policy that says SMS is read only on the device and never uploaded.
- For your own phone you don't need any of this. Just install with `npx expo run:android`, or build an APK with `npx eas-cli build -p android --profile preview`.

## Releasing

Build numbers, forced major updates and how to test them: [docs/RELEASING.md](docs/RELEASING.md).
