# Play Console: what's done and what's left

App: **Kharcha: Auto Expense Tracker** · package `com.mayankjha.kharcha` · account MayankBuilds.

## Done
- App created (Free, App).
- Default store listing: name, short and full description, icon, feature graphic, 6 phone screenshots (`store/android/`).
- Privacy policy URL: https://github.com/MayankJha0333/expense-tracker/blob/main/PRIVACY.md
- Category: Finance.

## Left for you (Policy and programs → App content), with suggested answers

**Store settings → contact email** (shown publicly on the listing): your support email.

**Data safety**
- Does your app collect or share any of the required user data types? **No.** Kharcha reads SMS and saves entries only on the phone; nothing is sent off the device, and Google treats on-device-only processing as "not collected".
- Encrypted in transit: not applicable (nothing is transmitted). Account creation: no accounts. Deletion: users can delete all data in Settings → Delete all my data.

**Sensitive app permissions → SMS (Permissions declaration form)**
- Core use: **SMS-based money management (e.g. budget tracking)**.
- Permission: `READ_SMS` only (no RECEIVE/SEND/WRITE).
- Why: the app's main feature lists and totals the user's spending from the payment alerts their bank sends; without it, the user would type every payment.
- Video (YouTube, unlisted): open the app → Welcome → "Allow SMS access" → Kharcha's disclosure sheet → "Agree and continue" → Android popup → Home with payments; then decline once ("Not now") and show the app still works with entries added by hand.

**Financial features declaration**: Kharcha only tracks spending; it doesn't move money, lend, trade, or hold funds. Choose the option for apps without these features (or "Other: personal budgeting / expense tracking" if asked to describe).

**Ads**: No ads. **Target audience**: 18+. **Content rating**: complete the questionnaire (no violence, no user-generated content shared, no gambling). **Government app**: No. **Health**: No.

## Before production (fact)
Personal accounts made after 13 Nov 2023 must run a **closed test with at least 12 testers for 14 days** in a row before applying for production access. Internal testing has no such limit.

## First build
Google's API can't create the first release: build once with `eas build -p android --profile production`, then upload the `.aab` by hand in Testing → Internal testing. CI/CD takes over after that (docs/RELEASING.md).
