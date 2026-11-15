const { launch } = require('./harness.js');
(async () => {
  const { browser, page, errors } = await launch();
  await page.goto('http://localhost:8765/login.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window.VELTRIXA_CONFIG.MOCK_DELAY_MS = 0; });
  const res = await page.evaluate(async () => {
    const out = [];
    const call = async (label, m, p, q, b, expect) => {
      const r = await MockServer.handle(m, p, q || {}, b);
      out.push({ label, status: r.status, ok: r.status === (expect || 200) || (expect === undefined && r.status === 201), msg: (r.body.message || '').slice(0, 90), data: r.body.data });
      return r;
    };
    const login = (email, password, role) => MockServer.handle('POST', '/auth/login', {}, { email, password, role });
    // the 18 endpoints from section 6 of the SRS, as the administrator
    await call('POST /auth/login', 'POST', '/auth/login', {}, { email: 'admin@veltrixa.com', password: 'admin1234', role: 'Administrator' });
    await call('GET /users/me', 'GET', '/users/me');
    await call('GET /projects', 'GET', '/projects');
    await call('POST /projects', 'POST', '/projects', {}, { name: 'SRS test project', description: 'x', startDate: '2026-11-01', deadline: '2026-12-31', status: 'Active', managerId: 1, memberIds: [3, 4] }, 201);
    const created = out[out.length - 1].data; const pid = created.id;
    await call('GET /projects/{id}', 'GET', '/projects/' + pid);
    await call('PUT /projects/{id}', 'PUT', '/projects/' + pid, {}, { name: 'SRS test project v2', description: 'y', startDate: '2026-11-01', deadline: '2026-12-31', status: 'Active', managerId: 1 });
    await call('GET /projects/{id}/members', 'GET', '/projects/' + pid + '/members');
    await call('POST /projects/{id}/members', 'POST', '/projects/' + pid + '/members', {}, { memberId: 8 }, 201);
    await call('POST /projects/{id}/tasks', 'POST', '/projects/' + pid + '/tasks', {}, { title: 'First task', description: '', assigneeId: 3, priority: 'High', deadline: '2026-11-20', status: 'To Do' }, 201);
    const tid = out[out.length - 1].data.id;
    await call('GET /projects/{id}/tasks', 'GET', '/projects/' + pid + '/tasks');
    await call('PUT /tasks/{id}', 'PUT', '/tasks/' + tid, {}, { title: 'First task (edited)', description: 'd', projectId: pid, assigneeId: 3, priority: 'Medium', deadline: '2026-11-21', status: 'To Do' });
    await call('PATCH /tasks/{id}/status', 'PATCH', '/tasks/' + tid + '/status', {}, { status: 'In Progress' });
    await call('POST /tasks/{id}/comments', 'POST', '/tasks/' + tid + '/comments', {}, { text: 'hello' }, 201);
    await call('GET /tasks/{id}/comments', 'GET', '/tasks/' + tid + '/comments');
    await call('PATCH status -> Review', 'PATCH', '/tasks/' + tid + '/status', {}, { status: 'Review' });
    await call('POST /tasks/{id}/reviews', 'POST', '/tasks/' + tid + '/reviews', {}, { decision: 'approve', comment: 'ok' }, 201);
    await call('GET /projects/{id}/progress', 'GET', '/projects/' + pid + '/progress');
    await call('GET /admin/dashboard', 'GET', '/admin/dashboard');
    await call('POST /auth/logout', 'POST', '/auth/logout');
    // rules added in 2.1
    await login('admin@veltrixa.com', 'admin1234', 'Administrator');
    await call('assignee NOT on team -> 422', 'POST', '/projects/' + pid + '/tasks', {}, { title: 'Bad assignee', assigneeId: 10, priority: 'Low', deadline: '2026-11-20', status: 'To Do' }, 422);
    await call('deadline outside project dates -> 422', 'POST', '/projects/' + pid + '/tasks', {}, { title: 'Bad date', assigneeId: 3, priority: 'Low', deadline: '2027-03-01', status: 'To Do' }, 422);
    await call('duplicate team member -> 409', 'POST', '/projects/' + pid + '/members', {}, { memberId: 8 }, 409);
    await call('remove member with open task -> 409', 'POST', '/projects/' + pid + '/tasks', {}, { title: 'Open one', assigneeId: 8, priority: 'Low', deadline: '2026-11-25', status: 'To Do' }, 201);
    await call('  ...then DELETE member -> 409', 'DELETE', '/projects/' + pid + '/members/8', {}, undefined, 409);
    await call('remove manager -> 409', 'DELETE', '/projects/' + pid + '/members/1', {}, undefined, 409);
    await call('remove idle member (4) -> 200', 'DELETE', '/projects/' + pid + '/members/4');
    await call('GET /reviews (decisions list)', 'GET', '/reviews');
    await call('GET /admin/activities', 'GET', '/admin/activities', { size: 5 });
    await call('progress with bad dates -> 422', 'GET', '/projects/' + pid + '/progress', { from: '2026-12-01', to: '2026-11-01' }, undefined, 422);
    // roles
    await login('priya@example.com', 'demo1234', 'Team Member');
    await call('TM: add project member -> 403', 'POST', '/projects/' + pid + '/members', {}, { memberId: 5 }, 403);   // Priya is on this project, so she can see it but not change its team
    await call('TM: GET /reviews -> 403', 'GET', '/reviews', {}, undefined, 403);
    await call('TM: GET /admin/dashboard -> 403', 'GET', '/admin/dashboard', {}, undefined, 403);
    await call('TM: GET /admin/activities -> 403', 'GET', '/admin/activities', {}, undefined, 403);
    await call('TM: project 1 members (no emails)', 'GET', '/projects/1/members');
    await call('TM: project 9 (she is on it) -> 200', 'GET', '/projects/9');
    await call('TM: project 6 (not on it) -> 404', 'GET', '/projects/6', {}, undefined, 404);
    await login('athiqa@example.com', 'demo1234', 'Project Manager');
    await call('PM: add member to project she does NOT manage (2) -> 403', 'POST', '/projects/2/members', {}, { memberId: 9 }, 403);
    await call('PM: add member to her own project (1) -> 201', 'POST', '/projects/1/members', {}, { memberId: 13 }, 201);
    await call('PM: GET /admin/dashboard -> 403', 'GET', '/admin/dashboard', {}, undefined, 403);
    return out;
  });
  let fail = 0;
  for (const r of res) { if (!r.ok) fail++; console.log((r.ok ? 'PASS' : 'FAIL'), String(r.status).padEnd(4), r.label.padEnd(52), r.msg); }
  const pm = res.find(r => r.label === 'TM: project 1 members (no emails)');
  console.log('TM team rows have email?', pm.data.some(x => 'email' in x));
  const prog = res.find(r => r.label === 'GET /projects/{id}/progress').data;
  console.log('progress payload:', JSON.stringify({ progress: prog.progress, summary: prog.summary }));
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED', '| page errors:', errors.length ? errors : 'none');
  await browser.close();
})();
