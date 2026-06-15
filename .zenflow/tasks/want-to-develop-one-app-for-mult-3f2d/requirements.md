# Multi-Platform TV App — Technical Specification

## Overview

A Netflix-like streaming application built from a **single React/TypeScript codebase** that targets all major TV platforms.

---

## Target Platforms

| Platform | Runtime | Distribution |
|---|---|---|
| Samsung Smart TV (Tizen) | Chromium-based WebView | Tizen Store (`.wgt` package) |
| LG Smart TV (webOS) | Chromium-based WebView | LG Content Store (`.ipk` package) |
| Roku | BrightScript + Roku Web | Roku Channel Store |
| Android TV / Google TV | Android + WebView | Google Play Store |
| Amazon Fire TV | Android + WebView | Amazon Appstore |
| Apple TV (tvOS) | tvOS / react-native-tvos | Apple App Store |

---

## Recommended Architecture

### Why Web-First?

Samsung Tizen, LG webOS, and Roku all run **Chromium-based web engines**, so a React web app is the most natural target. Android TV and Fire TV are Android-based and can wrap a web app using Capacitor. Apple TV is the exception and requires react-native-tvos for App Store distribution.

### Code Sharing Strategy

```
shared/             ← 100% shared: business logic, API, state, utils
  api/
  store/
  hooks/
  utils/

src/                ← Shared UI (95%+ reuse across web-based platforms)
  components/
  screens/
  platform/         ← Platform detection & abstraction (key input, storage)

platforms/          ← Platform-specific packaging & config only
  tizen/
  webos/
  roku/
  androidtv/
```

---

## Tech Stack

| Concern | Library | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Universal, large ecosystem |
| Build Tool | Vite | Fast, flexible output targets |
| Spatial Nav | `@noriginmedia/norigin-spatial-navigation` | Battle-tested TV D-pad nav |
| Video Player | Shaka Player (Google) | HLS + DASH, DRM support, TV-optimized |
| State | Zustand | Lightweight, no boilerplate |
| Styling | Tailwind CSS | TV-specific utility classes |
| Testing | Vitest + React Testing Library | Co-located with Vite |

---

## Core Features (MVP)

1. **Content catalog** — Hero banner, horizontal content rows (like Netflix rows), grid browsing
2. **D-pad / remote navigation** — Full spatial navigation with keyboard emulation for development
3. **Video streaming** — HLS/DASH playback via Shaka Player (supports Widevine/PlayReady DRM)
4. **Content detail screen** — Metadata, episode list, play button
5. **Platform abstraction** — Key codes, exit behavior, storage APIs differ per platform

---

## Platform-Specific Notes

### Samsung Tizen
- Package: `.wgt` file via `@tizen/tizen-tv-webapis`
- Key input: `tizentv` remote key codes mapped to standard keyboard events
- Exit: `tizen.application.getCurrentApplication().exit()`

### LG webOS
- Package: `.ipk` via `@webos-tools/cli`
- Key input: webOS remote key codes
- Exit: `webOS.platformBack()`

### Roku
- Web channel hosted via Roku Direct Publisher or Roku Web
- Or native: BrightScript/SceneGraph (separate codebase — not included in web build)

### Android TV / Fire TV
- Wrap web app using Capacitor (`@capacitor/android`)
- DPAD keys map to standard arrow keys inside WebView
- Hardware back button handled via Capacitor plugin

### Apple TV
- Option A (simpler): Wrap in a tvOS WKWebView app (no App Store)
- Option B (recommended for App Store): Use `react-native-tvos` with shared business logic

---

## Project Structure

```
tv-app/
├── src/
│   ├── components/
│   │   ├── focusable/        FocusableButton, FocusableCard
│   │   ├── player/           VideoPlayer, PlayerControls, ProgressBar
│   │   └── ui/               HeroBanner, ContentRow, ContentGrid, Spinner
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── PlayerScreen.tsx
│   │   ├── BrowseScreen.tsx
│   │   └── DetailScreen.tsx
│   ├── platform/
│   │   ├── index.ts          Platform detection
│   │   ├── keys.ts           Unified key code map
│   │   ├── storage.ts        Unified storage API
│   │   └── exit.ts           Platform-specific exit behavior
│   ├── store/                Zustand stores
│   ├── api/                  Content API client
│   ├── hooks/                Custom React hooks
│   └── utils/
├── platforms/
│   ├── tizen/                config.xml, tizen-manifest
│   ├── webos/                appinfo.json, webos-manifest
│   ├── roku/                 deploy config
│   └── androidtv/            Capacitor Android project
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## TV UX Guidelines

- **Font size**: Minimum 24px (viewed from 3m away)
- **Focus ring**: Always visible, high contrast (3px+ border)
- **Loading states**: Always show skeleton/spinner — no blank screens
- **Back navigation**: All screens must handle the Back key
- **Safe area**: 5% margin on all edges (TV overscan)
- **Remote keys**: UP / DOWN / LEFT / RIGHT / OK / BACK / HOME / PLAY / PAUSE / REWIND / FF
