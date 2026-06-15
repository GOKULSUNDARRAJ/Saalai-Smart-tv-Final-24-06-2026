# Multi-Platform TV App — Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/want-to-develop-one-app-for-mult-3f2d`
- **Spec**: `requirements.md` in artifacts path

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

### [x] Step 1: Requirements & Planning
- Gather platform targets, app type, feature set from user
- Write `requirements.md` with full technical spec
- Choose stack: React + TypeScript + Vite + Shaka Player + norigin spatial nav

### [x] Step 2: Project Scaffold
- Initialize Vite + React + TypeScript project in `tv-app/`
- Add `.gitignore` covering `node_modules/`, `dist/`, `.cache/`, `*.log`
- Install core dependencies: zustand, tailwindcss, shaka-player, norigin-spatial-navigation
- Configure `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- Verify `npm run dev` starts successfully

### [x] Step 3: Platform Abstraction Layer
- Create `src/platform/index.ts` — detect current platform (Tizen, webOS, Roku, AndroidTV, browser)
- Create `src/platform/keys.ts` — unified remote key code map across all platforms
- Create `src/platform/exit.ts` — platform-specific exit/quit behavior
- Create `src/platform/storage.ts` — unified storage API (localStorage fallback)

### [x] Step 4: Core TV UI Components
- Create `FocusableButton` and `FocusableCard` using norigin spatial navigation
- Create `HeroBanner` component (full-width hero with title, description, play button)
- Create `ContentRow` (horizontal scrollable row of FocusableCards)
- Create `ContentGrid` (grid layout for browse screen)
- Create `Spinner` and skeleton loader
- All components must have visible focus ring and handle TV remote key events

### [x] Step 5: App Shell & Home Screen
- Create `App.tsx` with screen router (hash-based, no server needed)
- Create `HomeScreen.tsx` with HeroBanner + multiple ContentRows
- Create `BrowseScreen.tsx` with ContentGrid
- Create `DetailScreen.tsx` (content metadata + play button)
- Add sidebar/nav menu with D-pad navigation between screens
- Handle BACK key at top-level to show exit confirmation

### [x] Step 6: Video Player
- Create `PlayerScreen.tsx` wrapping Shaka Player
- Support HLS and DASH stream URLs
- Build `PlayerControls` overlay (play/pause, seek bar, skip, back)
- Handle remote PLAY/PAUSE/REWIND/FF keys
- Auto-hide controls after 3s of inactivity
- Handle buffering states with spinner

### [x] Step 7: Platform Build Configurations
- **Tizen**: add `platforms/tizen/` with `config.xml`, build script outputting `.wgt`
- **webOS**: add `platforms/webos/` with `appinfo.json`, build script outputting `.ipk`
- **Android TV / Fire TV**: add Capacitor config in `platforms/androidtv/`
- **Roku**: add `platforms/roku/` deploy config and instructions
- Update `package.json` with per-platform build scripts: `build:tizen`, `build:webos`, `build:androidtv`, `build:roku`
- Update `README.md` with build and deployment instructions per platform
