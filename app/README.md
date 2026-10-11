# Ash mobile

Expo + TypeScript chat client for the local Encore backend. Backend source is unchanged.

## Run

1. In `~/Downloads/ash`, run `encore run` (and keep Ollama running).
2. In this folder, run `npm install`, then `npm run ios` or `npm run android`.
3. The app opens in Expo Go. It posts `{ message }` to `/chat` and displays `{ reply }`.

`npm run typecheck` checks TypeScript.

## Connection

Change the single `API_BASE_URL` in `src/config.ts` if needed. The default `http://localhost:4000` works in the iOS simulator. A physical device needs your Mac's LAN IP, the same Wi-Fi network, and a backend listening on a LAN-accessible address. An Android emulator can use `http://10.0.2.2:4000`, or use `adb reverse tcp:4000 tcp:4000` with the default URL.

The iOS command prefers IPv4 DNS resolution to avoid a local Metro IPv6/IPv4 mismatch. For a physical device, use `npm start` and Expo's LAN connection.

## Behavior

- Dark by default; Appearance offers light and follow-system modes, saved on the device.
- Assistant Markdown links and plain HTTP(S) URLs open in the browser.
- Failed messages can be retried without duplicating the bubble. The backend has no idempotency key, so a retry after a lost response may save a duplicate server-side turn.
- The visible transcript lives in memory and resets on app reload. The backend keeps conversation memory; it currently exposes no history-list endpoint.
- Local model calls have a four-minute timeout. Send is disabled while waiting.
