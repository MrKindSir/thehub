# TheHub

Local development copy of a **group video-conference tutorial** (React + Redux client, Express/Socket.IO signalling, `simple-peer` WebRTC). This is **not an original product** — it was followed from an online tutorial and kept here for learning and local experiments.

Private GitHub mirror (reference only; day-to-day work uses these localhost files):  
https://github.com/MrKindSir/thehub

## Note on difficulty

This is the **group-calling** project (mesh WebRTC, room capacity, optional Twilio TURN). It is harder to get reliable media working than HubStream or the 1:1/stranger videocall app, especially across NATs when TURN credentials are missing or expired.

## Layout

```
apps/thehub   # React UI
apps/server   # signalling API
infrastructure/docker
```

## Run with Docker

Do **not** bind API port 5002 while HubStream is running (HubStream uses 5002). This stack defaults to **5003** / **3011**.

```bash
cd infrastructure/docker
./docker-compose-wrapper.sh up -d
```

| Service | URL / port |
|--------|------------|
| Client | http://localhost:3011 |
| API | http://localhost:5003 |

The client reads `REACT_APP_SERVER_URL` (default `http://localhost:5002` if unset; Compose sets `http://localhost:5003`).

CRA `homepage` is currently `/hubtweak/conference-call` — if routing looks wrong locally, set `"homepage": "."` in `apps/thehub/package.json` for standalone use.

Stop:

```bash
./docker-compose-wrapper.sh down
```

## Recently tested

- **Date:** 2026-11-12
- **Host:** macOS (Docker Desktop)
- **Result:** `thehub-server` on `:5003` and `thehub-client` on `:3011` started successfully; room-exists API returned 200. UI modernized for localhost group calling (TURN optional).
