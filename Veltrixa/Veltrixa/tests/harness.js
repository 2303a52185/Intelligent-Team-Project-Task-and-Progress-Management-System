const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
exports.SITE = process.env.SITE_URL || 'http://localhost:8765/';
exports.BASE = exports.SITE + 'login.html';
// pageUrl('board') -> .../board.html, pageUrl('project-1') -> .../projects.html#project-1
exports.pageUrl = name => exports.SITE + (/^project-(\d+)$/.test(name) ? 'projects.html#' + name : name + '.html');
const BS = (process.env.BOOTSTRAP_DIST || require('path').join(__dirname, 'node_modules/bootstrap/dist/'));
exports.launch = async (opts = {}) => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 900 }, deviceScaleFactor: opts.scale || 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('cdn.jsdelivr.net') && u.endsWith('bootstrap.min.css')) return route.fulfill({ body: fs.readFileSync(BS + 'css/bootstrap.min.css'), contentType: 'text/css' });
    if (u.includes('cdn.jsdelivr.net') && u.endsWith('bootstrap.bundle.min.js')) return route.fulfill({ body: fs.readFileSync(BS + 'js/bootstrap.bundle.min.js'), contentType: 'application/javascript' });
    if (u.endsWith('/js/config.js') && !process.env.SLOW) return route.fulfill({ body: fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').replace('MOCK_DELAY_MS: 450', 'MOCK_DELAY_MS: 15'), contentType: 'application/javascript' });
    if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) return route.abort();
    return route.continue();
  });
  if (opts.freezeDate || process.env.FREEZE_DATE) {   // same "today" every run, so the screenshots look the same
    await ctx.addInitScript(() => { const FIXED = new Date('2026-11-13T10:00:00Z').valueOf(), D = Date; window.Date = class extends D { constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); } static now() { return FIXED; } }; });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  return { browser, ctx, page, errors };
};
exports.ACCOUNTS = {
  Administrator: ['admin@veltrixa.com', 'admin1234'], 'Project Manager': ['athiqa@example.com', 'demo1234'],
  'Team Leader': ['rahul@example.com', 'demo1234'], 'Team Member': ['priya@example.com', 'demo1234']
};
exports.signIn = async (page, role, base = exports.BASE) => {
  await page.goto(base); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(base);
  const [email, pw] = exports.ACCOUNTS[role];
  await page.fill('#loginEmail', email); await page.fill('#loginPassword', pw); await page.selectOption('#loginRole', role);
  await page.click('#loginButton');
  await page.waitForSelector('#app:not(.d-none)'); await page.waitForSelector('#pageContent .stat-card');
};
