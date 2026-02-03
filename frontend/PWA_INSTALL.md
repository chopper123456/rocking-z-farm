# PWA Installation & Mobile Testing Guide

## PWA Features

- **Service worker** (Workbox): Offline caching, cache-first for images, network-first for API.
- **Add to Home Screen**: Install prompt when supported; users can also use browser menu (e.g. Chrome “Add to Home screen”).
- **Offline**: Fields list and current year data are cached; scouting reports can be added offline and sync when back online.
- **Background sync**: Queued reports sync when the app is open and connection is restored.
- **Manifest**: `manifest.webmanifest` is generated at build; ensure `/icons/` assets exist for install.

## Icon Setup

The app expects PWA icons in `public/icons/`:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-maskable-192.png` (192×192, safe zone for maskable)
- `icon-maskable-512.png` (512×512, maskable)

**Generate icons:**

1. Use [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator) or any 512×512 PNG.
2. Place the four files above in `frontend/public/icons/`.
3. Rebuild: `npm run build`.

If icons are missing, the app still runs; “Add to Home Screen” may use a default or no icon.

## Install Flow (User)

1. Open the app in a supported browser (Chrome, Edge, Safari iOS 11.3+).
2. When the install banner appears, tap **Add to Home Screen** (or use browser menu → “Install app” / “Add to Home Screen”).
3. The app opens in standalone mode and works offline for cached data and queued actions.

## Development

- **Dev**: Service worker is enabled in dev (`devOptions.enabled: true`). Reload after first load to activate.
- **Build**: `npm run build` then `npm run preview` to test production PWA locally.
- **HTTPS**: PWA and service worker require a secure context (HTTPS or localhost).

## Offline Behavior

| Feature              | Offline |
|----------------------|--------|
| Field list           | From cache (last successful load). |
| Add scouting report  | Saved to queue; syncs when online. |
| Other writes         | Require connection. |
| Indicator            | Red “You’re offline” bar; green “Syncing…” when online with pending items. |

## Testing Checklist (Mobile)

### General

- [ ] App loads on 3G throttling (DevTools → Network → Slow 3G) in under ~5s.
- [ ] No horizontal scroll; content fits viewport.
- [ ] Tap targets are at least 44×44 px (buttons, links, list rows).
- [ ] Bottom nav is visible and usable on phones; all main sections reachable.

### PWA

- [ ] Install prompt appears (or “Add to Home Screen” in browser menu).
- [ ] After install, app opens in standalone (no browser UI).
- [ ] Offline: field list still shows (from cache).
- [ ] Offline: add scouting report → “Saved offline”; after going online, “Syncing…” then report appears on server.
- [ ] Offline indicator shows when network is disabled; disappears when back online.

### Camera & Photos

- [ ] “Take Photo” opens device camera; capture works.
- [ ] “Choose from Gallery” opens file picker; image loads.
- [ ] Optional: GPS shown when location allowed.
- [ ] One photo can be attached per scouting report; upload succeeds when online.

### Gestures & UX

- [ ] Pull-to-refresh on Fields list refreshes the list.
- [ ] Loading states show skeletons (e.g. field list), not only “Loading…”.
- [ ] Modals (e.g. Add Scouting) are usable and close correctly on mobile.

### Optional Features

- [ ] Share: share report or link (where implemented) uses system share (e.g. SMS/WhatsApp) when available.
- [ ] Voice input: where implemented, mic button starts/stops speech-to-text.
- [ ] Barcode: equipment barcode scanner (where implemented) opens camera and reads code.

### Desktop

- [ ] Layout still works; bottom nav hidden on large screens; header and existing navigation unchanged.
- [ ] All modules (Fields, Equipment, Grain, Inventory) work as before.
- [ ] John Deere and photo upload flows unchanged.

## Performance

- **Lazy loading**: Images and heavy components are lazy-loaded where applied.
- **Bundle**: Vendor chunks (e.g. React, utils) are split; check `npm run build` output for size.
- **3G**: Aim for first meaningful paint &lt; 3s on Slow 3G; tune with code splitting and caching.

## Troubleshooting

- **SW not updating**: Unregister in Application → Service Workers (DevTools), then hard reload.
- **Offline empty list**: Load the Fields list once while online so it can be cached.
- **Icons 404**: Add the four icon files to `public/icons/` and rebuild.
