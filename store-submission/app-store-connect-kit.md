# App Store Connect Submission Kit - XOX Game

Use this when submitting iOS build to App Store.

## Project Info

- App name: `XOX Game`
- Bundle ID: `com.sivac.xoxgame`
- Platform: iOS

## Metadata You Can Paste

### Subtitle (<= 30 chars)
Classic Tic-Tac-Toe

### Promotional Text (<= 170 chars)
Play XOX with friends, track scores, and enjoy fun win celebrations every round.

### Description
XOX Game brings the classic tic-tac-toe experience to your phone with a clean interface and smooth gameplay.

Play local two-player matches, keep track of wins and draws, and enjoy celebration effects when someone wins.

Features:
- Two-player X and O gameplay
- Scoreboard for X wins, O wins, and draws
- Confetti celebration on every win
- Restart game and reset score actions
- Simple design for quick, repeat play

### Keywords (<= 100 chars, comma-separated)
tic tac toe,xox,board game,2 player,local multiplayer,puzzle

### Support URL
Use a URL where users can contact you (website/form/email page).

### Marketing URL (optional)
Landing page for the app.

### Privacy Policy URL
Recommended and often required for submission workflows.

## Screenshot Plan (iPhone)

Prepare at least 3-5 screenshots:
1. Start screen with board and scoreboard
2. Mid-game move state
3. Win celebration state
4. Score reset/restart controls

Common portrait size option:
- 1290 x 2796 (6.9-inch class)

## iOS Build + Upload Flow (macOS)

1. On macOS, install Xcode and CocoaPods.
2. Run:

```bash
cd /path/to/xox-game-app
npm run cap:sync
npm run cap:ios
```

3. In Xcode:
- Set signing team
- Confirm bundle identifier
- Set version/build number

4. `Product` > `Archive`
5. Upload archive to App Store Connect
6. In App Store Connect, attach build to app version and submit for review

## App Review Readiness Checklist

1. App metadata complete
2. Screenshots uploaded
3. App privacy answers completed
4. Age rating completed
5. In-app purchases section set (if none, leave empty)
6. Sign-in info section set to "No login required"
7. Review notes: explain it is a local two-player game
