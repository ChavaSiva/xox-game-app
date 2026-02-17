# Android Signed AAB Guide - XOX Game

Use this to create the `.aab` file for Play Store upload.

## 1) Open Android Project

```powershell
cd C:\Users\sivac\xox-game-app
npm run cap:sync
npm run cap:android
```

This opens Android Studio with `android/` project.

## 2) Set Release Version

Edit `android/app/build.gradle`:
- `versionCode`: increase by 1 for every new upload
- `versionName`: human-readable version like `1.0.1`

Current values are in `android/app/build.gradle`:
- `versionCode 1`
- `versionName "1.0"`

## 3) Build Signed Bundle

In Android Studio:
1. `Build` > `Generate Signed Bundle / APK`
2. Choose `Android App Bundle`
3. Create/select keystore
4. Fill key alias and passwords
5. Select `release`
6. Finish build

## 4) Find Output File

The generated bundle is typically at:
- `android/app/release/app-release.aab`

## 5) Upload To Play Console

1. Open Play Console > your app
2. Go to `Testing` (internal) or `Production`
3. Create release and upload `app-release.aab`
4. Add release notes
5. Review and roll out

## 6) Future Updates

For each update:
1. Update web code
2. Run `npm run cap:sync`
3. Increase `versionCode` and `versionName`
4. Build and upload a new signed AAB

## Keystore Safety

- Keep the keystore file and passwords backed up securely.
- If you lose the signing key, release updates become difficult.
- Prefer Play App Signing in Google Play Console.
