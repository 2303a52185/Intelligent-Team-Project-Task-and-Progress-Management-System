const { launch, signIn, pageUrl } = require('./harness.js');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); };
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => { window.VELTRIXA_CONFIG = window.VELTRIXA_CONFIG || {}; });
  const settle = async () => { await page.waitForTimeout(450); };
  const go = async name => { await page.goto(pageUrl(name)); await page.waitForSelector('#pageContent > *'); await settle(); };
  const text = sel => page.locator(sel).first().innerText();

  // ---- project manager ----
  await signIn(page, 'Project Manager');
  await page.waitForTimeout(600);
  check('no "session ended" toast right after sign-in', (await page.locator('#toastArea .toast').count()) === 0);
  const cards = await page.locator('#pageContent .stats-grid .stat-card').allInnerTexts();
  check('PM dashboard shows 6 cards', cards.length === 6, cards.map(c => c.split('\n')[0]).join(' | '));
  check('dashboard has Completed projects card', cards.some(c => /Completed projects/i.test(c)));
  await page.click('#mainNav [data-page=projects]'); await settle();
  await page.fill('[data-filter="projects:q"]', 'FoodFinder'); await settle();
  await page.click('[data-act=open-project][data-id="1"] >> nth=0'); await settle();
  check('project detail opens (address ends #project-1)', (await page.evaluate(() => location.hash)) === '#project-1');
  await page.goto(pageUrl('project-1')); await page.waitForSelector('[data-project-tab]');
  check('projects.html#project-1 opens the detail screen directly', /FoodFinder/.test(await text('.project-title')));
  await page.click('[data-act=back-projects]'); await settle();
  check('back to the list clears the hash', (await page.evaluate(() => location.hash)) === '');
  await page.fill('[data-filter="projects:q"]', 'FoodFinder'); await settle();
  await page.click('[data-act=open-project][data-id="1"] >> nth=0'); await settle();
  check('overview facts rendered', /PROJECT MANAGER/.test(await text('#projectTabBody')));
  await page.click('[data-project-tab=team]'); await settle();
  const teamBefore = await page.locator('#projectTabBody tbody tr').count();
  check('team tab lists manager + members', teamBefore >= 5, teamBefore + ' rows');
  check('manager has no Remove button', (await page.locator('#projectTabBody tr:has-text("Manager") [data-act=remove-project-member]').count()) === 0);
  await page.selectOption('#teamCandidate', { index: 1 });
  await page.click('[data-act=add-project-member]'); await settle();
  const teamAfter = await page.locator('#projectTabBody tbody tr').count();
  check('add person to project team', teamAfter === teamBefore + 1, teamBefore + ' -> ' + teamAfter);
  // removing asks for confirmation
  await page.click('#projectTabBody [data-act=remove-project-member] >> nth=-1'); await page.waitForSelector('#confirmModal.show');
  check('removing a person asks for confirmation', /Remove from project/.test(await text('#confirmModal .modal-title')));
  await page.click('#confirmModal [data-bs-dismiss=modal] >> nth=1'); await page.waitForSelector('#confirmModal', { state: 'hidden' });
  check('cancel keeps the person', (await page.locator('#projectTabBody tbody tr').count()) === teamAfter);
  // tasks tab, a new task can only go to the team
  await page.click('[data-project-tab=tasks]'); await settle();
  check('project tasks tab lists tasks', (await page.locator('#projectTasksResults tbody tr').count()) > 0);
  await page.click('[data-act=add-project-task]'); await page.waitForSelector('#recordModal.show'); await page.waitForTimeout(500);
  const opts = await page.locator('#taskAssignee option').allInnerTexts();
  check('assignee list = project team only', opts.length === teamAfter, opts.length + ' options vs team ' + teamAfter);
  check('project is locked in the form', (await page.locator('#recordModal input[disabled]').count()) === 1);
  const hint = await text('#deadlineHint');
  check('deadline hint shows project dates', /project dates/i.test(hint), hint);
  const minmax = await page.evaluate(() => { const d = document.getElementById('taskDeadline'); return [d.min, d.max]; });
  check('date picker limited to project dates', minmax[0] === '2026-10-20' && minmax[1] === '2026-11-30', minmax.join(' .. '));
  await page.fill('#recordForm [name=title]', 'Browser test task');
  await page.evaluate(() => { const d = document.getElementById('taskDeadline'); d.removeAttribute('min'); d.removeAttribute('max'); d.value = '2027-05-01'; });
  await page.click('#recordSave'); await page.waitForTimeout(700);
  const err = await text('#formError');
  check('deadline outside project dates is rejected', /project dates/.test(err), err);
  await page.fill('#taskDeadline', '2026-11-25'); await page.click('#recordSave'); await settle();
  check('valid task is created', await page.locator('#recordModal.show').count() === 0);
  check('new task appears in project tasks', /Browser test task/.test(await text('#projectTasksResults')));
  // editing a project asks for confirmation
  await page.click('[data-project-tab=overview]'); await settle();
  await page.click('[data-act=edit-project]'); await page.waitForSelector('#recordModal.show'); await page.waitForTimeout(400);
  await page.fill('#recordForm [name=description]', 'Edited in the browser test');
  await page.click('#recordSave'); await page.waitForSelector('#confirmModal.show');
  check('saving an edit asks for confirmation', /Save changes/.test(await text('#confirmModal .modal-title')));
  await page.click('#confirmModal [data-confirm-yes]'); await page.waitForSelector('#confirmModal', { state: 'hidden' }); await settle();
  check('edit saved after confirming', /Edited in the browser test/.test(await text('#pageContent')));
  // progress tab
  await page.click('[data-project-tab=progress]'); await settle();
  const pt = await text('#projectProgressResults');
  check('progress tab shows backend percentage and team summary', /Project completion/.test(pt) && /Team-wise summary/.test(pt));
  await page.fill('#projectProgressForm [name=from]', '2026-12-01'); await page.fill('#projectProgressForm [name=to]', '2026-11-01');
  await page.click('#projectProgressForm [type=submit]'); await settle();
  check('progress date filter validates range', /end date cannot be earlier/.test(await text('#projectProgressResults')));
  // new project with a starting team
  await page.click('[data-act=back-projects]'); await settle();
  await page.fill('[data-filter="projects:q"]', ''); await settle();
  await page.click('#topAction'); await page.waitForSelector('#recordModal.show'); await page.waitForTimeout(300);
  check('create-project form offers team checkboxes', (await page.locator('#recordForm [name=memberIds]').count()) > 5);
  await page.fill('#recordForm [name=name]', 'Team from start'); await page.fill('#recordForm [name=deadline]', '2027-01-31');
  await page.check('#recordForm [name=memberIds] >> nth=0'); await page.check('#recordForm [name=memberIds] >> nth=1');
  await page.click('#recordSave'); await settle();
  check('project created (no confirm for new records)', await page.locator('#confirmModal.show').count() === 0 && /Team from start/.test(await text('#projectsResults')));
  await page.click('tr:has-text("Team from start") [data-act=open-project] >> nth=0'); await settle();
  await page.click('[data-project-tab=team]'); await settle();
  check('chosen team is on the new project (manager + 2)', (await page.locator('#projectTabBody tbody tr').count()) === 3);
  // team page task counts
  await page.click('#mainNav [data-page=team]'); await settle();
  check('team page shows task summary chips', (await page.locator('.member-card .chip-stat').count()) >= 8);

  // ---- team leader: review decisions ----
  await signIn(page, 'Team Leader');
  await page.click('#mainNav [data-page=approvals]'); await settle();
  check('approvals has two tabs', (await page.locator('[data-approvals-tab]').count()) === 2);
  await page.click('[data-approvals-tab=decisions]'); await settle();
  const decisions = await page.locator('#reviewsResults .approval-item').count();
  check('recent decisions list has rows', decisions >= 6, decisions + ' rows');
  check('decisions show Approved and Changes requested', /Approved/.test(await text('#reviewsResults')) && /Changes requested/.test(await text('#reviewsResults')));
  await page.selectOption('[data-filter="reviews:decision"]', 'changes'); await settle();
  check('decision filter works', (await page.locator('#reviewsResults .approval-item').count()) === 2);

  // ---- administrator: activity log ----
  await signIn(page, 'Administrator');
  check('admin nav has Activity log', (await page.locator('#mainNav [data-page=activity]').count()) === 1);
  await page.click('#mainNav [data-page=activity]'); await settle();
  const rows1 = await page.locator('#activitiesResults tbody tr').count();
  check('activity log is paginated (12/page)', rows1 === 12 && (await page.locator('#activitiesResults .pagination').count()) === 1, rows1 + ' rows');
  await page.click('#activitiesResults [data-page="2"]'); await settle();
  check('page 2 loads', /Showing 13/.test(await text('#activitiesResults .pagination-bar')));
  await page.selectOption('[data-filter="activities:projectId"]', '1'); await settle();
  const projectRows = await page.locator('#activitiesResults tbody tr').allInnerTexts();
  check('project filter works', projectRows.length > 0 && projectRows.every(r => /FoodFinder/.test(r)), projectRows.length + ' rows');
  await page.fill('[data-filter="activities:q"]', 'zzzznothing'); await settle();
  check('search with no match shows empty state', /No activity matches/.test(await text('#activitiesResults')));

  // ---- team member: board confirmation, 6 cards, no activity page ----
  await signIn(page, 'Team Member');
  const tmCards = await page.locator('#pageContent .stats-grid .stat-card').count();
  check('TM dashboard shows 6 cards', tmCards === 6);
  check('TM has no Activity log link', (await page.locator('#mainNav [data-page=activity]').count()) === 0);
  await page.goto(pageUrl('activity')); await page.waitForURL('**/dashboard.html'); check('TM typing the activity page address is sent to the dashboard', /dashboard\.html/.test(page.url()));
  await page.goto(pageUrl('reports')); await page.waitForURL('**/dashboard.html'); check('TM is also kept out of reports.html', /dashboard\.html/.test(page.url()));
  await page.click('#mainNav [data-page=board]'); await settle();
  const sel = page.locator('.board-column:has-text("IN PROGRESS") select[data-status-task]').first();
  const tid = await sel.getAttribute('data-status-task');
  await sel.selectOption('Review'); await page.waitForSelector('#confirmModal.show');
  check('moving a card to Review asks for confirmation', /Change task status/.test(await text('#confirmModal .modal-title')));
  await page.click('#confirmModal [data-bs-dismiss=modal] >> nth=1'); await page.waitForSelector('#confirmModal', { state: 'hidden' }); await settle();
  check('cancelling leaves the card in place', (await page.locator(`.board-column:has-text("IN PROGRESS") [data-status-task="${tid}"]`).count()) === 1);
  await page.locator(`[data-status-task="${tid}"]`).selectOption('Review'); await page.waitForSelector('#confirmModal.show');
  await page.click('#confirmModal [data-confirm-yes]'); await page.waitForSelector('#confirmModal', { state: 'hidden' }); await settle();
  check('confirming moves the card', (await page.locator(`.board-column:has-text("REVIEW") [data-status-task="${tid}"]`).count()) === 1);
  // task details: comments come from GET /tasks/{id}/comments
  await page.click(`[data-act=task-detail][data-id="${tid}"] >> nth=0`); await page.waitForSelector('#detailModal.show'); await page.waitForTimeout(500);
  await page.click('#detailBody [data-tab=comments]');
  await page.fill('#commentForm [name=comment]', 'Comment from the browser test'); await page.click('#commentForm button'); await page.waitForTimeout(900);
  check('comment is added and listed', /Comment from the browser test/.test(await text('#detailBody')) && /Comments \(1\)|Comments \(\d+\)/.test(await text('#detailBody .nav-tabs')));

  console.log('\n' + (fail ? fail + ' FAILED' : 'ALL ' + pass + ' PASSED'), '| page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
