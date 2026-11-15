const { launch, signIn, pageUrl, BASE } = require('./harness.js');
const fs = require('fs');
const OUT = process.env.SHOT_DIR || require('path').join(__dirname, '../docs/screenshots');
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const mode of ['desktop', 'mobile']) {
    const isM = mode === 'mobile';
    const { browser, page, errors } = await launch({ freezeDate: true, viewport: isM ? { width: 390, height: 844 } : { width: 1366, height: 860 }, mobile: isM, scale: isM ? 2 : 1 });
    fs.mkdirSync(`${OUT}/${mode}`, { recursive: true });
    let n = 0; const names = [];
    const shot = async (name, full = true) => { await page.mouse.move(0, 0); await page.waitForTimeout(500); const file = `${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: `${OUT}/${mode}/${file}`, fullPage: full }); names.push(file); };
    const go = async n => { await page.goto(pageUrl(n)); await page.waitForSelector('#pageContent > *'); await page.waitForTimeout(500); };
    // login
    await page.goto(BASE); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.goto(BASE);
    await shot('login', false);
    // Administrator
    await signIn(page, 'Administrator'); await shot('admin-dashboard'); await go('admin'); await shot('admin-administration'); await go('activity'); await shot('admin-activity-log');
    // Project Manager
    await signIn(page, 'Project Manager'); await shot('pm-dashboard'); await go('projects'); await shot('pm-projects');
    await go('project-1'); await shot('pm-project-overview');
    await page.click('[data-project-tab=team]'); await shot('pm-project-team');
    await page.click('[data-project-tab=tasks]'); await shot('pm-project-tasks');
    await page.click('[data-project-tab=progress]'); await shot('pm-project-progress');
    await page.click('[data-project-tab=tasks]'); await page.waitForTimeout(400); await page.click('[data-act=add-project-task]'); await page.waitForSelector('#recordModal.show'); await page.waitForTimeout(600); await shot('pm-add-task-dialog', false);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await go('tasks'); await shot('pm-tasks'); await go('board'); await shot('pm-board', !isM); await go('reports'); await shot('pm-reports');
    // Team Leader
    await signIn(page, 'Team Leader'); await shot('tl-dashboard'); await go('team'); await shot('tl-team');
    await go('approvals'); await shot('tl-approvals-queue'); await page.click('[data-approvals-tab=decisions]'); await shot('tl-approvals-decisions');
    // Team Member
    await signIn(page, 'Team Member'); await shot('tm-dashboard'); await go('board'); await shot('tm-board', !isM);
    await go('tasks'); await page.waitForTimeout(400); await page.click('[data-act=task-detail] >> nth=0'); await page.waitForSelector('#detailModal.show'); await page.waitForTimeout(600); await shot('tm-task-detail-dialog', false);
    console.log(mode, names.length, 'screenshots', errors.length ? errors : '(no page errors)');
    await browser.close();
  }
})();
