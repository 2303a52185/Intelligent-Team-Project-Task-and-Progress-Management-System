/* Veltrixa main script.
   All data goes through Api (api.js). In demo mode Api talks to the mock server,
   with the real backend it uses fetch. Nothing is stored in this file. */
const { esc, attr, num, date, dateTime, pill, priorityPill, options, setBusy, toast } = UI;
const CFG = Api.config;
const BOOT = document.body.dataset;               // each page sets data-page (which module it is) and data-mode
// every module is its own page, so links between modules are normal links. JSP pages set data-page-ext=".jsp"
const pageUrl = p => p + (BOOT.pageExt || ".html");
const loginUrl = () => BOOT.loginUrl || pageUrl("login");
const dashboardUrl = () => BOOT.dashboardUrl || pageUrl("dashboard");
const STATUSES = ["To Do", "In Progress", "Review", "Completed"];

// sidebar links, only shown if the role is allowed to open the page
const NAV = [
    ["dashboard", "▦", "Dashboard"], ["projects", "▣", "Projects"], ["team", "♧", "Team members"],
    ["tasks", "✓", "Task management"], ["board", "▤", "Task board"], ["reports", "▥", "Progress reports"],
    ["approvals", "◎", "Review & approvals"], ["admin", "⚙", "Administration"], ["activity", "◷", "Activity log"]
];
const PAGE_INFO = {
    dashboard: ["Dashboard", "Your workspace at a glance."],
    projects: ["Projects", "Create, update and track your projects."],
    team: ["Team members", "Manage the people working across your projects."],
    tasks: ["Task management", "Create tasks, assign owners and set priorities."],
    board: ["Task board", "Track work as it moves through each stage."],
    reports: ["Progress reports", "Understand project completion and team performance."],
    approvals: ["Review & approvals", "Review submitted work and provide feedback."],
    admin: ["Administration", "System statistics, users and roles."],
    activity: ["Activity log", "Everything that happened across all projects."]
};
const ROLE_DASHBOARD_TEXT = {
    "Administrator": "System overview across all projects and people.",
    "Project Manager": "The projects you manage and what needs your attention.",
    "Team Leader": "Your team's workload and work waiting for review.",
    "Team Member": "Your own tasks, deadlines and feedback."
};

const state = {
    user: null, page: "dashboard", renderToken: 0, lookups: null, items: { project: {}, member: {}, task: {} },
    editing: null, dirty: false, lastReport: null,
    projectId: null, projectTab: "overview", currentProject: null,          // project details screen
    approvalsTab: "queue", comments: [],
    report: { tab: "progress", from: "", to: "", projectId: "" },
    projectProgress: { from: "", to: "" },
    lists: {
        projects: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, q: "", status: "", sort: "" },
        members: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, q: "", role: "", sort: "" },
        tasks: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, q: "", projectId: "", status: "", priority: "", assigneeId: "", deadlineFrom: "", deadlineTo: "", overdue: "", sort: "" },
        approvals: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, status: "Review" },
        reviews: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, decision: "", projectId: "" },
        projectTasks: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, q: "", status: "", priority: "", sort: "" },
        activities: { page: 1, size: 12, q: "", projectId: "", from: "", to: "" },
        adminUsers: { page: 1, size: CFG.DEFAULT_PAGE_SIZE, q: "", role: "", sort: "" }
    },
    boardProject: ""
};
const can = action => Permissions.can(state.user.role, action);
const content = () => document.getElementById("pageContent");
const on = (id, evt, fn) => document.getElementById(id)?.addEventListener(evt, fn);

// ---- start up ----
document.addEventListener("DOMContentLoaded", async () => {
    const today = document.getElementById("todayLabel");
    if (today) today.textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
    Api.onLoading(UI.setTopLoading);
    Api.onUnauthorized(() => { toast("Your session has ended. Please sign in again.", "warning"); leaveApp(); });

    on("loginForm", "submit", login);
    on("registerForm", "submit", registerUser);
    document.querySelectorAll("[data-demo-email]").forEach(b => b.addEventListener("click", () => fillDemo(b)));

    if (BOOT.mode === "auth") return;                       // login and register pages only need their forms

    on("logoutButton", "click", logout);
    on("topAction", "click", () => openForm(document.getElementById("topAction").dataset.type));
    on("recordForm", "submit", saveRecord);
    on("pageContent", "click", pageAction);
    on("pageContent", "change", pageChange);
    on("pageContent", "input", UI.debounce(pageInput, 300));
    on("pageContent", "dragstart", e => { const c = e.target.closest("[data-drag-task]"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.dragTask); c.classList.add("dragging"); } });
    on("pageContent", "dragend", e => e.target.closest?.("[data-drag-task]")?.classList.remove("dragging"));
    on("pageContent", "dragover", e => { const col = e.target.closest("[data-drop-status]"); if (col) { e.preventDefault(); col.classList.add("drop-target"); } });
    on("pageContent", "dragleave", e => e.target.closest?.("[data-drop-status]")?.classList.remove("drop-target"));
    on("pageContent", "drop", e => { const col = e.target.closest("[data-drop-status]"); if (!col) return; e.preventDefault(); col.classList.remove("drop-target"); moveTask(Number(e.dataTransfer.getData("text/plain")), col.dataset.dropStatus); });
    on("detailBody", "click", detailAction);
    on("detailBody", "submit", detailSubmit);
    on("detailBody", "change", detailChange);
    document.getElementById("detailModal")?.addEventListener("hidden.bs.modal", () => { if (state.dirty) { state.dirty = false; renderPage(state.page, true); } });

    // only the project screen uses the hash (#project-3), so the back button goes between the list and the details
    window.addEventListener("hashchange", () => {
        if (!state.user || state.page !== "projects") return;
        const t = parseHash(location.hash.slice(1));
        if (t.projectId !== state.projectId) { state.projectId = t.projectId; renderPage("projects"); }
    });

    // projects.html#project-3 opens the details of project 3, other pages ignore the hash
    const first = BOOT.page === "projects" && /^#project-\d+$/.test(location.hash) ? location.hash.slice(1) : BOOT.page;
    if (BOOT.mode === "app") {                              // JSP page: the Java session already knows the user
        startApp({ id: Number(BOOT.userId), name: BOOT.userName, email: BOOT.userEmail, role: BOOT.userRole }, first);
    } else {                                                // demo page: ask the server who is logged in, if nobody is go to the login page
        try { startApp((await Api.me()).data, first); } catch (e) { location.replace(loginUrl()); }
    }
});

// "#projects" is the list, "#project-3" is the details of project 3
function parseHash(h) { const m = /^project-(\d+)$/.exec(h); return m ? { page: "projects", projectId: Number(m[1]) } : { page: h, projectId: null }; }

function startApp(user, page) {
    state.user = user;
    const target = parseHash(page || "dashboard");
    state.projectId = target.projectId;
    page = target.page;
    document.getElementById("sidebarUser").textContent = user.name;
    document.getElementById("sidebarRole").textContent = user.role;
    document.getElementById("roleChip").textContent = user.role;
    document.querySelector(".sidebar-user .avatar").textContent = user.name.charAt(0).toUpperCase();
    document.getElementById("mainNav").innerHTML = NAV.filter(([p]) => Permissions.canViewPage(user.role, p)).map(([p, icon, label]) =>
        `<a class="nav-link" href="${pageUrl(p)}" data-page="${p}"><span>${icon}</span> ${label}</a>`).join("");
    document.querySelector(".brand")?.setAttribute("href", pageUrl("dashboard"));
    document.getElementById("app").classList.remove("d-none");
    renderPage(page || "dashboard");
}

// ---- login and register ----
function setAuthMessage(id, message, type) {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = message;
    box.classList.remove("success", "error");
    if (message) box.classList.add(type);
}
function fillDemo(button) {
    document.getElementById("loginEmail").value = button.dataset.demoEmail;
    document.getElementById("loginPassword").value = button.dataset.demoPassword;
    document.getElementById("loginRole").value = button.dataset.demoRole;
    setAuthMessage("loginError", "", "");
}

async function login(e) {
    e.preventDefault();
    const button = e.target.querySelector("button[type=submit]");
    const payload = { email: document.getElementById("loginEmail").value.trim().toLowerCase(), password: document.getElementById("loginPassword").value, role: document.getElementById("loginRole").value };
    if (!payload.role) { setAuthMessage("loginError", "Please select your role to continue.", "error"); return; }
    setAuthMessage("loginError", "", "");
    setBusy(button, true, "Signing in…");
    try {
        const res = await Api.login(payload);
        Api.saveToken(res.data.token);
        location.href = dashboardUrl();
    } catch (err) { setAuthMessage("loginError", err.message, "error"); }
    finally { setBusy(button, false); }
}

async function registerUser(e) {
    e.preventDefault();
    const button = e.target.querySelector("button[type=submit]");
    const v = id => document.getElementById(id).value;
    if (v("registerPassword").length < 6) { setAuthMessage("registerError", "Password must contain at least 6 characters.", "error"); return; }
    if (v("registerPassword") !== v("confirmPassword")) { setAuthMessage("registerError", "The passwords do not match.", "error"); return; }
    setBusy(button, true, "Creating account…");
    try {
        const res = await Api.register({ name: v("registerName").trim(), email: v("registerEmail").trim().toLowerCase(), role: v("registerRole"), password: v("registerPassword") });
        document.getElementById("registerForm").reset();
        setAuthMessage("registerError", res.message, "success");
        setTimeout(() => { location.href = loginUrl(); }, 1200);
    } catch (err) { setAuthMessage("registerError", err.message, "error"); }
    finally { setBusy(button, false); }
}

async function logout() { try { await Api.logout(); } catch (e) { /* leave anyway */ } leaveApp(); }
function leaveApp() {
    Api.saveToken(null);
    state.user = null; state.lookups = null;
    location.href = loginUrl();
}

// ---- page shell ----
async function renderPage(page, quiet) {
    if (!state.user) return;
    if (!PAGE_INFO[page]) page = "dashboard";
    if (page !== "projects") state.projectId = null;
    if (!Permissions.canViewPage(state.user.role, page)) { location.replace(dashboardUrl()); return; }   // this role can't open this page
    state.page = page;
    history.replaceState(null, "", location.pathname + location.search + (page === "projects" && state.projectId ? "#project-" + state.projectId : ""));
    const token = ++state.renderToken;
    document.querySelectorAll("#mainNav .nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === page));
    document.getElementById("pageHeading").textContent = PAGE_INFO[page][0];
    document.getElementById("pageSubheading").textContent = page === "dashboard" ? ROLE_DASHBOARD_TEXT[state.user.role]
        : page === "projects" && state.projectId ? "Project details, team, tasks and progress." : PAGE_INFO[page][1];
    const top = document.getElementById("topAction");
    const action = { projects: ["project", "project.create", "+ New project"], tasks: ["task", "task.create", "+ New task"], team: ["member", "member.add", "+ Add member"] }[page];
    top.classList.toggle("d-none", !(action && can(action[1])) || (page === "projects" && !!state.projectId));
    if (action) { top.dataset.type = action[0]; top.textContent = action[2]; }
    if (!quiet) content().innerHTML = UI.loadingBlock("Loading " + PAGE_INFO[page][0].toLowerCase() + "…");
    try {
        const html = await VIEWS[page]();
        if (token !== state.renderToken) return;            // the user already moved to another page
        content().innerHTML = html;
        if (AFTER_RENDER[page]) AFTER_RENDER[page]();
    } catch (err) {
        if (token === state.renderToken) content().innerHTML = errorBlock(err.message);
    }
}
const errorBlock = message => `<div class="panel error-panel"><strong>We could not load this page.</strong><p class="mb-3">${esc(message)}</p><button class="btn btn-sm btn-primary" data-act="reload">Try again</button></div>`;

async function getLookups() {
    if (!state.lookups) state.lookups = (await Api.lookups()).data;
    return state.lookups;
}
const panel = (title, sub, body, actions = "") => `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${actions}</div>${body}</div>`;
const statCard = (label, value, icon, help) => `<article class="stat-card"><span class="stat-icon">${icon}</span><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div><div class="stat-help">${esc(help)}</div></article>`;

// ---- pages ----
const VIEWS = {
    async dashboard() {
        const d = (await Api.dashboard()).data, c = d.counts, role = state.user.role;
        // cards from the SRS: total, active and completed projects, my tasks, overdue, waiting for approval
        const scope = { "Administrator": "All projects", "Project Manager": "Projects you manage", "Team Leader": "All projects", "Team Member": "Projects you work on" }[role];
        const awaitingHelp = { "Administrator": "Need a reviewer", "Project Manager": "Ready to approve", "Team Leader": "Submitted by members", "Team Member": "Your tasks waiting for a decision" }[role];
        const cards = [
            ["Total projects", c.totalProjects, "▣", scope],
            ["Active projects", c.activeProjects, "↗", c.onHoldProjects + " on hold"],
            ["Completed projects", c.completedProjects, "✓", "Finished and closed"],
            [role === "Team Member" ? "My open tasks" : "Tasks assigned to me", c.myOpenTasks, "☺", "Still to finish"],
            ["Overdue tasks", c.overdueTasks, "!", role === "Team Member" ? "Past their deadline" : "Need attention"],
            ["Awaiting approval", c.awaitingReview, "◎", awaitingHelp]
        ];
        const max = Math.max(1, ...d.byStatus.map(s => s.count));
        const bars = d.byStatus.map(s => barRow(s.status, s.count, max)).join("");
        const first = panel(role === "Team Member" ? "My projects" : role === "Project Manager" ? "My projects" : "Projects", "Keep track of the team's work", projectTable(d.projects), can("report.view") || role === "Team Member" ? `<button class="btn btn-sm btn-light" data-go="projects">View all</button>` : "");
        const mine = panel("My tasks", "Assigned to " + state.user.name + ", earliest deadline first", taskMiniList(d.myTasks, "Nothing assigned to you right now."));
        let extra = "";
        if (can("task.review")) extra += panel("Review queue", "Work waiting for a decision", d.reviewQueue.length ? taskMiniList(d.reviewQueue) : `<div class="empty-state">Nothing is waiting for review.</div>`, `<button class="btn btn-sm btn-light" data-go="approvals">Open reviews</button>`);
        if (role === "Administrator" || role === "Project Manager") extra += panel("Projects at risk", "Active projects with overdue tasks", d.atRisk.length ? d.atRisk.map(p => `<div class="d-flex justify-content-between py-2"><strong>${esc(p.name)}</strong><span class="badge-soft status-overdue">${p.overdue} overdue</span></div>`).join("") : `<div class="empty-state">No project has overdue tasks.</div>`);
        if (can("report.view")) extra += panel("Team workload", "Open tasks per person", d.workload.length ? d.workload.map(w => barRow(w.name, w.open, d.workload[0].open, w.overdue ? w.overdue + " overdue" : "")).join("") : `<div class="empty-state">No open tasks.</div>`);
        extra += panel("Task status", role === "Team Member" ? "Your tasks by stage" : "Tasks by stage", bars);
        const activity = `<div class="activity-grid">${d.activities.map(a => `<div class="activity-card"><strong>${esc(a.person)}</strong>${esc(a.message)}<small>${dateTime(a.at)}</small></div>`).join("")}</div>`;
        const allActivity = role === "Administrator" ? `<button class="btn btn-sm btn-light" data-go="activity">View full log</button>` : "";
        return `<div class="stats-grid three">${cards.map(x => statCard(...x)).join("")}</div>
            <div class="content-grid">${first}${mine}</div><div class="dash-extra">${extra}</div>${panel("Recent activity", "Latest workspace updates", activity, allActivity)}`;
    },

    async projects() {
        if (state.projectId) return projectDetailView();
        const f = state.lists.projects;
        const createBtn = can("project.create") ? `<button class="btn btn-primary" data-create="project">+ Create project</button>` : "";
        return panel("All projects", state.user.role === "Team Member" ? "Projects you have tasks in" : "Search, sort and manage projects",
            `<div class="toolbar"><input class="form-control" data-filter="projects:q" placeholder="Search projects or managers…" value="${attr(f.q)}" aria-label="Search projects">
            <select class="form-select" data-filter="projects:status" aria-label="Status">${options(["Active", "On Hold", "Completed"], f.status, "All statuses")}</select>
            <select class="form-select" data-filter="projects:sort" aria-label="Sort">${options([["", "Newest first"], ["name", "Name A–Z"], ["deadline", "Deadline"], ["progress", "Progress"]], f.sort)}</select></div>
            <div id="projectsResults"></div>`, createBtn);
    },

    async team() {
        const f = state.lists.members;
        const addBtn = can("member.add") ? `<button class="btn btn-primary" data-create="member">+ Add member</button>` : "";
        return panel("Team directory", "Search and filter the people in your workspace",
            `<div class="toolbar"><input class="form-control" data-filter="members:q" placeholder="Search by name or email…" value="${attr(f.q)}" aria-label="Search members">
            <select class="form-select" data-filter="members:role" aria-label="Role">${options(Permissions.ROLES, f.role, "All roles")}</select>
            <select class="form-select" data-filter="members:sort" aria-label="Sort">${options([["", "Default order"], ["name", "Name A–Z"], ["role", "Role"], ["workload", "Most open tasks"]], f.sort)}</select></div>
            <div id="membersResults"></div>`, addBtn);
    },

    async tasks() {
        const f = state.lists.tasks, lk = await getLookups(), isMember = state.user.role === "Team Member";
        const createBtn = can("task.create") ? `<button class="btn btn-primary" data-create="task">+ Create task</button>` : "";
        const advancedOpen = f.assigneeId || f.deadlineFrom || f.deadlineTo || f.overdue || f.sort;
        return panel("All tasks", isMember ? "Tasks assigned to you" : "Create, assign and track team tasks",
            `<div class="toolbar"><input class="form-control" data-filter="tasks:q" placeholder="Search title, description, project or person…" value="${attr(f.q)}" aria-label="Search tasks">
            <select class="form-select" data-filter="tasks:projectId" aria-label="Project">${options(lk.projects.map(p => [p.id, p.name]), f.projectId, "All projects")}</select>
            <select class="form-select" data-filter="tasks:status" aria-label="Status">${options(STATUSES, f.status, "All statuses")}</select>
            <select class="form-select" data-filter="tasks:priority" aria-label="Priority">${options(["High", "Medium", "Low"], f.priority, "All priorities")}</select>
            <button class="btn btn-light" type="button" data-bs-toggle="collapse" data-bs-target="#moreFilters" aria-expanded="${!!advancedOpen}">More filters</button></div>
            <div class="collapse ${advancedOpen ? "show" : ""}" id="moreFilters"><div class="toolbar advanced">
            ${isMember ? "" : `<select class="form-select" data-filter="tasks:assigneeId" aria-label="Assignee">${options(lk.members.map(m => [m.id, m.name]), f.assigneeId, "Any assignee")}</select>`}
            <label class="date-filter">Deadline from <input class="form-control" type="date" data-filter="tasks:deadlineFrom" value="${attr(f.deadlineFrom)}"></label>
            <label class="date-filter">to <input class="form-control" type="date" data-filter="tasks:deadlineTo" value="${attr(f.deadlineTo)}"></label>
            <select class="form-select" data-filter="tasks:sort" aria-label="Sort">${options([["", "Newest first"], ["deadline", "Deadline (soonest)"], ["-deadline", "Deadline (latest)"], ["priority", "Priority"], ["title", "Title A–Z"], ["status", "Status"]], f.sort)}</select>
            <label class="form-check"><input class="form-check-input" type="checkbox" data-filter="tasks:overdue" ${f.overdue ? "checked" : ""}> <span class="form-check-label">Overdue only</span></label>
            <button class="btn btn-sm btn-light" data-clear="tasks">Clear filters</button></div></div>
            <div id="tasksResults"></div>`, createBtn);
    },

    async board() {
        const lk = await getLookups();
        return `<div class="board-toolbar"><select class="form-select" data-board-project aria-label="Project">${options(lk.projects.map(p => [p.id, p.name]), state.boardProject, "All projects")}</select>
            <small class="text-secondary">${state.user.role === "Team Member" ? "You can move your own tasks up to Review. A reviewer completes them." : "Drag a card to another column, or use its menu."}</small></div>
            <div id="boardResults">${UI.loadingBlock()}</div>`;
    },

    async reports() {
        const r = state.report, lk = await getLookups();
        return `<div class="panel"><form class="report-filters" id="reportForm">
            <div class="btn-group" role="group" aria-label="Report type">
              <button type="button" class="btn ${r.tab === "progress" ? "btn-primary" : "btn-light"}" data-report-tab="progress">Project progress</button>
              <button type="button" class="btn ${r.tab === "team" ? "btn-primary" : "btn-light"}" data-report-tab="team">Team performance</button></div>
            <label>From <input class="form-control" type="date" name="from" value="${attr(r.from)}"></label>
            <label>To <input class="form-control" type="date" name="to" value="${attr(r.to)}"></label>
            <label>Project <select class="form-select" name="projectId">${options(lk.projects.map(p => [p.id, p.name]), r.projectId, "All projects")}</select></label>
            <button class="btn btn-primary" type="submit">Apply</button><button class="btn btn-light" type="button" data-act="report-reset">Reset</button>
            <button class="btn btn-light" type="button" data-act="report-csv">Export CSV</button><button class="btn btn-light" type="button" onclick="window.print()">Print</button>
            </form><small class="text-secondary">Tasks are included when their deadline falls inside the selected dates.</small></div><div id="reportResults">${UI.loadingBlock()}</div>`;
    },

    async approvals() {
        const tabs = `<div class="btn-group mb-3" role="group" aria-label="Review views">
            <button type="button" class="btn ${state.approvalsTab === "queue" ? "btn-primary" : "btn-light"}" data-approvals-tab="queue">Awaiting review</button>
            <button type="button" class="btn ${state.approvalsTab === "decisions" ? "btn-primary" : "btn-light"}" data-approvals-tab="decisions">Recent decisions</button></div>`;
        if (state.approvalsTab === "queue") return panel("Tasks awaiting review", "Approve completed work or send it back with comments", tabs + `<div id="approvalsResults"></div>`);
        const f = state.lists.reviews, lk = await getLookups();
        return panel("Recent review decisions", "Every approval and change request, newest first", tabs +
            `<div class="toolbar"><select class="form-select" data-filter="reviews:decision" aria-label="Decision">${options([["approve", "Approved"], ["changes", "Changes requested"]], f.decision, "All decisions")}</select>
            <select class="form-select" data-filter="reviews:projectId" aria-label="Project">${options(lk.projects.map(p => [p.id, p.name]), f.projectId, "All projects")}</select></div><div id="reviewsResults"></div>`);
    },

    async activity() {
        const f = state.lists.activities, lk = await getLookups();
        return panel("Project activity log", "Search everything that happened across all projects",
            `<div class="toolbar"><input class="form-control" data-filter="activities:q" placeholder="Search people, projects or actions…" value="${attr(f.q)}" aria-label="Search activity">
            <select class="form-select" data-filter="activities:projectId" aria-label="Project">${options(lk.projects.map(p => [p.id, p.name]), f.projectId, "All projects")}</select>
            <label class="date-filter">From <input class="form-control" type="date" data-filter="activities:from" value="${attr(f.from)}"></label>
            <label class="date-filter">to <input class="form-control" type="date" data-filter="activities:to" value="${attr(f.to)}"></label>
            <button class="btn btn-sm btn-light" data-clear="activities">Clear</button></div><div id="activitiesResults"></div>`);
    },

    async admin() {
        const s = (await Api.adminDashboard()).data, f = state.lists.adminUsers;
        const dist = (title, rows) => { const max = Math.max(1, ...rows.map(r => r.count)); return `<div class="panel"><h2 class="fs-6 mb-3">${esc(title)}</h2>${rows.map(r => barRow(r.label, r.count, max)).join("")}</div>`; };
        return `<div class="stats-grid">${statCard("Users", s.users, "♧", "Registered accounts")}${statCard("Projects", s.projects, "▣", s.activeProjects + " active · " + s.completedProjects + " completed")}${statCard("Tasks", s.tasks, "✓", s.overdueTasks + " overdue")}${statCard("Awaiting review", s.awaitingReview, "◎", "Need reviewer action")}</div>
            <div class="stats-grid">${statCard("Comments", s.comments, "✎", "Across all tasks")}${statCard("Attachments", s.attachments, "⎘", "Files on tasks")}${statCard("Activity", s.activityLast7Days, "↗", "Events in the last 7 days")}${statCard("Data source", "", "⚙", s.system.dataSource)}</div>
            <div class="dist-grid">${dist("Users by role", s.usersByRole)}${dist("Projects by status", s.projectsByStatus)}${dist("Tasks by status", s.tasksByStatus)}${dist("Tasks by priority", s.tasksByPriority)}</div>
            ${panel("User and role management", "Change a person's role or open the team page to add and remove members",
                `<div class="toolbar"><input class="form-control" data-filter="adminUsers:q" placeholder="Search users…" value="${attr(f.q)}" aria-label="Search users"><select class="form-select" data-filter="adminUsers:role" aria-label="Role">${options(Permissions.ROLES, f.role, "All roles")}</select></div><div id="adminUsersResults"></div>`,
                `<button class="btn btn-light" data-go="activity">Open activity log</button> <button class="btn btn-primary" data-go="team">Manage members</button>`)}
            <p class="small text-secondary">Role permissions are enforced again by the Java backend. This screen only hides what a role may not use.</p>`;
    }
};
const barRow = (label, value, max, note = "") => `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="progress flex-grow-1"><div class="progress-bar" style="width:${max ? value / max * 100 : 0}%"></div></div><strong>${value}</strong>${note ? `<small class="text-danger">${esc(note)}</small>` : ""}</div>`;

// after the page is shown, load the lists inside it
const AFTER_RENDER = {
    projects: () => state.projectId ? loadProjectTab() : refresh("projects"), team: () => refresh("members"), tasks: () => refresh("tasks"),
    approvals: () => refresh(state.approvalsTab === "queue" ? "approvals" : "reviews"), board: () => refreshBoard(), reports: () => loadReport(),
    admin: () => refresh("adminUsers"), activity: () => refresh("activities")
};

// ---- lists with pages ----
const LISTS = {
    projects: { box: "projectsResults", fetch: q => Api.listProjects(q), render: projectTable, cache: "project" },
    members: { box: "membersResults", fetch: q => Api.listMembers(q), render: memberCards, cache: "member" },
    tasks: { box: "tasksResults", fetch: q => Api.listTasks(q), render: taskTable, cache: "task" },
    approvals: { box: "approvalsResults", fetch: q => Api.listTasks(q), render: approvalItems, cache: "task" },
    reviews: { box: "reviewsResults", fetch: q => Api.listReviews(q), render: reviewItems },
    projectTasks: { box: "projectTasksResults", fetch: q => Api.listProjectTasks(state.projectId, q), render: taskTable, cache: "task" },
    activities: { box: "activitiesResults", fetch: q => Api.adminActivities(q), render: activityTable },
    adminUsers: { box: "adminUsersResults", fetch: q => Api.listMembers(q), render: adminUserTable, cache: "member" }
};
let listRequest = 0;
async function refresh(key) {
    const def = LISTS[key], box = document.getElementById(def.box);
    if (!box) return;
    const mine = ++listRequest;
    box.classList.add("is-loading");
    if (!box.innerHTML) box.innerHTML = UI.loadingBlock();
    try {
        const res = await def.fetch(state.lists[key]);
        if (mine !== listRequest) return;                    // a newer search already replaced this one
        if (def.cache) res.data.forEach(x => { state.items[def.cache][x.id] = x; });
        box.innerHTML = def.render(res.data) + UI.paginationHtml(key, res.pagination);
    } catch (err) { if (mine === listRequest) box.innerHTML = errorBlock(err.message); }
    box.classList.remove("is-loading");
}

function projectTable(items) {
    if (!items.length) return `<div class="empty-state">No projects found.${can("project.create") ? " Create your first project." : ""}</div>`;
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>PROJECT</th><th>MANAGER</th><th>STATUS</th><th>PROGRESS</th><th>DEADLINE</th><th>ACTIONS</th></tr></thead><tbody>${items.map(p => `<tr><td><button class="link-button strong-text text-start" data-act="open-project" data-id="${p.id}">${esc(p.name)}</button><div class="text-secondary small">${esc(p.description || "")}${p.memberCount ? ` · ${p.memberCount} on team` : ""}</div></td><td>${esc(p.managerName)}</td><td>${pill(p.status)}</td>
        <td><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1"><div class="progress-bar" style="width:${num(p.progress)}%"></div></div><small>${num(p.progress)}%</small></div></td><td>${date(p.deadline)}</td>
        <td class="text-nowrap"><button class="btn btn-sm btn-light" data-act="open-project" data-id="${p.id}">Open</button> ${state.user && can("project.edit") && Permissions.canEditProject(state.user, p) ? `<button class="btn btn-sm btn-light" data-act="edit-project" data-id="${p.id}">Edit</button> ` : ""}${can("project.delete") ? `<button class="btn btn-sm btn-light text-danger" data-act="delete-project" data-id="${p.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
function memberCards(items) {
    if (!items.length) return `<div class="empty-state">No team members match your search.</div>`;
    return `<div class="member-grid">${items.map(m => `<div class="member-card"><div class="member-avatar">${esc(m.name.charAt(0).toUpperCase())}</div><div class="flex-grow-1"><strong>${esc(m.name)}</strong><small>${esc(m.email)}<br>${esc(m.role)} · ${num(m.projectCount)} project${m.projectCount === 1 ? "" : "s"}</small>${taskChips(m.tasks)}</div>
        ${can("member.remove") && m.id !== state.user.id && Permissions.rolesUserMayAssign(state.user.role).includes(m.role) ? `<button class="btn btn-sm btn-light" data-act="remove-member" data-id="${m.id}">Remove</button>` : ""}</div>`).join("")}</div>`;
}
// small summary of tasks (open, done, in review, overdue) for member cards and the project team table
function taskChips(t) {
    if (!t) return "";
    return `<div class="task-chips" aria-label="Task summary"><span class="chip-stat" title="Open tasks"><b>${num(t.open)}</b> open</span><span class="chip-stat" title="Completed tasks"><b>${num(t.completed)}</b> done</span><span class="chip-stat" title="Waiting for review"><b>${num(t.review)}</b> in review</span><span class="chip-stat ${t.overdue ? "danger" : ""}" title="Overdue tasks"><b>${num(t.overdue)}</b> overdue</span></div>`;
}
function taskTable(items) {
    if (!items.length) return `<div class="empty-state">No tasks match these filters.</div>`;
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>TASK</th><th>PROJECT</th><th>ASSIGNEE</th><th>PRIORITY</th><th>DEADLINE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${items.map(t => `<tr><td><span class="strong-text">${esc(t.title)}</span>${t.commentCount || t.attachmentCount ? `<div class="text-secondary small">${t.commentCount ? "✎ " + t.commentCount : ""} ${t.attachmentCount ? "⎘ " + t.attachmentCount : ""}</div>` : ""}</td><td>${esc(t.projectName)}</td><td>${esc(t.assigneeName)}</td><td>${priorityPill(t.priority)}</td>
        <td class="${t.overdue ? "text-danger fw-semibold" : ""}">${date(t.deadline)}${t.overdue ? "<br><small>Overdue</small>" : ""}</td><td>${pill(t.status)}</td>
        <td class="text-nowrap"><button class="btn btn-sm btn-light" data-act="task-detail" data-id="${t.id}">Details</button> ${can("task.edit") ? `<button class="btn btn-sm btn-light" data-act="edit-task" data-id="${t.id}">Edit</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
function taskMiniList(items, empty = "No tasks to show.") {
    return items.map(t => `<div class="task-row" data-act="task-detail" data-id="${t.id}" role="button" tabindex="0"><span class="task-mark ${t.status === "Completed" ? "done" : ""}"></span><div><strong>${esc(t.title)}</strong><small>${esc(t.projectName)} · ${t.overdue ? "Overdue · " : ""}${date(t.deadline)} · ${esc(t.status)}</small></div></div>`).join("") || `<div class="empty-state">${esc(empty)}</div>`;
}
function approvalItems(items) {
    if (!items.length) return `<div class="empty-state">There are no tasks waiting for review.</div>`;
    return items.map(t => `<div class="approval-item"><div><strong>${esc(t.title)}</strong><small>${esc(t.projectName)} · Submitted by ${esc(t.assigneeName)} · Due ${date(t.deadline)}</small>${t.reviewComment ? `<small>Previous note: ${esc(t.reviewComment)}</small>` : ""}</div>
        <div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-light" data-act="task-detail" data-id="${t.id}">Details</button>${Permissions.canReviewTask(state.user, t)
            ? `<button class="btn btn-sm btn-success" data-act="approve" data-id="${t.id}">Approve</button><button class="btn btn-sm btn-outline-warning" data-act="request-changes" data-id="${t.id}">Request changes</button>`
            : `<span class="badge-soft status-review">Your own task: another reviewer must decide</span>`}</div></div>`).join("");
}
const decisionPill = d => d === "approve" ? `<span class="badge-soft status-completed">Approved</span>` : `<span class="badge-soft status-in-progress">Changes requested</span>`;
function reviewItems(items) {
    if (!items.length) return `<div class="empty-state">No review decisions match these filters.</div>`;
    return items.map(r => `<div class="approval-item"><div><strong>${esc(r.taskTitle)}</strong><small>${esc(r.projectName)} · Assignee: ${esc(r.assigneeName)} · Reviewed by ${esc(r.reviewerName)} · ${dateTime(r.at)}</small>${r.comment ? `<small>“${esc(r.comment)}”</small>` : ""}</div>
        <div class="d-flex gap-2 flex-wrap align-items-center">${decisionPill(r.decision)}<button class="btn btn-sm btn-light" data-act="task-detail" data-id="${r.taskId}">Details</button></div></div>`).join("");
}
function activityTable(items) {
    if (!items.length) return `<div class="empty-state">No activity matches these filters.</div>`;
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>WHEN</th><th>PERSON</th><th>ACTIVITY</th><th>PROJECT</th></tr></thead><tbody>${items.map(a => `<tr><td class="text-nowrap">${dateTime(a.at)}</td><td class="strong-text">${esc(a.person)}</td><td>${esc(a.message)}</td><td>${a.projectName ? esc(a.projectName) : `<span class="text-secondary">—</span>`}</td></tr>`).join("")}</tbody></table></div>`;
}
function adminUserTable(items) {
    if (!items.length) return `<div class="empty-state">No users match.</div>`;
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>OPEN TASKS</th></tr></thead><tbody>${items.map(m => `<tr><td class="strong-text">${esc(m.name)}</td><td>${esc(m.email)}</td>
        <td>${m.id === state.user.id ? pill(m.role) : `<select class="form-select form-select-sm role-select" data-role-member="${m.id}" aria-label="Role of ${attr(m.name)}">${options(Permissions.ROLES, m.role)}</select>`}</td><td>${num(m.openTasks)}</td></tr>`).join("")}</tbody></table></div>`;
}

// ---- task board ----
async function refreshBoard() {
    const box = document.getElementById("boardResults");
    if (!box) return;
    try {
        const res = await Api.listTasks({ size: 500, sort: "deadline", projectId: state.boardProject });
        res.data.forEach(t => { state.items.task[t.id] = t; });
        box.innerHTML = `<div class="board">${STATUSES.map(s => {
            const col = res.data.filter(t => t.status === s);
            return `<div class="board-column" data-drop-status="${s}"><div class="board-title"><span>${s.toUpperCase()}</span><span>${col.length}</span></div>${col.map(boardCard).join("") || `<div class="text-secondary small">No tasks</div>`}</div>`;
        }).join("")}</div>`;
    } catch (err) { box.innerHTML = errorBlock(err.message); }
}
function boardCard(t) {
    const targets = STATUSES.filter(s => s === t.status || Permissions.canMoveTask(state.user, t, s));
    const movable = targets.length > 1;
    return `<div class="board-card ${t.overdue ? "overdue" : ""}" ${movable ? `draggable="true" data-drag-task="${t.id}"` : ""}>
        <button class="link-button strong-text text-start" data-act="task-detail" data-id="${t.id}">${esc(t.title)}</button>
        <small>${esc(t.projectName)} · ${esc(t.assigneeName)}</small><small class="${t.overdue ? "text-danger" : ""}">Due ${date(t.deadline)}${t.overdue ? " · overdue" : ""}</small>
        <div class="mt-2">${priorityPill(t.priority)}</div>
        <label class="form-label mt-2 mb-1">Change status</label>
        <select class="form-select form-select-sm" data-status-task="${t.id}" ${movable ? "" : "disabled"} aria-label="Status of ${attr(t.title)}">${options(targets, t.status)}</select></div>`;
}
// moving to Review or Completed (or reopening a completed task) is important, so ask first
async function confirmMove(task, to) {
    if (!(to === "Review" || to === "Completed" || task.status === "Completed")) return true;
    return UI.confirmDialog({ title: "Change task status", confirmText: "Move task",
        message: "Move “" + task.title + "” from " + task.status + " to " + to + "?" + (to === "Review" ? " It will appear in the review queue." : "") });
}
async function moveTask(id, status) {
    const task = state.items.task[id];
    if (task && task.status !== status && !(await confirmMove(task, status))) { refreshBoard(); return; }      // cancelled, put the card back
    try { toast((await Api.updateTaskStatus(id, status)).message); }
    catch (err) { toast(err.message, "error"); }
    refreshBoard();
}

// ---- reports ----
async function loadReport() {
    const box = document.getElementById("reportResults"), r = state.report;
    if (!box) return;
    box.innerHTML = UI.loadingBlock("Building report…");
    try {
        const res = await (r.tab === "progress" ? Api.progressReport : Api.teamReport)({ from: r.from, to: r.to, projectId: r.projectId });
        state.lastReport = { tab: r.tab, data: res.data };
        const s = res.data.summary;
        if (!s.total) { box.innerHTML = `<div class="panel"><div class="empty-state">No tasks have a deadline in this period.</div></div>`; return; }
        const summary = `<div class="report-grid"><div class="panel"><div class="panel-head"><div><h2>Overall task progress</h2><p>${r.from || r.to ? "For the selected dates" : "All dates"}</p></div></div><div class="report-number">${s.completionRate}%</div><div class="progress mt-2"><div class="progress-bar" style="width:${s.completionRate}%"></div></div><small class="text-secondary">${s.completed} of ${s.total} tasks completed</small></div>
            <div class="panel"><h2 class="fs-6">Task summary</h2>${[["Completed", s.completed], ["In progress / to do", s.inProgress + s.todo], ["Awaiting review", s.review], ["Overdue", s.overdue]].map(([l, v]) => `<div class="d-flex justify-content-between py-2"><span>${l}</span><strong class="${l === "Overdue" && v ? "text-danger" : ""}">${v}</strong></div>`).join("")}</div></div>`;
        const rows = r.tab === "progress" ? res.data.byProject : res.data.byMember;
        const head = r.tab === "progress" ? ["PROJECT", "MANAGER", "STATUS"] : ["MEMBER", "ROLE"];
        const lead = x => r.tab === "progress" ? `<td class="strong-text">${esc(x.name)}</td><td>${esc(x.manager)}</td><td>${pill(x.status)}</td>` : `<td class="strong-text">${esc(x.name)}</td><td>${esc(x.role)}</td>`;
        box.innerHTML = summary + panel(r.tab === "progress" ? "Project-wise progress" : "Team performance", "Calculated from task status", `<div class="table-responsive"><table class="table align-middle"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}<th>TASKS</th><th>DONE</th><th>REVIEW</th><th>OPEN</th><th>OVERDUE</th><th>COMPLETION</th></tr></thead><tbody>${rows.map(x => `<tr>${lead(x)}<td>${x.total}</td><td>${x.completed}</td><td>${x.review}</td><td>${x.inProgress + x.todo}</td><td class="${x.overdue ? "text-danger fw-semibold" : ""}">${x.overdue}</td><td style="min-width:140px"><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1"><div class="progress-bar" style="width:${x.completionRate}%"></div></div><small>${x.completionRate}%</small></div></td></tr>`).join("")}</tbody></table></div>`);
    } catch (err) { box.innerHTML = `<div class="panel error-panel"><strong>The report could not be built.</strong><p class="mb-0">${esc(err.message)}</p></div>`; }
}
function exportReportCsv() {
    const r = state.lastReport;
    if (!r) { toast("Build a report first.", "warning"); return; }
    const rows = r.tab === "progress" ? r.data.byProject : r.data.byMember;
    const cols = r.tab === "progress" ? [["Project", "name"], ["Manager", "manager"], ["Status", "status"]] : [["Member", "name"], ["Role", "role"]];
    cols.push(["Tasks", "total"], ["Completed", "completed"], ["In review", "review"], ["In progress", "inProgress"], ["To do", "todo"], ["Overdue", "overdue"], ["Completion %", "completionRate"]);
    const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = [cols.map(c => cell(c[0])).join(",")].concat(rows.map(x => cols.map(c => cell(x[c[1]])).join(","))).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "veltrixa-" + r.tab + "-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---- project details: overview, team, tasks, progress ----
const PROJECT_TABS = [["overview", "Overview"], ["team", "Team"], ["tasks", "Tasks"], ["progress", "Progress"]];
let projectTabRequest = 0;

async function projectDetailView() {
    let p;
    try { p = (await Api.getProject(state.projectId)).data; }
    catch (err) { state.projectId = null; throw err; }                      // not found or not allowed, go back to the list
    state.currentProject = p; state.items.project[p.id] = p;
    const canEdit = can("project.edit") && Permissions.canEditProject(state.user, p);
    return `<div class="panel project-head">
        <button class="btn btn-sm btn-light mb-3" data-act="back-projects">← All projects</button>
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
            <div class="flex-grow-1"><h2 class="project-title">${esc(p.name)} ${pill(p.status)}</h2><p class="mb-0 text-secondary">${esc(p.description || "No description provided.")}</p></div>
            ${canEdit ? `<button class="btn btn-sm btn-light" data-act="edit-project" data-id="${p.id}">Edit project</button>` : ""}
        </div>
        <div class="d-flex align-items-center gap-2 mt-3"><div class="progress flex-grow-1"><div class="progress-bar" style="width:${num(p.progress)}%"></div></div><small><strong>${num(p.progress)}%</strong> complete</small></div>
    </div>
    <ul class="nav nav-tabs tab-bar mb-3" role="tablist">${PROJECT_TABS.map(([k, l]) => `<li class="nav-item"><button class="nav-link ${k === state.projectTab ? "active" : ""}" role="tab" data-project-tab="${k}">${l}</button></li>`).join("")}</ul>
    <div id="projectTabBody"></div>`;
}

async function loadProjectTab() {
    const box = document.getElementById("projectTabBody");
    if (!box) return;
    const tab = state.projectTab, mine = ++projectTabRequest;
    document.querySelectorAll("[data-project-tab]").forEach(b => b.classList.toggle("active", b.dataset.projectTab === tab));
    box.innerHTML = UI.loadingBlock();
    try {
        const html = tab === "overview" ? projectOverview(state.currentProject) : tab === "team" ? await projectTeamHtml() : tab === "tasks" ? await projectTasksShell() : await projectProgressShell();
        if (mine !== projectTabRequest) return;                               // another tab was opened in the meantime
        box.innerHTML = html;
        if (tab === "tasks") refresh("projectTasks");
        if (tab === "progress") loadProjectProgress();
    } catch (err) { if (mine === projectTabRequest) box.innerHTML = errorBlock(err.message); }
}

function projectOverview(p) {
    const fact = (label, value) => `<div class="fact"><small>${label}</small><div>${value}</div></div>`;
    const pending = p.taskCount - p.completedCount;
    return `<div class="stats-grid three">${statCard("Team members", p.memberCount, "☺", "Including the manager")}${statCard("Tasks", p.taskCount, "▤", p.completedCount + " completed")}${statCard("Pending tasks", pending, "◷", "Not completed yet")}
        ${statCard("Overdue tasks", p.overdueCount, "!", "Past their deadline")}${statCard("Awaiting review", p.reviewCount, "◎", "Submitted for approval")}${statCard("Progress", num(p.progress) + "%", "↗", "Calculated by the server")}</div>
        <div class="panel"><div class="panel-head"><div><h2>Project details</h2><p>Dates, manager and status</p></div></div>
        <div class="facts">${fact("PROJECT MANAGER", esc(p.managerName))}${fact("STATUS", pill(p.status))}${fact("START DATE", date(p.startDate))}${fact("DEADLINE", date(p.deadline))}</div></div>`;
}

async function projectTeamHtml() {
    const p = state.currentProject, rows = (await Api.listProjectMembers(p.id)).data;
    const canManage = Permissions.canManageProjectTeam(state.user, p);
    let adder = "";
    if (canManage) {
        const onTeamIds = new Set(rows.map(r => r.id)), candidates = (await getLookups()).members.filter(m => !onTeamIds.has(m.id));
        adder = candidates.length
            ? `<div class="team-add"><label class="flex-grow-1"><span class="form-label">Add a person to this project</span><select class="form-select" id="teamCandidate" aria-label="Person to add">${options(candidates.map(m => [m.id, m.name + " (" + m.role + ")"]), "", "Choose a person…")}</select></label><button class="btn btn-primary" data-act="add-project-member">Add to team</button></div>`
            : `<p class="small text-secondary">Everyone in the workspace is already on this team.</p>`;
    }
    const table = `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>MEMBER</th><th class="d-none d-sm-table-cell">ROLE</th><th>TASKS IN THIS PROJECT</th>${canManage ? "<th>ACTIONS</th>" : ""}</tr></thead><tbody>${rows.map(m =>
        `<tr><td><span class="strong-text">${esc(m.name)}</span>${m.isManager ? ` <span class="badge-soft status-active">Manager</span>` : ""}${m.email ? `<div class="text-secondary small">${esc(m.email)}</div>` : ""}</td><td class="d-none d-sm-table-cell">${esc(m.role)}</td><td>${m.tasks.total ? taskChips(m.tasks) : `<span class="text-secondary small">No tasks yet</span>`}</td>
        ${canManage ? `<td>${m.isManager ? "" : `<button class="btn btn-sm btn-light text-danger" data-act="remove-project-member" data-member-id="${m.id}" data-name="${attr(m.name)}">Remove</button>`}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
    return panel("Project team", rows.length + " people. Tasks in this project can be assigned only to them.", adder + table);
}

async function projectTasksShell() {
    const f = state.lists.projectTasks;
    const add = can("task.create") ? `<button class="btn btn-primary" data-act="add-project-task">+ Add task</button>` : "";
    return panel("Project tasks", state.user.role === "Team Member" ? "Your tasks in this project" : "Every task in this project", `<div class="toolbar"><input class="form-control" data-filter="projectTasks:q" placeholder="Search tasks…" value="${attr(f.q)}" aria-label="Search tasks">
        <select class="form-select" data-filter="projectTasks:status" aria-label="Status">${options(STATUSES, f.status, "All statuses")}</select>
        <select class="form-select" data-filter="projectTasks:priority" aria-label="Priority">${options(["High", "Medium", "Low"], f.priority, "All priorities")}</select></div><div id="projectTasksResults"></div>`, add);
}

async function projectProgressShell() {
    const r = state.projectProgress;
    return `<div class="panel"><form class="report-filters" id="projectProgressForm"><label>From <input class="form-control" type="date" name="from" value="${attr(r.from)}"></label>
        <label>To <input class="form-control" type="date" name="to" value="${attr(r.to)}"></label><button class="btn btn-primary" type="submit">Apply</button><button class="btn btn-light" type="button" data-act="project-progress-reset">Reset</button></form>
        <small class="text-secondary">Tasks are included when their deadline falls inside the selected dates.</small></div><div id="projectProgressResults">${UI.loadingBlock()}</div>`;
}

async function loadProjectProgress() {
    const box = document.getElementById("projectProgressResults");
    if (!box) return;
    try {
        const d = (await Api.projectProgress(state.projectId, state.projectProgress)).data, s = d.summary, pending = s.total - s.completed;
        const max = Math.max(1, ...d.byStatus.map(x => x.count));
        const team = d.byMember.length ? `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>MEMBER</th><th>ROLE</th><th>TASKS</th><th>DONE</th><th>PENDING</th><th>OVERDUE</th><th>COMPLETION</th></tr></thead><tbody>${d.byMember.map(x =>
            `<tr><td class="strong-text">${esc(x.name)}</td><td>${esc(x.role)}</td><td>${x.total}</td><td>${x.completed}</td><td>${x.total - x.completed}</td><td class="${x.overdue ? "text-danger fw-semibold" : ""}">${x.overdue}</td>
            <td style="min-width:140px"><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1"><div class="progress-bar" style="width:${x.completionRate}%"></div></div><small>${x.completionRate}%</small></div></td></tr>`).join("")}</tbody></table></div>`
            : `<div class="empty-state">No tasks have a deadline in this period.</div>`;
        box.innerHTML = `<div class="report-grid"><div class="panel"><div class="panel-head"><div><h2>Project completion</h2><p>Overall, for ${esc(d.project.name)}</p></div></div><div class="report-number">${num(d.progress)}%</div><div class="progress mt-2"><div class="progress-bar" style="width:${num(d.progress)}%"></div></div><small class="text-secondary">Calculated by the server from task status</small></div>
            <div class="panel"><h2 class="fs-6">${d.filters.from || d.filters.to ? "Tasks in the selected dates" : "All tasks"}</h2>${[["Completed", s.completed], ["Pending", pending], ["Overdue", s.overdue]].map(([l, v]) => `<div class="d-flex justify-content-between py-2"><span>${l}</span><strong class="${l === "Overdue" && v ? "text-danger" : ""}">${v}</strong></div>`).join("")}
            <div class="small text-secondary mt-1">Completion for this selection: <strong>${s.completionRate}%</strong> (${s.completed} of ${s.total})</div></div></div>
            <div class="dist-grid">${panel("Tasks by status", "In the selected dates", d.byStatus.map(x => barRow(x.status, x.count, max)).join(""))}${panel("Team-wise summary", "Who is carrying the work", team)}</div>`;
    } catch (err) { box.innerHTML = `<div class="panel error-panel"><strong>The progress could not be loaded.</strong><p class="mb-0">${esc(err.message)}</p></div>`; }
}

// ---- create and edit forms ----
// preset.projectId is used when a task is added from the project screen (the project is fixed)
async function openForm(type, id = null, preset = {}) {
    try {
        const lk = await getLookups();
        const item = id ? (type === "task" ? (await Api.getTask(id)).data : state.items[type][id]) : null;
        let team = [];
        if (type === "task") {                       // only people in the project team can get the task
            const pid = item?.projectId ?? preset.projectId ?? lk.projects[0]?.id;
            team = pid ? (await Api.listProjectMembers(pid)).data : [];
        }
        state.editing = { type, id, item, preset };
        document.getElementById("modalTitle").textContent = (id ? "Edit " : "Create ") + type;
        document.getElementById("modalFields").innerHTML = formFields(type, item, lk, { team, preset });
        document.getElementById("formError").textContent = "";
        document.getElementById("recordForm").classList.remove("was-validated");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("recordModal")).show();
    } catch (err) { toast(err.message, "error"); }
}
const field = (label, input) => `<label class="form-label">${label}</label>${input}`;
// assignee dropdown: the people of the project, plus the current assignee if they left the team
const assigneeOptions = (team, current) => options(team.map(m => [m.id, m.name + " (" + m.role + (m.isManager ? ", manager" : "") + ")"]), current);
function deadlineHint(project) {
    return project ? "Must fall inside the project dates: " + date(project.startDate) + " to " + date(project.deadline) + "." : "";
}
function formFields(type, item, lk, extra = {}) {
    const v = k => attr(item?.[k] ?? "");
    if (type === "project") {
        const canPick = can("project.assignManager");
        const mgrId = item?.managerId ?? state.user.id;
        const mgrName = lk.managers.find(m => m.id === mgrId)?.name || state.user.name;
        return field("Project name", `<input class="form-control mb-3" name="name" required maxlength="70" value="${v("name")}">`) +
            field("Description", `<textarea class="form-control mb-3" name="description" rows="2" maxlength="300">${esc(item?.description || "")}</textarea>`) +
            `<div class="row"><div class="col">${field("Start date", `<input class="form-control mb-3" type="date" name="startDate" required value="${attr(item?.startDate || new Date().toISOString().slice(0, 10))}">`)}</div><div class="col">${field("Deadline", `<input class="form-control mb-3" type="date" name="deadline" required value="${v("deadline")}">`)}</div></div>` +
            field("Project manager", canPick ? `<select class="form-select mb-1" name="managerId" required>${options(lk.managers.map(m => [m.id, m.name + " (" + m.role + ")"]), mgrId)}</select><div class="form-text mb-3">Only a Project Manager or Administrator can manage a project.</div>`
                : `<input class="form-control mb-1" value="${attr(mgrName)}" disabled><input type="hidden" name="managerId" value="${mgrId}"><div class="form-text mb-3">Only an administrator can assign a different manager.</div>`) +
            field("Status", `<select class="form-select${item ? "" : " mb-3"}" name="status">${options(["Active", "On Hold", "Completed"], item?.status)}</select>`) +
            (item ? "" : field("Team members (optional)", `<div class="check-list">${lk.members.filter(m => m.id !== state.user.id).map(m =>
                `<label class="form-check"><input class="form-check-input" type="checkbox" name="memberIds" value="${m.id}"><span class="form-check-label">${esc(m.name)} <small class="text-secondary">${esc(m.role)}</small></span></label>`).join("")}</div>
                <div class="form-text">The manager is always on the team. You can change the team later from the project page.</div>`));
    }
    if (type === "task") {
        const statuses = STATUSES.filter(s => item ? (s === item.status || Permissions.canMoveTask(state.user, item, s)) : s !== "Completed");
        const pid = item?.projectId ?? extra.preset?.projectId ?? lk.projects[0]?.id, project = lk.projects.find(p => p.id === pid);
        const team = extra.team || [];
        if (item && !team.some(m => m.id === item.assigneeId)) team.push({ id: item.assigneeId, name: item.assigneeName, role: "former team member" });
        const locked = !!extra.preset?.projectId && !item;
        // the date picker only allows the project dates (unless an old task is already outside them)
        const outside = item && project && (item.deadline < project.startDate || item.deadline > project.deadline);
        const bounds = project && !outside ? `min="${attr(project.startDate)}" max="${attr(project.deadline)}"` : "";
        return field("Task title", `<input class="form-control mb-3" name="title" required maxlength="100" value="${v("title")}">`) +
            field("Description", `<textarea class="form-control mb-3" name="description" rows="2" maxlength="500">${esc(item?.description || "")}</textarea>`) +
            field("Project", locked ? `<input class="form-control mb-3" value="${attr(project?.name)}" disabled><input type="hidden" name="projectId" value="${pid}">`
                : `<select class="form-select mb-3" name="projectId" id="taskProject" required>${options(lk.projects.map(p => [p.id, p.name]), pid)}</select>`) +
            field("Assignee", `<select class="form-select mb-1" name="assigneeId" id="taskAssignee" required>${assigneeOptions(team, item?.assigneeId)}</select><div class="form-text mb-3">Only people on the project team can be assigned. Add people from the project page.</div>`) +
            `<div class="row"><div class="col">${field("Priority", `<select class="form-select mb-3" name="priority">${options(["High", "Medium", "Low"], item?.priority || "Medium")}</select>`)}</div><div class="col">${field("Deadline", `<input class="form-control mb-1" type="date" name="deadline" id="taskDeadline" required ${bounds} value="${v("deadline")}"><div class="form-text mb-3" id="deadlineHint">${esc(deadlineHint(project))}</div>`)}</div></div>` +
            field("Status", `<select class="form-select" name="status">${options(statuses, item?.status || "To Do")}</select>`);
    }
    return field("Full name", `<input class="form-control mb-3" name="name" required minlength="2" value="">`) +
        field("Email", `<input class="form-control mb-3" type="email" name="email" required value="">`) +
        field("Role", `<select class="form-select" name="role">${options(Permissions.rolesUserMayAssign(state.user.role), "Team Member")}</select>`);
}

async function taskProjectChanged(select) {
    const lk = await getLookups(), project = lk.projects.find(p => p.id === Number(select.value));
    const assignee = document.getElementById("taskAssignee"), deadline = document.getElementById("taskDeadline");
    assignee.disabled = true;
    try {
        const team = (await Api.listProjectMembers(project.id)).data;
        assignee.innerHTML = assigneeOptions(team, "");
    } catch (err) { toast(err.message, "error"); }
    assignee.disabled = false;
    if (project) { deadline.min = project.startDate; deadline.max = project.deadline; }
    document.getElementById("deadlineHint").textContent = deadlineHint(project);
}

async function saveRecord(e) {
    e.preventDefault();
    const form = e.target, button = form.querySelector("button[type=submit]"), errorBox = document.getElementById("formError");
    form.classList.add("was-validated");
    errorBox.textContent = "";
    form.querySelectorAll(".is-invalid").forEach(x => x.classList.remove("is-invalid"));
    if (!form.checkValidity()) return;
    const { type, id, item } = state.editing, data = new FormData(form), v = Object.fromEntries(data);
    if (type === "project" && v.deadline < v.startDate) { errorBox.textContent = "Deadline cannot be earlier than the start date."; return; }
    if (type === "project" && !id) v.memberIds = data.getAll("memberIds").map(Number);
    const ids = ["managerId", "projectId", "assigneeId"];
    ids.forEach(k => { if (k in v) v[k] = Number(v[k]); });
    if (type === "task") {                           // the deadline must be inside the project dates (same rule as the server)
        const project = (await getLookups()).projects.find(p => p.id === v.projectId);
        const changed = !item || item.deadline !== v.deadline || item.projectId !== v.projectId;
        if (project && changed && (v.deadline < project.startDate || v.deadline > project.deadline)) {
            errorBox.textContent = "The deadline must fall inside the project dates (" + date(project.startDate) + " to " + date(project.deadline) + ").";
            form.querySelector('[name="deadline"]').classList.add("is-invalid");
            return;
        }
    }
    // when editing something that already exists, ask for confirmation first
    if (id && !(await UI.confirmDialog({ title: "Save changes", message: "Save your changes to this " + type + "?", confirmText: "Save changes" }))) return;
    setBusy(button, true, "Saving…");
    try {
        const call = { project: id ? () => Api.updateProject(id, v) : () => Api.createProject(v), task: id ? () => Api.updateTask(id, v) : () => Api.createTask(v.projectId, v), member: () => Api.addMember(v) }[type];
        const res = await call();
        bootstrap.Modal.getInstance(document.getElementById("recordModal")).hide();
        toast(res.message);
        if (type !== "task") state.lookups = null;
        renderPage(state.page, true);
    } catch (err) {
        errorBox.textContent = err.message;
        Object.keys(err.errors || {}).forEach(k => form.querySelector(`[name="${k}"]`)?.classList.add("is-invalid"));
    } finally { setBusy(button, false); }
}

// ---- task details (comments, history, attachments) ----
async function openTask(id, tab = "details") {
    try {
        const [task, comments] = await Promise.all([Api.getTask(id), Api.listComments(id)]);
        state.comments = comments.data;
        renderTaskDetail(task.data, tab);
        bootstrap.Modal.getOrCreateInstance(document.getElementById("detailModal")).show();
    } catch (err) { toast(err.message, "error"); }
}
const HISTORY_ICON = { created: "＋", status: "⇄", assignment: "☺", priority: "!", deadline: "◷", edit: "✎", comment: "✎", attachment: "⎘", review: "◎" };
function renderTaskDetail(t, tab) {
    state.task = t; state.detailTab = tab;
    document.getElementById("detailTitle").textContent = t.title;
    const tabs = [["details", "Details"], ["comments", "Comments (" + state.comments.length + ")"], ["activity", "Activity (" + t.history.length + ")"]];
    if (CFG.ATTACHMENTS_ENABLED) tabs.push(["attachments", "Attachments (" + t.attachments.length + ")"]);
    const moveTo = STATUSES.filter(s => s === t.status || Permissions.canMoveTask(state.user, t, s));
    let body = "";
    if (tab === "details") body = `<div class="row g-3 mb-3"><div class="col-md-6"><small class="text-secondary">PROJECT</small><div>${esc(t.projectName)}</div></div><div class="col-md-6"><small class="text-secondary">ASSIGNEE</small><div>${esc(t.assigneeName)}</div></div>
        <div class="col-md-6"><small class="text-secondary">PRIORITY</small><div>${priorityPill(t.priority)}</div></div><div class="col-md-6"><small class="text-secondary">DEADLINE</small><div class="${t.overdue ? "text-danger" : ""}">${date(t.deadline)}${t.overdue ? " · overdue" : ""}</div></div>
        <div class="col-md-6"><small class="text-secondary">STATUS</small><div class="d-flex gap-2 align-items-center">${pill(t.status)}${moveTo.length > 1 ? `<select class="form-select form-select-sm w-auto" data-detail-status aria-label="Change status">${options(moveTo, t.status)}</select>` : ""}</div></div>
        <div class="col-md-6"><small class="text-secondary">CREATED</small><div>${dateTime(t.createdAt)} by ${esc(t.createdBy)}</div></div>
        <div class="col-12"><small class="text-secondary">DESCRIPTION</small><p class="mb-0">${esc(t.description || "No description provided.")}</p></div></div>
        <div class="small text-secondary">Review note: ${esc(t.reviewComment || "No review feedback yet.")}</div>${can("task.edit") ? `<button class="btn btn-sm btn-light mt-3" data-detail-edit>Edit task</button>` : ""}`;
    if (tab === "comments") body = `<div>${state.comments.map(c => `<div class="comment"><strong>${esc(c.by)}</strong><small>${dateTime(c.at)}</small><p>${esc(c.text)}</p></div>`).join("") || `<p class="small text-secondary">No comments yet.</p>`}</div>
        <form id="commentForm" class="d-flex gap-2 mt-3"><input class="form-control" name="comment" required maxlength="500" placeholder="Write a comment…" aria-label="Comment"><button class="btn btn-primary">Send</button></form>`;
    if (tab === "activity") body = `<ol class="timeline">${t.history.map(h => `<li><span class="timeline-icon">${HISTORY_ICON[h.type] || "•"}</span><div><strong>${esc(h.text)}</strong><small>${esc(h.byName)} · ${dateTime(h.at)}</small></div></li>`).join("")}</ol>`;
    if (tab === "attachments") body = `<div>${t.attachments.map(a => `<div class="attachment"><span class="attachment-icon">⎘</span><div class="flex-grow-1"><strong>${esc(a.name)}</strong><small>${UI.fileSize(a.size)} · ${esc(a.by)} · ${dateTime(a.at)}</small></div>
        ${a.byId === state.user.id || ["Administrator", "Project Manager"].includes(state.user.role) ? `<button class="btn btn-sm btn-light text-danger" data-del-attachment="${a.id}">Remove</button>` : ""}</div>`).join("") || `<p class="small text-secondary">No files attached.</p>`}</div>
        ${can("task.attach") ? `<div class="upload-box"><input class="form-control" type="file" id="attachFile" accept="${CFG.ALLOWED_ATTACHMENT_EXT.map(e => "." + e).join(",")}" aria-label="Choose a file"><button class="btn btn-primary" data-upload>Upload</button></div>
        <small class="text-secondary">Allowed: ${CFG.ALLOWED_ATTACHMENT_EXT.join(", ")} · up to ${CFG.MAX_ATTACHMENT_MB} MB. ${CFG.USE_MOCK ? "Demo mode saves the file name only." : ""}</small>` : ""}`;
    document.getElementById("detailBody").innerHTML = `<ul class="nav nav-tabs mb-3">${tabs.map(([k, l]) => `<li class="nav-item"><button class="nav-link ${k === tab ? "active" : ""}" data-tab="${k}">${l}</button></li>`).join("")}</ul>${body}`;
    // the tabs were redrawn, so give keyboard focus back to the dialog (Esc and Tab still work)
    document.querySelector("#detailBody .nav-link.active")?.focus();
}
async function detailAction(e) {
    const t = state.task;
    if (e.target.closest("[data-tab]")) { renderTaskDetail(t, e.target.closest("[data-tab]").dataset.tab); return; }
    if (e.target.closest("[data-detail-edit]")) {
        const modalEl = document.getElementById("detailModal");
        modalEl.addEventListener("hidden.bs.modal", () => openForm("task", t.id), { once: true });
        bootstrap.Modal.getInstance(modalEl).hide();
        return;
    }
    const del = e.target.closest("[data-del-attachment]");
    if (del) {
        if (!await UI.confirmDialog({ title: "Remove attachment", message: "Remove this file from the task?", confirmText: "Remove", danger: true })) return;
        try { const r = await Api.deleteAttachment(t.id, del.dataset.delAttachment); toast(r.message); state.dirty = true; renderTaskDetail(r.data, "attachments"); }
        catch (err) { toast(err.message, "error"); }
        return;
    }
    const up = e.target.closest("[data-upload]");
    if (up) {
        const file = document.getElementById("attachFile").files[0];
        if (!file) { toast("Choose a file first.", "warning"); return; }
        const ext = file.name.split(".").pop().toLowerCase();
        if (!CFG.ALLOWED_ATTACHMENT_EXT.includes(ext)) { toast("This file type is not allowed.", "error"); return; }
        if (file.size > CFG.MAX_ATTACHMENT_MB * 1048576) { toast("The file is larger than " + CFG.MAX_ATTACHMENT_MB + " MB.", "error"); return; }
        setBusy(up, true, "Uploading…");
        try { const r = await Api.uploadAttachment(t.id, file); toast(r.message); state.dirty = true; renderTaskDetail(r.data, "attachments"); }
        catch (err) { toast(err.message, "error"); setBusy(up, false); }
    }
}
async function detailSubmit(e) {
    if (e.target.id !== "commentForm") return;
    e.preventDefault();
    const text = new FormData(e.target).get("comment").trim(), button = e.target.querySelector("button");
    if (!text) return;
    setBusy(button, true, "Sending…");
    try {
        await Api.addComment(state.task.id, text);
        const [task, comments] = await Promise.all([Api.getTask(state.task.id), Api.listComments(state.task.id)]);     // reload so the list, count and history are up to date
        state.comments = comments.data; state.dirty = true; renderTaskDetail(task.data, "comments");
    } catch (err) { toast(err.message, "error"); setBusy(button, false); }
}
async function detailChange(e) {
    if (!e.target.matches("[data-detail-status]")) return;
    if (!(await confirmMove(state.task, e.target.value))) { renderTaskDetail(state.task, "details"); return; }
    try { toast((await Api.updateTaskStatus(state.task.id, e.target.value)).message); state.dirty = true; renderTaskDetail((await Api.getTask(state.task.id)).data, "details"); }
    catch (err) { toast(err.message, "error"); renderTaskDetail(state.task, "details"); }
}

// ---- clicks, filters and page actions ----
async function pageAction(e) {
    const pageBtn = e.target.closest("[data-page-key]");
    if (pageBtn) {
        if (pageBtn.closest(".disabled, .active")) return;
        state.lists[pageBtn.dataset.pageKey].page = Number(pageBtn.dataset.page);
        refresh(pageBtn.dataset.pageKey);
        return;
    }
    const tab = e.target.closest("[data-report-tab]");
    if (tab) { state.report.tab = tab.dataset.reportTab; renderPage("reports", true); return; }
    const reviewTab = e.target.closest("[data-approvals-tab]");
    if (reviewTab) { state.approvalsTab = reviewTab.dataset.approvalsTab; renderPage("approvals", true); return; }
    const projectTab = e.target.closest("[data-project-tab]");
    if (projectTab) { state.projectTab = projectTab.dataset.projectTab; loadProjectTab(); return; }
    const el = e.target.closest("[data-act],[data-create],[data-go],[data-clear]");
    if (!el) return;
    if (el.dataset.create) return openForm(el.dataset.create);
    if (el.dataset.go) { location.href = pageUrl(el.dataset.go); return; }
    if (el.dataset.clear) {
        const f = state.lists[el.dataset.clear], size = f.size;
        Object.keys(f).forEach(k => { f[k] = ""; });
        f.page = 1; f.size = size;
        return renderPage(state.page, true);
    }
    const id = Number(el.dataset.id);
    try {
        switch (el.dataset.act) {
            case "reload": return renderPage(state.page);
            case "open-project":
                if (state.page !== "projects") { location.href = pageUrl("projects") + "#project-" + id; return; }      // from the dashboard: go to the projects page
                state.projectId = id; state.projectTab = "overview"; return renderPage("projects");
            case "back-projects": state.projectId = null; return renderPage("projects");
            case "add-project-task": return openForm("task", null, { projectId: state.projectId });
            case "add-project-member": {
                const select = document.getElementById("teamCandidate");
                if (!select.value) { toast("Choose a person to add first.", "warning"); select.focus(); return; }
                toast((await Api.addProjectMember(state.projectId, Number(select.value))).message);
                state.currentProject = (await Api.getProject(state.projectId)).data;
                return loadProjectTab();
            }
            case "remove-project-member": {
                if (!await UI.confirmDialog({ title: "Remove from project", message: "Remove " + el.dataset.name + " from this project's team? Their completed tasks stay as they are.", confirmText: "Remove", danger: true })) return;
                toast((await Api.removeProjectMember(state.projectId, Number(el.dataset.memberId))).message);
                state.currentProject = (await Api.getProject(state.projectId)).data;
                return loadProjectTab();
            }
            case "project-progress-reset": state.projectProgress = { from: "", to: "" }; return loadProjectTab();
            case "edit-project": return openForm("project", id);
            case "edit-task": return openForm("task", id);
            case "task-detail": return openTask(id);
            case "report-reset": state.report = { tab: state.report.tab, from: "", to: "", projectId: "" }; return renderPage("reports", true);
            case "report-csv": return exportReportCsv();
            case "delete-project":
                if (!await UI.confirmDialog({ title: "Delete project", message: "Delete this project and all of its tasks? This cannot be undone.", confirmText: "Delete project", danger: true })) return;
                toast((await Api.deleteProject(id)).message); state.lookups = null; return refresh("projects");
            case "remove-member":
                if (!await UI.confirmDialog({ title: "Remove team member", message: "Remove this person from the workspace?", confirmText: "Remove", danger: true })) return;
                toast((await Api.removeMember(id)).message); state.lookups = null; return refresh("members");
            case "approve": {
                const note = await UI.promptDialog({ title: "Approve task", label: "Add a note for the assignee (optional)", confirmText: "Approve" });
                if (note === null) return;
                toast((await Api.reviewTask(id, "approve", note)).message); return refresh("approvals");
            }
            case "request-changes": {
                const note = await UI.promptDialog({ title: "Request changes", label: "What needs to change?", confirmText: "Send back", required: true });
                if (note === null) return;
                toast((await Api.reviewTask(id, "changes", note)).message); return refresh("approvals");
            }
        }
    } catch (err) {
        toast(err.message, "error");
        if (state.page !== "dashboard") renderPage(state.page, true);       // the data may have changed, so show the latest
    }
}
async function pageChange(e) {
    const t = e.target;
    if (t.dataset.filter && t.type !== "text") {
        const [key, name] = t.dataset.filter.split(":");
        state.lists[key][name] = t.type === "checkbox" ? (t.checked ? "true" : "") : t.value;
        state.lists[key].page = 1;
        refresh(key);
    } else if (t.dataset.sizeKey) {
        state.lists[t.dataset.sizeKey].size = Number(t.value);
        state.lists[t.dataset.sizeKey].page = 1;
        refresh(t.dataset.sizeKey);
    } else if (t.dataset.statusTask) moveTask(Number(t.dataset.statusTask), t.value);
    else if (t.matches("[data-board-project]")) { state.boardProject = t.value; refreshBoard(); }
    else if (t.dataset.roleMember) {
        try { toast((await Api.changeMemberRole(t.dataset.roleMember, t.value)).message); state.lookups = null; }
        catch (err) { toast(err.message, "error"); }
        refresh("adminUsers");
    }
}
function pageInput(e) {
    const t = e.target;
    if (t.dataset.filter && t.type === "text") {
        const [key, name] = t.dataset.filter.split(":");
        state.lists[key][name] = t.value.trim();
        state.lists[key].page = 1;
        refresh(key);
    }
}
document.addEventListener("DOMContentLoaded", () => {
    on("pageContent", "submit", e => {
        if (e.target.id === "projectProgressForm") {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.target));
            state.projectProgress = { from: v.from, to: v.to };
            loadProjectProgress();
            return;
        }
        if (e.target.id !== "reportForm") return;
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target));
        Object.assign(state.report, { from: v.from, to: v.to, projectId: v.projectId });
        loadReport();
    });
    on("recordForm", "change", e => { if (e.target.id === "taskProject") taskProjectChanged(e.target); });
    document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches?.(".task-row")) e.target.click(); });
});
