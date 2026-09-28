# Readbot

A little robot that reads to you. Pick a voice, hit play, and its light‑bar
mouth moves with the narration while it scans the page and lifts its book.

- **Vite + TypeScript**, no framework — ~30 KB gzipped JS (almost all GSAP)
- **Web Audio** for playback; a pre‑computed RMS loudness envelope drives the
  mouth from the audio clock (latency‑compensated), so it stays locked to the voice
- **GSAP** for eyes / book / mouth motion; honours `prefers-reduced-motion`
- Light + dark themes, keyboard shortcuts (<kbd>Space</kbd>, <kbd>R</kbd>),
  seekable timeline, lock‑screen media controls
- Deploys to **Cloudflare Workers** as static assets (no Worker code)

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
```

## Deploy to Cloudflare

```sh
npx wrangler login # once
npm run deploy     # builds, then `wrangler deploy`
```

That publishes to `https://readbot.<your-subdomain>.workers.dev`.
Add a custom domain under **Workers & Pages → readbot → Settings → Domains & Routes**.

`npm run preview` builds and serves the site locally through the real
Workers runtime (`wrangler dev`), including the `_headers` caching rules.

### Auto‑deploy

Either option works — pick one:

1. **Cloudflare Git integration (easiest).** Workers & Pages → Create → Import a
   repository. Build command `npm run build`, deploy command `npx wrangler deploy`.
2. **GitHub Actions.** `.github/workflows/ci.yml` builds every push/PR and deploys
   pushes to `master`/`main` once you add the `CLOUDFLARE_API_TOKEN`
   (template: _Edit Cloudflare Workers_) and `CLOUDFLARE_ACCOUNT_ID` repo secrets.

## Project layout

```
index.html          page shell + inline robot SVG (paints before any JS)
src/main.ts         UI wiring, state, render loop
src/audio.ts        Web Audio engine + loudness envelope
src/robot.ts        all robot motion (mouth, eyes, blink, book)
src/style.css       theme tokens + layout
public/audio/       narration mp3s
public/_headers     cache + security headers for Cloudflare
wrangler.jsonc      Cloudflare Workers config
```

## Adding a voice

Drop an mp3 in `public/audio/` and add another radio in `index.html`:

```html
<label class="voice">
  <input type="radio" name="voice" value="/audio/my-voice.mp3" data-name="My Voice" />
  <span>My Voice</span>
</label>
```

## Tuning the mouth

`DEFAULT_MOUTH` in `src/robot.ts` — `gain`, `minScale`/`maxScale`,
`silenceGate`, `barSpread` (ripple across bars) and `attack`/`release` smoothing.
