# Releasing Kharcha

## Build numbers (read this before every Play upload)

Android's build number (`versionCode` in `app.json`) carries the major version:

```
versionCode = major × 1000 + build number
1.0.0 → 1001, then 1002, 1003 … for each new Play upload of 1.x
2.0.0 → 2001, 2002 …
```

`eas.json` uses `"appVersionSource": "local"`, so EAS takes `version` and `versionCode` from `app.json`. Don't turn on `autoIncrement` for Android: it would add 1 forever and break the rule above.

### A small update (1.0.0 → 1.0.1)

1. In `app.json`, raise `version` (`1.0.1`) and add 1 to `android.versionCode` (`1001` → `1002`).
2. `eas build -p android --profile production`, then `eas submit -p android`.
3. People get it the normal way. The app does not block anyone.

### A major update (1.x → 2.0.0), forces everyone to update

1. In `app.json`, set `version` to `2.0.0` and `android.versionCode` to `2001` (the next thousand).
2. Build and submit as above, and roll it out to 100% on the Play Console.
3. When someone opens an older 1.x app, it checks the Play Store. Seeing a build in a higher thousand, it opens Google Play's full-screen update. If they close that, Kharcha shows "Time to update Kharcha" with one **Update now** button, and Back leaves the app.

The rule lives in `src/lib/versionRule.ts` (tests: `npm run test:update`); the check is in `src/lib/appUpdate.ts`; the blocking screen is `src/components/UpdateGate.tsx`.

## Testing the forced update

In-app updates only work for apps installed **from Google Play**. A sideloaded or development build always reports "no update".

1. Upload a 1.x build (for example `1001`) to an internal testing track, install it from Play on a test phone.
2. Upload a `2001` build to the same track.
3. Open the old app (Play may need a few minutes, or clear the Play Store app's cache). The update screen should appear.

Internal app sharing in the Play Console works too, and is quicker for trying the screen.

## After adding native code

`expo-in-app-updates` and `expo-application` are native modules. A new build is needed before they work:

```
npx expo prebuild --clean
npx expo run:android            # local dev build
eas build -p android --profile development   # or with EAS
```

Until then the app keeps working; the update check just does nothing.
