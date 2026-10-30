# Kharcha privacy policy

_Last updated 30 October 2026_

> Kharcha works on your phone. There is no account and no cloud storage, and your messages and money data never leave your phone. The only outside service Kharcha talks to is Expo's update service, to get fixes to the app.

## Who we are

Kharcha is an open-source expense tracker made by Mayank Jha. The source code is public at github.com/MayankJha0333/expense-tracker, so anyone can check what it does.

We do not run any server for Kharcha, and we never receive your data. Kharcha is built with tools from Expo, whose update service delivers fixes to the app (see "Internet and sharing").

## What Kharcha reads

SMS, only if you allow it. With the "SMS" permission, Kharcha reads messages in your inbox from about the last 13 months.

Messages from personal phone numbers, and offers from promotional senders, are dropped inside the app's native code before any other part of the app sees them. Of the rest, Kharcha keeps only bank, card, UPI and wallet payment alerts. OTPs, offers, failed payments and money requests are thrown away. From credit card statement and bill reminder messages, Kharcha uses only the amount due, the due date and the card's last 4 digits, so it can show which bills are still to pay; other reminders are thrown away.

From each payment alert it takes the amount, whether money went out or came in, the shop or person, the last digits of the account or card, how you paid and the date. The original alert is shown on that payment's details screen so you can check it.

Kharcha never sends SMS, never deletes SMS, does not read MMS and does not listen for new messages in the background. It does not read notifications, contacts, call logs, photos or location.

What you type in: cash expenses and income, category changes and rules, savings goals and your monthly budget.

## How it is processed

All reading, sorting and charting happens on your phone. There is no remote processing of any kind.

## Where it is stored, and for how long

So it can open quickly and read only new messages next time, Kharcha keeps a copy of the payment alerts, card statement messages and scheduled payment messages it uses, in its private app storage on this phone. It never keeps OTPs, offers or messages from people. From messages about SIPs, it keeps only the fund's name.

Kharcha reads your whole inbox again at least every 30 days. Then a message you deleted from your inbox, or one older than about 13 months, disappears from Kharcha too.

This copy is deleted when you choose to add entries by hand instead, or use Settings → Delete all my data. If you turn off SMS access in Android Settings, it is deleted the next time you open Kharcha.

What you type in is saved in Kharcha's private app storage on this phone. Android keeps this storage separate from other apps. Kharcha does not add its own encryption on top of the encryption Android provides for the device.

Everything stays until you delete it: use Settings → Delete all my data, clear the app's storage in Android Settings, or uninstall Kharcha.

Android cloud backup and device-to-device transfer are turned off for Kharcha, so a copy is not made in Google Drive. This also means your entries do not move to a new phone.

## Internet and sharing

Kharcha does not send your messages, payments or anything you type to any server. It has no server to send them to.

Each time it starts, Kharcha asks Expo's update service whether there is a fix to the app's code, and downloads it if there is. The fix is used the next time you open the app. This lets fixes reach you without waiting for a Play Store update. The check sends the app's version, its update channel and the platform (Android), and may include a random ID for this installation that Expo's tools create on the phone. It is not linked to your name, number or accounts. Like any internet connection, it also shows your IP address to Expo. It never includes your messages, payments or anything you type. What Expo does with this is covered by Expo's privacy policy at expo.dev/privacy.

To see whether a newer version is out, Kharcha asks the Google Play Store app on your phone. Google Play answers from its own records; Kharcha does not send your messages, payments or entries with this check. If a required update is out, Kharcha asks you to update before you continue.

Kharcha has no analytics, crash reporting, advertising or tracking code. Fonts and icons are built into the app, so they are not downloaded.

We do not sell, share or receive your data, because it never leaves your phone through Kharcha.

Android and Google Play may collect their own information about apps on your phone (for example, crash reports if you have chosen to share usage and diagnostics with Google). That is covered by Google's privacy policy, not this one.

Development builds, used only by people working on the app, connect to the developer's own computer to load code. The web preview runs in a browser, cannot read SMS and keeps anything you type in that browser's storage.

## Permissions

SMS (READ_SMS), optional: to find bank and card payments in your inbox. Without it, Kharcha works with entries you add by hand.

Vibration (VIBRATE): for small taps of feedback when you save something.

Internet (INTERNET): Android grants this to apps automatically, without asking you. Kharcha uses it only to check for and download app fixes from Expo's update service. It never uses it to send your data.

Kharcha does not ask for any other permission. On Android 15 and later, if you installed Kharcha from a downloaded file instead of an app store, Android may lock the SMS permission until you choose "Allow restricted settings" for the app. This is an Android safety rule; Kharcha does not try to get around it.

## Your choices

You can refuse or turn off SMS access at any time in Android Settings → Apps → Kharcha → Permissions. The app keeps working with entries you add by hand.

You can delete everything Kharcha saved with Settings → Delete all my data, or by uninstalling the app.

## Children

Kharcha is a personal finance tool and is not directed at children.

## Changes to this policy

If what Kharcha does with data changes, this policy will be updated in the same app release, with a new date at the top. Kharcha will never start sending your data anywhere without a new version of the app and this policy saying so first.

## Contact

Questions or concerns: open an issue at github.com/MayankJha0333/expense-tracker.

