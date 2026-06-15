# Android TV / Fire TV Deployment

## Setup

1. Install Capacitor:
   ```
   npm install @capacitor/core @capacitor/cli @capacitor/android
   ```

2. Initialize Capacitor (only once):
   ```
   npx cap init "TV App" com.example.tvapp --web-dir dist/androidtv
   npx cap add android
   ```

3. Copy `capacitor.config.json` from this folder to project root.

## Build & Run

```bash
npm run build:androidtv
npx cap open android
```

Then in Android Studio:
- Select **Android TV** emulator or connected TV device
- Click **Run**

## Fire TV

Fire TV is Android-based. The same APK works on Fire TV Stick.
Upload via [Amazon Developer Console](https://developer.amazon.com/apps-and-games).

## Key Handling

D-pad keys are automatically forwarded as arrow keys inside the WebView.
The BACK key maps to `Escape` and is handled in `src/platform/keys.ts`.
