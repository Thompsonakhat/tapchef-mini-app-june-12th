# TapChef Bot

TapChef is a Telegram Mini App cooking game. Players tap ingredients, spend energy, cook meals, complete daily tasks, keep a streak, and climb the leaderboard.

## Features
- Telegram bot with /start, /help, /play, /profile, /leaderboard, /about, and /reset
- Mobile-first Telegram Mini App served from the same Node service at /app
- Fictional Chef Points only
- Energy regeneration based on timestamps
- Daily tasks and streak tracking
- MongoDB persistence with in-memory fallback when MONGODB_URI is missing

## Architecture
- src/index.js boots the Express server and grammY bot
- src/server.js serves the API and Mini App
- src/commands contains Telegram commands
- src/services/gameService.js manages gameplay state
- webapp contains the React + Vite + Tailwind Mini App

## Setup
1. Install dependencies with npm run build
2. Copy .env.sample values into your environment
3. Set TELEGRAM_BOT_TOKEN
4. Set MONGODB_URI for persistent storage
5. Set PUBLIC_BASE_URL to your deployed base URL, not /app
6. Run npm start

## Commands
- /start: welcome and quick intro
- /help: short help and command list
- /play: open the Mini App
- /profile: show your quick stats
- /leaderboard: show top players
- /about: explain TapChef
- /reset: clear saved chat memory

## Database
Collections:
- users
- userdailyprogress
- memory_messages

Indexes:
- users.telegramUserId unique
- users.chefPoints descending
- userdailyprogress.telegramUserId + dateKey unique
- memory_messages userId + chatId + ts

## Render deploy
- Build command: npm run build
- Start command: npm start
- Required env: TELEGRAM_BOT_TOKEN
- Recommended env: MONGODB_URI, PUBLIC_BASE_URL

## Troubleshooting
- If /play says the link is not ready, set PUBLIC_BASE_URL to your service base URL
- If MongoDB is missing, the game still runs with in-memory storage but data resets on restart
- If Telegram polling conflicts during deploy overlap, the bot backs off and retries automatically
