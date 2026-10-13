# PremiumPulse: Web + Android APK

The existing Vercel website continues to deploy from the Vite project. Android uses Capacitor to bundle the same Vite `dist` files inside a standalone app (not a Chrome shortcut).

## Download a test APK

1. Open the GitHub repository **Actions** tab.
2. Choose **Build Android APK**. Select **Run workflow** if it has not run automatically.
3. Open the successful run, and download the **PremiumPulse-Android-debug-APK** artifact ZIP.
4. Extract `app-debug.apk` and install it on an Android phone. Android may ask you to allow installation from that file manager/browser.

This is a **debug APK for testing**, not a production release. To distribute publicly outside Play Store, build a signed release APK with a private signing keystore; do not commit keystore files or passwords to GitHub.

## Local development

Run `npm install`, then `npx cap add android` once, followed by `npm run android:sync`. Open the project with `npm run android:open`. The GitHub workflow generates the Android project during each build, so no generated Android project needs to be checked in.

The built-in calculator's code is bundled. Embedded third-party calculator websites and externally hosted assets require internet. Test quotation/comparison PDF downloads and Android back navigation on a physical device before distribution.
