const { launch, signIn, pageUrl, BASE } = require('./harness.js');
const PAGES = { Administrator: ['dashboard','projects','team','tasks','board','reports','approvals','admin','activity'], 'Project Manager': ['dashboard','projects','team','tasks','board','reports','approvals'], 'Team Leader': ['dashboard','projects','team','tasks','board','reports','approvals'], 'Team Member': ['dashboard','projects','tasks','board'] };
const audit = () => {
  const vw = document.documentElement.clientWidth, bad = [];
  const scrollable = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth - 1 || o === 'auto' || o === 'scroll') return true; } return false; };
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('.modal:not(.show)') || el.closest('.toast-container') || el.closest('.d-none')) return;
    if (r.right > vw + 1 && !scrollable(el)) bad.push((el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' right=' + Math.round(r.right));
  });
  return { pageOverflow: document.documentElement.scrollWidth > vw + 1, scrollWidth: document.documentElement.scrollWidth, vw, bad: [...new Set(bad)].slice(0, 6) };
};
(async () => {
  const widths = process.argv.slice(2).map(Number); if (!widths.length) widths.push(390);
  let problems = 0;
  for (const width of widths) {
    const { browser, page, errors } = await launch({ viewport: { width, height: 844 }, mobile: width < 600 });
    const settle = () => page.waitForTimeout(350);
    const report = async (label) => { const a = await page.evaluate(audit); const ok = !a.pageOverflow && !a.bad.length; if (!ok) problems++; console.log((ok ? 'ok   ' : 'WIDE ') + String(width).padEnd(4) + label.padEnd(44) + (ok ? '' : `scrollWidth ${a.scrollWidth}/${a.vw}  ${a.bad.join('; ')}`)); };
    // login and register pages
    await page.goto(BASE); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.goto(BASE); await settle();
    await report('login'); await page.goto(pageUrl('register')); await settle(); await report('register');
    for (const role of Object.keys(PAGES)) {
      await signIn(page, role);
      for (const p of PAGES[role]) { await page.goto(pageUrl(p)); await page.waitForSelector('#pageContent > *'); await page.waitForTimeout(500); await report(role + ' / ' + p); }
      if (role === 'Project Manager') {
        await page.goto(pageUrl('project-1')); await page.waitForSelector('[data-project-tab]'); await page.waitForTimeout(500);
        for (const tab of ['overview', 'team', 'tasks', 'progress']) { await page.click(`[data-project-tab=${tab}]`); await page.waitForTimeout(600); await report(role + ' / project 1 / ' + tab); }
        await page.click('[data-act=edit-project]'); await page.waitForSelector('#recordModal.show'); await page.waitForTimeout(500); await report(role + ' / edit project dialog'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        await page.goto(pageUrl('approvals')); await page.waitForSelector('[data-approvals-tab]'); await page.waitForTimeout(500); await page.click('[data-approvals-tab=decisions]'); await page.waitForTimeout(600); await report(role + ' / approvals decisions');
        await page.goto(pageUrl('tasks')); await page.waitForSelector('#pageContent > *'); await page.waitForTimeout(600);
        await page.click('[data-act=task-detail] >> nth=0'); await page.waitForSelector('#detailModal.show'); await page.waitForTimeout(500); await report(role + ' / task detail dialog'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        await page.click('[data-act=edit-task] >> nth=0'); await page.waitForSelector('#recordModal.show'); await page.waitForTimeout(600); await report(role + ' / edit task dialog'); await page.keyboard.press('Escape');
      }
      // can the user still sign out at this width?
      const logoutVisible = await page.evaluate(() => { const b = document.getElementById('logoutButton'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.right <= document.documentElement.clientWidth && r.bottom > 0 && getComputedStyle(b).visibility !== 'hidden'; });
      if (!logoutVisible) problems++;
      console.log((logoutVisible ? 'ok   ' : 'FAIL ') + String(width).padEnd(4) + (role + ' / sign-out button visible').padEnd(44));
    }
    if (errors.length) console.log('page errors:', errors);
    await browser.close();
  }
  console.log(problems ? `\n${problems} layout problem(s)` : '\nNo layout problems');
})();
