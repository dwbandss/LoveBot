# LoveBot 

I built this for one person.

Not as a portfolio piece. Not to show off a tech stack. Just because I wanted to give someone a place that felt like I was still there — even when I wasn't around. A little app that opens on their phone and says something kind, at the right moment, without them having to ask.

That's what LoveBot is.

---

## What it actually does

When he opens the app, he picks how he's feeling — happy, okay, sad, or stressed. The constellation appears. he taps the glowing orb and gets a message. Sometimes it's a gentle affirmation. Sometimes it references something he told the app days ago. Sometimes — if he hasn't touched the phone in a while — the app sends her a notification on its own, just to say someone is thinking of her.

And sometimes, without warning, he hears my voice.

 I recorded a few voice clips from my phone and uploaded them through the creator panel. Now LoveBot plays them as surprise moments — "I saved something for you ✦" — while he's just using the app quietly. It doesn't announce it. It just happens. That's the feeling I was going for.

---

## The creator panel (for you, not HIM)

There's a hidden admin panel built into the app. He will never find it accidentally — there's no button, no hint, nothing visible. To open it, you tap the **"LoveBot" title 5 times in a row** — either on the splash screen before she starts, or on the "LoveBot" text in the top bar while on the main screen.

A password prompt appears. The default password is `loveyou`. **Change this immediately** inside the panel once you've set it up on your device.

Inside the panel you can:

- **Write private messages** — things only you would say. These get mixed into the surprise pool and show up when hhe taps the orb, styled as "from you 💌"
- **Upload your voice recordings** — .mp3 or .wav from your phone, up to 5MB each. These play automatically as background surprises, not when he taps — so they always feel unexpected
- **Add "thinking of you" moments** — short lines that appear on their own every 20 minutes or so. Things like *"I was just thinking about you 🌙"*
- **Change your password** — the new one is stored as a SHA-256 hash, not plain text

---

## How the surprises work

There are four systems running quietly in the background:

**Daily greeting** — once per day when he opens the app, he gets a message. If you've added private messages, one of those shows up first.

**Thinking of you interval** — every 20 minutes, there's a 15% chance the app sends his a message on its own, without hi  doing anything. If you've uploaded voice clips, there's also a chance it plays one of those instead.

**Surprise engine** — separate from the interval, fires every 2–8 hours randomly.

**Push notifications** — if he enables notifications in Settings, LoveBot will send a system notification to hiss phone occasionally. Tapping it opens the app and shows a message.

None of these feel mechanical because the timing is randomised. he'll never know exactly when the next one is coming.

---

## The progression system

The more he uses the app, the more it changes. These are real visual unlocks, not just celebration screens:

| Taps | What unlocks |
|------|-------------|
| 5    | A gentle welcome — the journey starts |
| 10   | Voice memories activated — clips start playing more often |
| 25   | Golden constellation — all the stars turn gold |
| 50   | Moon orb — the centre star becomes a glowing moon 🌙 |
| 100  | A secret revealed — plays your most special voice clip |
| 150  | Full constellation — six new stars appear in the sky |

This is intentional. The app is supposed to feel like it grows alongside her.

---

## The memory system

Once a day, the app quietly asks: *"What made you smile today?"*

He can type anything or skip it. If he answers, the app remembers. Later — days or weeks later — while he's tapping the orb, it might say:

*"You once told me talking to your friend made you smile. I hope today has something like that too."*

That's the moment that makes this feel like more than a random message generator.

---

## Security

This app stores personal things — your voice, your words, your password. Here's what's been done to protect them:

**Password hashing**
Your admin password is never stored as plain text. It's run through SHA-256 with a random device salt before being saved. If someone opens DevTools and looks at localStorage, they'll see a 64-character hex string — not your password.

**Obfuscated storage keys**
Admin data is stored under keys like `_lbp`, `_lbc`, `_lbm` instead of obvious names like `admin_password` or `voice_clips`. It's also base64-encoded. Someone casually browsing DevTools won't immediately know what they're looking at.

**Brute-force lockout**
Three wrong password attempts triggers a 60-second lockout. The attempt counter resets on correct login.

**Session timeout**
The creator panel auto-locks itself after 30 minutes of inactivity. Even if you leave your phone unlocked and she picks it up, the panel closes itself.

**What this doesn't protect against**
I want to be honest: It does not protect against someone who is technically skilled, has extended access to the device, and is specifically trying to extract the data. Don't store anything in voice clips or messages that would genuinely harm you.

For a personal gift app between two people who trust each other, this is more than enough :) .


## Setup

### Local development
```bash
cd server
cp .env.example .env
# Edit .env: set JWT_SECRET and ADMIN_PASSWORD
npm install
npm run dev
# Open http://localhost:3000
```

### Deploy to Railway (free)
1. Push this repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo → set root to `server/`
4. Add environment variables from .env.example
5. Railway gives you a URL like https://lovebot-xxx.railway.app

### Deploy to Render (free)
1. Go to render.com → New Web Service
2. Connect your GitHub repo
3. Root directory: `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables

## Security
- Password stored as bcrypt (12 rounds) — server side only
- JWT tokens expire in 2 hours
- Login rate-limited to 5 attempts per 15 minutes
- Voice clips never sent to browser as base64 — streamed on demand
- Admin routes all require valid JWT
- .env and data.json are gitignored — never committed

To install as an app on her phone (Android):
- Open the link in Chrome
- Tap the three-dot menu → "Add to Home Screen"
- It installs as a standalone app with no browser UI

On iPhone:
- Open in Safari
- Tap the Share button → "Add to Home Screen"

---

## File structure

Full Stack Version

lovebot-full/
├── server/              ← Node.js/Express backend
│   ├── index.js         ← All routes, password logic, message data
│   ├── package.json
│   ├── .env.example     ← Copy to .env and fill in
│   ├── .gitignore       ← .env, data.json, uploads/ never committed
│   └── uploads/         ← Voice clips stored here (auto-created)
│
└── client/
    └── public/          ← Everything the browser downloads
        ├── index.html
        ├── client.js    ← Only frontend UI logic, no secrets
        ├── style.css
        ├── manifest.json
        ├── assets/icons/
        └── pwa/service-worker.js
```

## If something breaks

**Admin panel won't open** — make sure you're tapping "LoveBot" text specifically (splash screen title or top bar label), 5 times within 2 seconds. The tap counter resets if you're too slow.

**PWA shows 404 after installing** — this usually means the service worker cached an old version. Open the link in the browser, open DevTools → Application → Service Workers → "Unregister", then reload. Reinstall from the browser.

**Voice clips aren't playing** — check that the clip is under 5MB and is a proper audio file (.mp3 or .wav preferred). Safari on iOS has restrictions on auto-playing audio — the clip will play fine when triggered by user interaction, but might be blocked in the background.

**Notifications not showing** — the user needs to explicitly enable them in Settings (the toggle) and grant permission when the browser asks. On iOS, this only works if the app is installed to the home screen first — Safari doesn't support notifications for regular browser tabs.

---

## A note on the voice

The TTS voice (the one that reads messages aloud) uses whatever speech voices are installed on the device. It tries to pick the most natural-sounding English voice available — Google UK English Female on Android, Samantha on Apple devices. It's not perfect. But I tuned the pitch, rate, and pacing per message category so comfort messages are slower and softer, hope messages are brighter, night messages are barely above a whisper.

The voice clips you record yourself will always sound better than any TTS. That's the point.

---

*Built with care. No frameworks. No servers. No tracking. Just a small constellation and the hope that someone feels less alone when they see it.*