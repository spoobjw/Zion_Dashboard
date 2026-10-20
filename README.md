# Running Zion Dashboard

Use Node 22 or newer. Run `npm.cmd install`, `npm.cmd run build`, then `npm.cmd start`.
Open http://127.0.0.1:3400 on this computer. Development mode (`npm.cmd run dev`) is available only on localhost.

## Private remote access

LAN and Tailscale clients require a password. Before starting the production server, set `ZION_ACCESS_PASSWORD` in its environment using your password manager or a private terminal. Use username `zion` and that password in the browser sign-in dialog. When a password is set, local clients also sign in. No password is generated, logged, saved in this repository, or embedded in the client.

Use an encrypted Tailscale connection or an HTTPS reverse proxy for remote access; Basic credentials are not encrypted by HTTP itself. Do not expose port 3400 to the public internet. With no password configured, only loopback clients can open the dashboard. The private-network IP filter remains in place. A reverse proxy must enforce authentication itself if it reaches the server over loopback without a configured password. Browser writes must come from the same origin and use JSON.

## Drafts and privacy

Visited modules stay mounted so switching modules or opening settings preserves drafts in memory. Save before refreshing, closing the page, or restarting the browser. This does not create browser-storage copies of pastoral data.

The service worker caches the application shell and built assets only. It removes legacy Zion caches on activation, including previously cached membership, prayer, and sermon responses. Help & settings also offers a manual cache-clear action. Server records require a connection; offline mutations are not queued.

## Validation

`npm.cmd test` runs API and access-control regression tests. `npm.cmd run build` checks TypeScript and builds the client. `npm.cmd run test:ui` runs browser workflow checks against synthetic API fixtures, using installed Microsoft Edge (or `ZION_TEST_BROWSER` for another Chromium executable).
