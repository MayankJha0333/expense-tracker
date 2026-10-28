# Kharcha privacy policy

_Last updated 28 October 2026_

> Kharcha works entirely on your phone. There is no account, no server and no cloud. The Android app has no permission to use the internet, so your messages and money data cannot be sent anywhere by Kharcha.

## Who we are

Kharcha is an open-source expense tracker made by Mayank Jha. The source code is public at github.com/MayankJha0333/expense-tracker, so anyone can check what it does.

We do not run any server for Kharcha, and we never receive your data.

## What Kharcha reads

SMS, only if you allow it. With the "SMS" permission, Kharcha reads messages in your inbox from about the last 13 months.

Messages from personal phone numbers are dropped inside the app's native code before any other part of the app sees them. Of the rest, Kharcha keeps only bank, card, UPI and wallet payment alerts. OTPs, offers, failed payments and money requests are thrown away. From credit card statement messages, Kharcha keeps only the amount due, the due date and the card's last 4 digits, so it can show which bills are still to pay; other reminders are thrown away.

From each payment alert it takes the amount, whether money went out or came in, the shop or person, the last digits of the account or card, how you paid and the date. The original alert is shown on that payment's details screen so you can check it.

Kharcha never sends SMS, never deletes SMS, does not read MMS and does not listen for new messages in the background. It does not read notifications, contacts, call logs, photos or location.

What you type in: cash expenses and income, category changes and rules, savings goals and your monthly budget.

## How it is processed

All reading, sorting and charting happens on your phone. There is no remote processing of any kind.

## Where it is stored, and for how long

Payments found in SMS are not saved by Kharcha. They are read again from your inbox each time you open or refresh the app, so a message you delete from your inbox, or one older than about 13 months, also disappears from Kharcha.

What you type in is saved in Kharcha's private app storage on this phone. Android keeps this storage separate from other apps. Kharcha does not add its own encryption on top of the encryption Android provides for the device.

It stays until you delete it: use Settings → Delete all my data, clear the app's storage in Android Settings, or uninstall Kharcha.

Android cloud backup and device-to-device transfer are turned off for Kharcha, so a copy is not made in Google Drive. This also means your entries do not move to a new phone.

Sample data ("Explore with sample data") is made up, lives only in memory and is never saved.

## Internet and sharing

The Android release build of Kharcha is made without the internet permission, so Android itself blocks it from opening any network connection. As a second layer, the app's code refuses web requests. You can check both under Settings → Privacy checks.

Kharcha has no analytics, crash reporting, advertising or tracking code. Fonts and icons are built into the app, so nothing is downloaded.

We do not sell, share or receive your data, because it never leaves your phone through Kharcha.

Android and Google Play may collect their own information about apps on your phone (for example, crash reports if you have chosen to share usage and diagnostics with Google). That is covered by Google's privacy policy, not this one.

Development builds, used only by people working on the app, connect to the developer's own computer to load code. The web preview runs in a browser, is not covered by Android's internet block, cannot read SMS and keeps anything you type in that browser's storage.

## Permissions

SMS (READ_SMS), optional: to find bank and card payments in your inbox. Without it, Kharcha works with entries you add by hand.

Vibration (VIBRATE): for small taps of feedback when you save something.

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

