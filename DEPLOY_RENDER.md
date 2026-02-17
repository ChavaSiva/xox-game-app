# Public Deployment Guide (Render)

## 1) Create GitHub Repo

From project folder:

```powershell
cd C:\Users\sivac\xox-game-app
git init
git add .
git commit -m "Initial multiplayer XOX app"
```

Create an empty repo in GitHub (no README), then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## 2) Deploy On Render

1. Go to `https://render.com`
2. Click `New +` -> `Web Service`
3. Connect your GitHub repo
4. Render should detect Node app

Use these values:
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: Free (or paid)

Click `Create Web Service`.

## 3) Get Public Link

After deploy, Render gives URL like:
- `https://xox-online-game.onrender.com`

Share this with friends.

## 4) Test Multiplayer

1. Open the same Render URL on two different devices
2. Player 1 creates room
3. Player 2 joins with room code

## Notes

- `npm start` automatically syncs latest `index.html`, `styles.css`, `app.js` into `public/`.
- Keep `android/upload-keystore.jks` private. `.gitignore` already blocks `*.jks`.
- Free Render instances can sleep after inactivity; first request may take a few seconds.
