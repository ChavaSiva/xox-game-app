# XOX Game App

Colorful XOX (tic-tac-toe) game with real-time multiplayer using Socket.IO.

## Run Online Multiplayer (Two Devices)

```powershell
cd C:\Users\sivac\xox-game-app
npm start
```

Then open browser:
- Same machine: `http://localhost:3000`
- Another device on same Wi-Fi: `http://YOUR_PC_LOCAL_IP:3000`

Example to find your local IP on Windows:
```powershell
ipconfig
```
Use IPv4 address from your active network adapter.

## Public Link Deployment

Use `DEPLOY_RENDER.md` to publish this app and share a public game URL with online friends.

## How To Play With Friend

1. Player 1 clicks `Create Room`.
2. Share room code with Player 2.
3. Player 2 enters code and clicks `Join Room`.
4. Play turns in real time on both devices.

## Mobile Packaging (Capacitor)

### Commands

```powershell
cd C:\Users\sivac\xox-game-app
npm run cap:sync
npm run cap:android
npm run cap:ios
```

- `cap:sync`: copies web files to `www/` and syncs native projects
- `cap:android`: sync + open Android Studio project
- `cap:ios`: sync + open Xcode project

## App Icon And Splash

- Source files:
  - `assets/icon.png`
  - `assets/splash.png`
- Regenerate platform assets:

```powershell
cd C:\Users\sivac\xox-game-app
npx capacitor-assets generate
npm run cap:sync
```

## Submission Docs (Ready To Use)

- `store-submission/play-store-listing.md`
- `store-submission/android-aab-guide.md`
- `store-submission/app-store-connect-kit.md`
- `store-submission/privacy-policy-template.md`
