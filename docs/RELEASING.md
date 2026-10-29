# Releasing Kharcha

## CI/CD at a glance

- **Every push to `main` and every pull request** (`.github/workflows/ci.yml`): typecheck, lint, tests, and the build-number check.
- **Every tag `v*`** (`.github/workflows/release.yml`): the same checks, then an EAS production build (Android App Bundle) that is sent to Google Play's **internal testing** track as a draft release.

### One-time setup

1. **Expo token:** expo.dev → Account settings → Access tokens → create one. Add it on GitHub as the repository secret `EXPO_TOKEN` (Settings → Secrets and variables → Actions).
2. **Google Play service account:** Play Console → Users and permissions → invite a Google Cloud service account with release rights, and download its JSON key. Then run `eas credentials` → Android → production → Google Service Account → upload the JSON. The key stays on EAS, never in GitHub or the repo.
3. **First upload by hand:** Google's API can't create the first release of a new app. Build once (`eas build -p android --profile production`), download the `.aab`, and upload it yourself in Play Console → Testing → Internal testing. After that, the workflow takes over.
4. When the app is out of draft (it has been released on any track), change `"releaseStatus": "draft"` to `"completed"` in `eas.json`, or keep promoting releases by hand in Play Console.

### Shipping a release (one command)

Commit your work first, then:

```
npm run release:patch    # 1.0.2 → 1.0.3, versionCode +1      (bug fixes, small features)
npm run release:minor    # 1.0.3 → 1.1.0, versionCode +1      (bigger features)
npm run release:major    # 1.x   → 2.0.0, versionCode 2001    (asks everyone to update)
```

Each one (`scripts/bump-version.ts`):

1. raises the version in `app.json` (`version` and `android.versionCode`), `package.json` and `package-lock.json`, following the build-number rule below;
2. commits "Release x.y.z" and tags it `vx.y.z`;
3. pushes the commit and the tag. The tag starts the release workflow: checks, EAS build, upload to Play internal testing.

`npm run bump:patch` does steps 1–2 without pushing, if you want to look first. Then `git push && git push --tags`.

The release workflow stops if the tag doesn't match `version`, or if `versionCode` is in the wrong thousand.

### After the upload

The workflow sends the build to **Internal testing** as a **draft** (`"releaseStatus": "draft"` in `eas.json`):

1. Play Console → Testing → Internal testing → Review release → **Start rollout**.
2. Promote it to **Closed testing**, and later **Production**, when you are happy with it.

To skip step 1, set `"releaseStatus": "completed"` in `eas.json`; internal builds then go live by themselves.

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
