# Browser tests (Playwright, Chromium)

These scripts open the demo in a real headless browser and check it. They are optional, the app runs without them. The folder sits next to `js/` and `css/` because the scripts read `js/config.js`.

## One-time setup (inside `tests/`)

```bash
npm init -y
npm i playwright bootstrap@5.3.3
npx playwright install chromium
```

`harness.js` serves Bootstrap from `node_modules` so the tests also work offline. To use a different copy, set `BOOTSTRAP_DIST` to its `dist/` folder.

## Run

Start any static server in the project root first, for example `python3 -m http.server 8765`, then:

```bash
node test_api.js        # the 18 SRS endpoints and the 2.1 rules
node test_ui.js         # screens and flows for all four roles
node test_resp.js 390 768 1100   # layout check at these widths
node screenshots.js     # rewrites ../docs/screenshots
```

Set `SITE_URL` (default `http://localhost:8765/`) if your server uses another address, and `SLOW=1` to keep the demo's normal 450 ms server delay (by default the tests shorten it).
