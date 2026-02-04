# Home screen icon (PWA logo)

Put your app logo here so it shows when someone adds Rocking Z Farm to their phone or tablet home screen.

## Files to add

| File | Size | Use |
|------|------|-----|
| `icon-192.png` | 192×192 px | Standard home screen icon |
| `icon-512.png` | 512×512 px | High-res / splash |
| `icon-maskable-192.png` | 192×192 px | Same logo, with safe padding (see below) |
| `icon-maskable-512.png` | 512×512 px | Same, 512px |

All must be **PNG** (with or without transparency).

## How to create them

### Option 1: From one image (easiest)

1. Start with a square logo (e.g. 512×512 or larger). PNG or JPG is fine.
2. Go to **[PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)**.
3. Upload your logo.
4. Download the zip; it contains multiple sizes.
5. Copy into this folder:
   - `icon-192.png`
   - `icon-512.png`
   - `icon-maskable-192.png`
   - `icon-maskable-512.png`  
   (Rename if the zip uses different names.)

### Option 2: Resize yourself

- Use [Canva](https://www.canva.com), Photoshop, GIMP, or any image editor.
- Export PNG at **192×192** and **512×512**.
- Save as `icon-192.png` and `icon-512.png`.
- For maskable: use the same image but add ~20% padding so important content isn’t cropped on round/adaptive icons. Save as `icon-maskable-192.png` and `icon-maskable-512.png`.

### Option 3: Same file for all (quick test)

- Export one PNG at **512×512**.
- Copy it four times and rename to:
  - `icon-192.png`
  - `icon-512.png`
  - `icon-maskable-192.png`
  - `icon-maskable-512.png`  
  (Browsers will scale; maskable may crop edges on some devices.)

## After adding the files

1. Commit and push (e.g. `git add public/icons/*.png`, commit, push).
2. Redeploy on Vercel (or let it deploy from the push).
3. New installs will use your logo. Existing home screen icons may update after a refresh or re-add.

## Where this folder is

Path from project root:

```
frontend/public/icons/
```

So the full URLs in the app will be:

- `/icons/icon-192.png`
- `/icons/icon-512.png`
- etc.
