/* Mock backend that runs in the browser.
   It answers the same endpoints, query parameters and JSON that the Java backend has to provide
   (see docs/API-INTEGRATION.md), so api.js and app.js stay the same when you switch to the real server.
   Data is kept in localStorage. Only for demo, it is not secure. */
const MockServer = (() => {
    const CFG = window.VELTRIXA_CONFIG;
    const DB_KEY = "veltrixa_mock_db_v3";
    const OLD_DB_KEY = "veltrixa_mock_db_v2";
    const SESSION_KEY = "veltrixa_session";
    const STATUSES = ["To Do", "In Progress", "Review", "Completed"];
    const PRIORITIES = ["High", "Medium", "Low"];
    const PROJECT_STATUSES = ["Active", "On Hold", "Completed"];
    let db = null;

    class HttpError extends Error {
        constructor(status, message, errors) { super(message); this.status = status; this.errors = errors || null; }
    }

    /* ---------- storage ---------- */
    async function init() {
        if (db) return;
        const saved = localStorage.getItem(DB_KEY);
        if (saved) { db = JSON.parse(saved); return; }
        let res;
        try { res = await fetch(CFG.MOCK_DATA_URL); } catch (e) { res = null; }
        if (!res || !res.ok) {
            throw new HttpError(500, "Could not load " + CFG.MOCK_DATA_URL + ". Open the project with VS Code Live Server (or any local web server) instead of double-clicking index.html.");
        }
        db = await res.json();
        migrateV1Accounts();
        migrateV2Accounts();
        save();
    }
    function save() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    function reset() { localStorage.removeItem(DB_KEY); sessionStorage.removeItem(SESSION_KEY); db = null; }

    // keep accounts made with the first version
    function migrateV1Accounts() {
        try {
            const old = JSON.parse(localStorage.getItem("veltrixa_registered_users") || "[]");
            old.forEach(u => {
                if (db.members.some(m => m.email.toLowerCase() === u.email)) return;
                db.members.push({ id: nextId(db.members), name: u.name, email: u.email, role: u.role });
                db.credentials[u.email] = u.password;
            });
        } catch (e) { /* ignore broken old data */ }
    }

    // keep accounts registered in version 2.0 (they were saved under the old key)
    function migrateV2Accounts() {
        try {
            const old = JSON.parse(localStorage.getItem(OLD_DB_KEY) || "null");
            if (!old) return;
            old.members.forEach(m => {
                if (db.members.some(x => x.email.toLowerCase() === m.email.toLowerCase())) return;
                db.members.push({ id: nextId(db.members), name: m.name, email: m.email, role: m.role });
                db.credentials[m.email.toLowerCase()] = old.credentials[m.email.toLowerCase()] || "demo1234";
            });
        } catch (e) { /* ignore broken old data */ }
    }

    /* ---------- small helpers ---------- */
    const nextId = list => list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
    const nowIso = () => new Date().toISOString();
    const localDate = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const isOverdue = t => t.status !== "Completed" && t.deadline < localDate();
    const memberName = id => (db.members.find(m => m.id === id) || {}).name || "Unknown";
    const projectName = id => (db.projects.find(p => p.id === id) || {}).name || "Unknown";
    const ok = (data, message, pagination) => ({ status: 200, body: { success: true, message: message || "OK", data, pagination: pagination || null } });
    const created = (data, message) => ({ status: 201, body: { success: true, message, data } });
    function paginate(list, q) {
        const size = Math.min(Math.max(parseInt(q.size) || CFG.DEFAULT_PAGE_SIZE, 1), 500);
        const totalItems = list.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / size));
        const page = Math.min(Math.max(parseInt(q.page) || 1, 1), totalPages);
        return { items: list.slice((page - 1) * size, page * size), pagination: { page, size, totalItems, totalPages } };
    }
    const includesText = (text, q) => String(text).toLowerCase().includes(String(q || "").trim().toLowerCase());
    function logActivity(user, message, projectId) {
        db.activities.unshift({ id: nextId(db.activities), personId: user.id, person: user.name, message, at: nowIso(), projectId: projectId || null });
        db.activities = db.activities.slice(0, 500);
    }
    const prettyDate = v => new Date(v + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    function addHistory(task, user, type, text, extra) {
        task.history.push(Object.assign({ at: nowIso(), by: user.id, byName: user.name, type, text }, extra || {}));
    }
    function requirePermission(user, action) {
        if (!Permissions.can(user.role, action)) throw new HttpError(403, "Your role (" + user.role + ") is not allowed to do this.");
    }

    /* ---------- data per user and view builders ---------- */
    // a project team is its manager plus the people in project.memberIds
    const onTeam = (p, id) => p.managerId === id || (p.memberIds || []).includes(id);
    const visibleTasks = user => user.role === "Team Member" ? db.tasks.filter(t => t.assigneeId === user.id) : db.tasks;
    const visibleProjects = user => user.role === "Team Member"
        ? db.projects.filter(p => onTeam(p, user.id) || db.tasks.some(t => t.projectId === p.id && t.assigneeId === user.id)) : db.projects;
    function getProject(user, id) {
        const p = visibleProjects(user).find(x => x.id === Number(id));
        if (!p) throw new HttpError(404, "Project not found.");
        return p;
    }

    function projectView(p) {
        const tasks = db.tasks.filter(t => t.projectId === p.id);
        const done = tasks.filter(t => t.status === "Completed").length;
        const { memberIds, ...rest } = p;
        return Object.assign({}, rest, {
            managerName: memberName(p.managerId),
            taskCount: tasks.length, completedCount: done,
            overdueCount: tasks.filter(isOverdue).length, reviewCount: tasks.filter(t => t.status === "Review").length,
            memberCount: 1 + (memberIds || []).filter(id => id !== p.managerId).length,      // the manager counts as a team member
            progress: p.status === "Completed" ? 100 : (tasks.length ? Math.round(done / tasks.length * 100) : 0)
        });
    }
    // task counts for one person (can be limited to one project)
    function taskSummary(memberId, projectId) {
        const list = db.tasks.filter(t => t.assigneeId === memberId && (!projectId || t.projectId === projectId));
        return {
            total: list.length, completed: list.filter(t => t.status === "Completed").length,
            open: list.filter(t => t.status !== "Completed").length, review: list.filter(t => t.status === "Review").length,
            overdue: list.filter(isOverdue).length
        };
    }
    const memberView = m => { const tasks = taskSummary(m.id); return Object.assign({}, m, { openTasks: tasks.open, tasks, projectCount: db.projects.filter(p => onTeam(p, m.id)).length }); };
    const taskView = t => ({
        id: t.id, title: t.title, description: t.description, projectId: t.projectId, projectName: projectName(t.projectId),
        assigneeId: t.assigneeId, assigneeName: memberName(t.assigneeId), priority: t.priority, deadline: t.deadline,
        status: t.status, overdue: isOverdue(t), reviewComment: t.reviewComment || "",
        commentCount: t.comments.length, attachmentCount: t.attachments.length
    });
    // comments come from GET /tasks/{id}/comments, so they are not part of the task details
    const taskDetail = t => Object.assign(taskView(t), {
        createdAt: t.createdAt, createdBy: memberName(t.createdBy),
        attachments: t.attachments,
        history: t.history.map(h => Object.assign({ byName: memberName(h.by) }, h)).sort((a, b) => b.at.localeCompare(a.at))
    });

    function getTask(user, id) {
        const t = visibleTasks(user).find(x => x.id === Number(id));
        if (!t) throw new HttpError(404, "Task not found.");
        return t;
    }

    /* ---------- route handlers ---------- */
    const routes = [];
    const route = (method, pattern, handler, publicRoute) =>
        routes.push({ method, regex: new RegExp("^" + pattern.replace(/:\w+/g, "(\\d+)") + "$"), handler, publicRoute });

    // ----- login and register
    route("POST", "/auth/login", ({ body }) => {
        const email = String(body.email || "").trim().toLowerCase();
        const member = db.members.find(m => m.email.toLowerCase() === email);
        if (!member || db.credentials[email] !== body.password) throw new HttpError(401, "Account not found or password is incorrect. Please register first.");
        if (!body.role) throw new HttpError(422, "Please select your role to continue.");
        if (body.role !== member.role) throw new HttpError(403, "The selected role does not match this account. Please choose the role used during registration.");
        sessionStorage.setItem(SESSION_KEY, String(member.id));
        return ok({ user: member, token: "mock-token-" + member.id }, "Signed in successfully.");
    }, true);
    route("POST", "/auth/register", ({ body }) => {
        const errors = {};
        const name = String(body.name || "").trim(), email = String(body.email || "").trim().toLowerCase();
        if (name.length < 2) errors.name = "Enter your full name.";
        if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
        if (!Permissions.ROLES.includes(body.role)) errors.role = "Choose a valid role.";
        if (String(body.password || "").length < 6) errors.password = "Password must contain at least 6 characters.";
        if (Object.keys(errors).length) throw new HttpError(422, Object.values(errors)[0], errors);
        if (db.members.some(m => m.email.toLowerCase() === email)) throw new HttpError(409, "An account with this email already exists. Please sign in.");
        db.members.push({ id: nextId(db.members), name, email, role: body.role });
        db.credentials[email] = body.password;
        save();
        return created({ email }, "Account created successfully. Please sign in.");
    }, true);
    route("POST", "/auth/logout", () => { sessionStorage.removeItem(SESSION_KEY); return ok(null, "Signed out."); }, true);
    route("GET", "/users/me", ({ user }) => ok(user));

    // ----- data for dropdowns
    route("GET", "/lookups", () => ok({
        projects: db.projects.map(p => ({ id: p.id, name: p.name, status: p.status, startDate: p.startDate, deadline: p.deadline, managerId: p.managerId })),
        members: db.members.map(m => ({ id: m.id, name: m.name, role: m.role })),
        managers: db.members.filter(m => m.role === "Project Manager" || m.role === "Administrator").map(m => ({ id: m.id, name: m.name, role: m.role }))
    }));

    // ----- dashboard (only what the signed in role may see)
    route("GET", "/dashboard", ({ user }) => {
        const isPM = user.role === "Project Manager";
        const projects = isPM ? db.projects.filter(p => p.managerId === user.id) : visibleProjects(user);
        const ids = new Set(projects.map(p => p.id));
        const tasks = isPM ? db.tasks.filter(t => ids.has(t.projectId)) : visibleTasks(user);
        const byDeadline = (a, b) => a.deadline.localeCompare(b.deadline);
        const reviewable = tasks.filter(t => t.status === "Review" && Permissions.canReviewTask(user, t));
        const open = db.members.map(m => {
            const mine = tasks.filter(t => t.assigneeId === m.id && t.status !== "Completed");
            return { name: m.name, role: m.role, open: mine.length, overdue: mine.filter(isOverdue).length };
        }).filter(w => w.open > 0).sort((a, b) => b.open - a.open).slice(0, 6);
        return ok({
            role: user.role,
            counts: {
                totalProjects: projects.length, activeProjects: projects.filter(p => p.status === "Active").length,
                completedProjects: projects.filter(p => p.status === "Completed").length, onHoldProjects: projects.filter(p => p.status === "On Hold").length,
                totalTasks: tasks.length, completedTasks: tasks.filter(t => t.status === "Completed").length,
                overdueTasks: tasks.filter(isOverdue).length,
                awaitingReview: user.role === "Team Member" ? tasks.filter(t => t.status === "Review").length : reviewable.length,   // a member sees their own tasks waiting for approval
                myOpenTasks: db.tasks.filter(t => t.assigneeId === user.id && t.status !== "Completed").length,
                totalUsers: db.members.length
            },
            byStatus: STATUSES.map(s => ({ status: s, count: tasks.filter(t => t.status === s).length })),
            projects: projects.slice().sort((a, b) => (a.status === "Active" ? 0 : 1) - (b.status === "Active" ? 0 : 1) || a.deadline.localeCompare(b.deadline)).slice(0, 5).map(projectView),
            myTasks: db.tasks.filter(t => t.assigneeId === user.id && t.status !== "Completed").sort(byDeadline).slice(0, 6).map(taskView),
            reviewQueue: reviewable.slice(0, 5).map(taskView),
            atRisk: projects.filter(p => p.status === "Active").map(p => ({ id: p.id, name: p.name, overdue: tasks.filter(t => t.projectId === p.id && isOverdue(t)).length })).filter(p => p.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5),
            workload: open,
            activities: db.activities.slice(0, 8)
        });
    });

    // ----- projects
    route("GET", "/projects", ({ query, user }) => {
        let list = visibleProjects(user).map(projectView);
        if (query.q) list = list.filter(p => includesText(p.name + " " + p.description + " " + p.managerName, query.q));
        if (query.status) list = list.filter(p => p.status === query.status);
        if (query.managerId) list = list.filter(p => p.managerId === Number(query.managerId));
        const sorters = { name: (a, b) => a.name.localeCompare(b.name), deadline: (a, b) => a.deadline.localeCompare(b.deadline), progress: (a, b) => b.progress - a.progress };
        list.sort(sorters[query.sort] || ((a, b) => b.id - a.id));
        const r = paginate(list, query);
        return ok(r.items, "OK", r.pagination);
    });
    function validateProject(user, body, existing) {
        const errors = {};
        const name = String(body.name || "").trim();
        if (!name) errors.name = "Project name is required.";
        else if (name.length > 70) errors.name = "Project name must be 70 characters or fewer.";
        if (!body.startDate) errors.startDate = "Start date is required.";
        if (!body.deadline) errors.deadline = "Deadline is required.";
        else if (body.startDate && body.deadline < body.startDate) errors.deadline = "Deadline cannot be earlier than the start date.";
        if (!PROJECT_STATUSES.includes(body.status)) errors.status = "Choose a valid status.";
        // only an administrator picks the manager, a project manager manages the projects they create
        let managerId = existing ? existing.managerId : user.id;
        if (Permissions.can(user.role, "project.assignManager")) {
            managerId = Number(body.managerId);
            const mgr = db.members.find(m => m.id === managerId);
            if (!mgr || (mgr.role !== "Project Manager" && mgr.role !== "Administrator")) errors.managerId = "The project manager must be a Project Manager or an Administrator.";
        }
        if (Object.keys(errors).length) throw new HttpError(422, Object.values(errors)[0], errors);
        return { name, description: String(body.description || "").trim(), startDate: body.startDate, deadline: body.deadline, status: body.status, managerId };
    }
    // optional starting team for POST /projects: a list of member ids (the manager is always in the team, so don't list them)
    function cleanMemberIds(list, managerId) {
        const ids = [];
        (Array.isArray(list) ? list : []).map(Number).forEach(id => {
            if (!db.members.some(m => m.id === id)) throw new HttpError(422, "One of the selected team members does not exist.", { memberIds: "One of the selected team members does not exist." });
            if (id !== managerId && !ids.includes(id)) ids.push(id);
        });
        return ids;
    }
    route("POST", "/projects", ({ body, user }) => {
        requirePermission(user, "project.create");
        const v = validateProject(user, body, null);
        const p = Object.assign({ id: nextId(db.projects), memberIds: cleanMemberIds(body.memberIds, v.managerId) }, v);
        db.projects.unshift(p);
        logActivity(user, "created the " + p.name + " project.", p.id);
        save();
        return created(projectView(p), "Project created successfully.");
    });
    route("GET", "/projects/:id", ({ params, user }) => ok(projectView(getProject(user, params[0]))));
    route("PUT", "/projects/:id", ({ params, body, user }) => {
        requirePermission(user, "project.edit");
        const p = db.projects.find(x => x.id === Number(params[0]));
        if (!p) throw new HttpError(404, "Project not found.");
        if (!Permissions.canEditProject(user, p)) throw new HttpError(403, "You can edit only the projects you manage.");
        Object.assign(p, validateProject(user, body, p));      // the team is changed with /projects/{id}/members, not here
        logActivity(user, "updated the " + p.name + " project.", p.id);
        save();
        return ok(projectView(p), "Project updated successfully.");
    });
    route("DELETE", "/projects/:id", ({ params, user }) => {
        requirePermission(user, "project.delete");
        const p = db.projects.find(x => x.id === Number(params[0]));
        if (!p) throw new HttpError(404, "Project not found.");
        const removed = db.tasks.filter(t => t.projectId === p.id).length;
        db.tasks = db.tasks.filter(t => t.projectId !== p.id);
        db.projects = db.projects.filter(x => x.id !== p.id);
        logActivity(user, "deleted the " + p.name + " project.", null);
        save();
        return ok(null, "Project deleted" + (removed ? " together with " + removed + " task(s)." : "."));
    });

    // ----- project team (GET and POST /projects/{id}/members; DELETE is extra so the screen can remove people)
    function teamRows(user, p) {
        const ids = [p.managerId, ...(p.memberIds || []).filter(id => id !== p.managerId)];
        const rows = ids.map(id => db.members.find(m => m.id === id)).filter(Boolean).map(m => {
            const row = { id: m.id, name: m.name, role: m.role, isManager: m.id === p.managerId, tasks: taskSummary(m.id, p.id) };
            if (user.role !== "Team Member") row.email = m.email;         // members don't see each other's email
            return row;
        });
        return rows.sort((a, b) => (b.isManager - a.isManager) || a.name.localeCompare(b.name));
    }
    route("GET", "/projects/:id/members", ({ params, user }) => ok(teamRows(user, getProject(user, params[0]))));
    route("POST", "/projects/:id/members", ({ params, body, user }) => {
        const p = getProject(user, params[0]);
        if (!Permissions.canManageProjectTeam(user, p)) throw new HttpError(403, "Only an administrator or the manager of this project can change its team.");
        const m = db.members.find(x => x.id === Number(body.memberId));
        if (!m) throw new HttpError(422, "Choose a person to add.", { memberId: "Choose a person to add." });
        if (onTeam(p, m.id)) throw new HttpError(409, m.name + " is already on the " + p.name + " team.");
        p.memberIds = (p.memberIds || []).concat(m.id);
        logActivity(user, "added " + m.name + " to the " + p.name + " team.", p.id);
        save();
        return created(teamRows(user, p).find(r => r.id === m.id), m.name + " was added to the " + p.name + " team.");
    });
    route("DELETE", "/projects/:id/members/:memberId", ({ params, user }) => {
        const p = getProject(user, params[0]);
        if (!Permissions.canManageProjectTeam(user, p)) throw new HttpError(403, "Only an administrator or the manager of this project can change its team.");
        const m = db.members.find(x => x.id === Number(params[1]));
        if (!m || !onTeam(p, m.id)) throw new HttpError(404, "That person is not on this project's team.");
        if (m.id === p.managerId) throw new HttpError(409, m.name + " manages this project. Assign a different manager before removing them.");
        const open = db.tasks.filter(t => t.projectId === p.id && t.assigneeId === m.id && t.status !== "Completed").length;
        if (open) throw new HttpError(409, m.name + " still has " + open + " open task(s) in this project. Reassign them first.");
        p.memberIds = p.memberIds.filter(id => id !== m.id);
        logActivity(user, "removed " + m.name + " from the " + p.name + " team.", p.id);
        save();
        return ok(null, m.name + " was removed from the team.");
    });

    // ----- members
    route("GET", "/members", ({ query, user }) => {
        if (!Permissions.canViewPage(user.role, "team")) throw new HttpError(403, "Your role cannot view the team directory.");
        let list = db.members.map(memberView);
        if (query.q) list = list.filter(m => includesText(m.name + " " + m.email, query.q));
        if (query.role) list = list.filter(m => m.role === query.role);
        const sorters = { name: (a, b) => a.name.localeCompare(b.name), role: (a, b) => a.role.localeCompare(b.role), workload: (a, b) => b.openTasks - a.openTasks };
        list.sort(sorters[query.sort] || ((a, b) => a.id - b.id));
        const r = paginate(list, query);
        return ok(r.items, "OK", r.pagination);
    });
    route("POST", "/members", ({ body, user }) => {
        requirePermission(user, "member.add");
        const errors = {};
        const name = String(body.name || "").trim(), email = String(body.email || "").trim().toLowerCase();
        if (name.length < 2) errors.name = "Enter the member's full name.";
        if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
        if (!Permissions.rolesUserMayAssign(user.role).includes(body.role)) errors.role = "You cannot add a member with this role.";
        if (Object.keys(errors).length) throw new HttpError(422, Object.values(errors)[0], errors);
        if (db.members.some(m => m.email.toLowerCase() === email)) throw new HttpError(409, "A member with this email already exists.");
        const m = { id: nextId(db.members), name, email, role: body.role };
        db.members.push(m);
        db.credentials[email] = "demo1234";
        logActivity(user, "added " + name + " to the team.");
        save();
        return created(memberView(m), "Member added. Their temporary password is demo1234 (mock mode).");
    });
    route("PUT", "/members/:id", ({ params, body, user }) => {
        requirePermission(user, "member.changeRole");
        const m = db.members.find(x => x.id === Number(params[0]));
        if (!m) throw new HttpError(404, "Member not found.");
        if (!Permissions.ROLES.includes(body.role)) throw new HttpError(422, "Choose a valid role.", { role: "Choose a valid role." });
        if (m.id === user.id) throw new HttpError(409, "You cannot change your own role.");
        const manages = db.projects.filter(p => p.managerId === m.id).length;
        if (manages && body.role !== "Project Manager" && body.role !== "Administrator") throw new HttpError(409, m.name + " manages " + manages + " project(s). Assign those projects to someone else before changing this role.");
        m.role = body.role;
        logActivity(user, "changed the role of " + m.name + " to " + m.role + ".");
        save();
        return ok(memberView(m), "Role updated.");
    });
    route("DELETE", "/members/:id", ({ params, user }) => {
        requirePermission(user, "member.remove");
        const m = db.members.find(x => x.id === Number(params[0]));
        if (!m) throw new HttpError(404, "Member not found.");
        if (m.id === user.id) throw new HttpError(409, "You cannot remove your own account.");
        if (!Permissions.rolesUserMayAssign(user.role).includes(m.role)) throw new HttpError(403, "You cannot remove a member with the role " + m.role + ".");
        const open = db.tasks.filter(t => t.assigneeId === m.id && t.status !== "Completed").length;
        if (open) throw new HttpError(409, m.name + " still has " + open + " open task(s). Reassign them before removing this member.");
        const manages = db.projects.filter(p => p.managerId === m.id).length;
        if (manages) throw new HttpError(409, m.name + " manages " + manages + " project(s). Assign those projects to someone else first.");
        db.projects.forEach(p => { p.memberIds = (p.memberIds || []).filter(id => id !== m.id); });
        db.members = db.members.filter(x => x.id !== m.id);
        delete db.credentials[m.email.toLowerCase()];
        logActivity(user, "removed " + m.name + " from the team.");
        save();
        return ok(null, "Member removed.");
    });

    // ----- tasks
    function listTasks(user, query, projectId) {
        let list = visibleTasks(user).map(taskView);
        if (projectId) list = list.filter(t => t.projectId === projectId);
        if (query.q) list = list.filter(t => includesText(t.title + " " + t.description + " " + t.projectName + " " + t.assigneeName, query.q));
        if (query.status) list = list.filter(t => t.status === query.status);
        if (query.priority) list = list.filter(t => t.priority === query.priority);
        if (query.assigneeId) list = list.filter(t => t.assigneeId === Number(query.assigneeId));
        if (query.deadlineFrom) list = list.filter(t => t.deadline >= query.deadlineFrom);
        if (query.deadlineTo) list = list.filter(t => t.deadline <= query.deadlineTo);
        if (query.overdue === "true") list = list.filter(t => t.overdue);
        const rank = { High: 0, Medium: 1, Low: 2 };
        const sorters = {
            deadline: (a, b) => a.deadline.localeCompare(b.deadline), "-deadline": (a, b) => b.deadline.localeCompare(a.deadline),
            priority: (a, b) => rank[a.priority] - rank[b.priority], title: (a, b) => a.title.localeCompare(b.title),
            status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
        };
        list.sort(sorters[query.sort] || ((a, b) => b.id - a.id));
        const r = paginate(list, query);
        return ok(r.items, "OK", r.pagination);
    }
    route("GET", "/tasks", ({ query, user }) => listTasks(user, query, query.projectId ? Number(query.projectId) : null));
    route("GET", "/projects/:id/tasks", ({ params, query, user }) => listTasks(user, query, getProject(user, params[0]).id));
    route("GET", "/tasks/:id", ({ params, user }) => ok(taskDetail(getTask(user, params[0]))));

    function validateTask(body, existing) {
        const errors = {};
        const title = String(body.title || "").trim();
        if (!title) errors.title = "Task title is required.";
        else if (title.length > 100) errors.title = "Task title must be 100 characters or fewer.";
        const project = db.projects.find(p => p.id === Number(body.projectId));
        const assignee = db.members.find(m => m.id === Number(body.assigneeId));
        if (!project) errors.projectId = "Choose a project.";
        if (!assignee) errors.assigneeId = "Choose an assignee.";
        if (!PRIORITIES.includes(body.priority)) errors.priority = "Choose a priority.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.deadline || "")) errors.deadline = "Choose a deadline.";
        if (!STATUSES.includes(body.status)) errors.status = "Choose a status.";
        // tasks go to people in the project team (a task keeps its assignee if it already has one)
        if (project && assignee && !errors.assigneeId && !onTeam(project, assignee.id) && !(existing && existing.projectId === project.id && existing.assigneeId === assignee.id))
            errors.assigneeId = assignee.name + " is not on the " + project.name + " team. Add them to the project team first.";
        // the deadline must be inside the project dates (checked when it is new or changed)
        if (project && !errors.deadline && (!existing || existing.deadline !== body.deadline || existing.projectId !== project.id) && (body.deadline < project.startDate || body.deadline > project.deadline))
            errors.deadline = "The deadline must fall inside the project dates (" + prettyDate(project.startDate) + " to " + prettyDate(project.deadline) + ").";
        if (Object.keys(errors).length) throw new HttpError(422, Object.values(errors)[0], errors);
        return { title, description: String(body.description || "").trim(), projectId: Number(body.projectId), assigneeId: Number(body.assigneeId), priority: body.priority, deadline: body.deadline, status: body.status };
    }
    route("POST", "/projects/:id/tasks", ({ params, body, user }) => {
        requirePermission(user, "task.create");
        const project = db.projects.find(x => x.id === Number(params[0]));
        if (!project) throw new HttpError(404, "Project not found.");
        const v = validateTask(Object.assign({}, body, { projectId: project.id }), null);       // the project in the path wins
        if (v.status === "Completed") throw new HttpError(422, "A new task cannot start as Completed.", { status: "A new task cannot start as Completed." });
        const t = Object.assign({ id: nextId(db.tasks), createdAt: nowIso(), createdBy: user.id, reviewComment: "", comments: [], attachments: [], history: [] }, v);
        addHistory(t, user, "created", "Task created and assigned to " + memberName(t.assigneeId));
        db.tasks.unshift(t);
        logActivity(user, "created the task “" + t.title + "”.", t.projectId);
        save();
        return created(taskDetail(t), "Task created successfully.");
    });
    route("PUT", "/tasks/:id", ({ params, body, user }) => {
        requirePermission(user, "task.edit");
        const t = getTask(user, params[0]);
        const v = validateTask(body, t);
        if (v.status !== t.status && !Permissions.canMoveTask(user, t, v.status)) throw new HttpError(403, "You cannot move this task to " + v.status + ".");
        if (v.assigneeId !== t.assigneeId) addHistory(t, user, "assignment", "Reassigned from " + memberName(t.assigneeId) + " to " + memberName(v.assigneeId));
        if (v.priority !== t.priority) addHistory(t, user, "priority", "Priority changed from " + t.priority + " to " + v.priority);
        if (v.deadline !== t.deadline) addHistory(t, user, "deadline", "Deadline changed from " + t.deadline + " to " + v.deadline);
        if (v.status !== t.status) addHistory(t, user, "status", "Status changed from " + t.status + " to " + v.status, { from: t.status, to: v.status });
        if (v.title !== t.title || v.description !== t.description || v.projectId !== t.projectId) addHistory(t, user, "edit", "Task details updated");
        Object.assign(t, v);
        logActivity(user, "updated the task “" + t.title + "”.", t.projectId);
        save();
        return ok(taskDetail(t), "Task updated successfully.");
    });
    route("PATCH", "/tasks/:id/status", ({ params, body, user }) => {
        const t = getTask(user, params[0]);
        if (!STATUSES.includes(body.status)) throw new HttpError(422, "Choose a valid status.");
        if (body.status === t.status) return ok(taskView(t), "Status unchanged.");
        if (!Permissions.canMoveTask(user, t, body.status)) throw new HttpError(403, body.status === "Completed" ? "Only a reviewer can complete a task. Submit it for review instead." : "You cannot change the status of this task.");
        addHistory(t, user, "status", "Status changed from " + t.status + " to " + body.status, { from: t.status, to: body.status });
        if (body.status === "Review") logActivity(user, "submitted “" + t.title + "” for review.", t.projectId);
        else logActivity(user, "moved “" + t.title + "” to " + body.status + ".", t.projectId);
        t.status = body.status;
        save();
        return ok(taskView(t), "Task status updated.");
    });
    route("GET", "/tasks/:id/comments", ({ params, user }) => ok(getTask(user, params[0]).comments.slice().sort((a, b) => a.at.localeCompare(b.at))));
    route("POST", "/tasks/:id/comments", ({ params, body, user }) => {
        requirePermission(user, "task.comment");
        const t = getTask(user, params[0]);
        const text = String(body.text || "").trim();
        if (!text) throw new HttpError(422, "Write a comment first.", { text: "Write a comment first." });
        if (text.length > 500) throw new HttpError(422, "Comments can be up to 500 characters.", { text: "Comments can be up to 500 characters." });
        const comment = { id: nextId(t.comments), byId: user.id, by: user.name, text, at: nowIso() };
        t.comments.push(comment);
        addHistory(t, user, "comment", "Added a comment");
        save();
        return created(comment, "Comment added.");
    });
    route("POST", "/tasks/:id/attachments", ({ params, body, user }) => {
        requirePermission(user, "task.attach");
        const t = getTask(user, params[0]);
        const file = body instanceof FormData ? body.get("file") : body.file;
        if (!file || !file.name) throw new HttpError(422, "Choose a file to attach.");
        const ext = file.name.split(".").pop().toLowerCase();
        if (!CFG.ALLOWED_ATTACHMENT_EXT.includes(ext)) throw new HttpError(415, "This file type is not allowed. Allowed: " + CFG.ALLOWED_ATTACHMENT_EXT.join(", ") + ".");
        if (file.size > CFG.MAX_ATTACHMENT_MB * 1024 * 1024) throw new HttpError(413, "The file is larger than " + CFG.MAX_ATTACHMENT_MB + " MB.");
        t.attachments.push({ id: nextId(t.attachments), name: file.name, size: file.size, type: file.type || ext, by: user.name, byId: user.id, at: nowIso() });
        addHistory(t, user, "attachment", "Attached " + file.name);
        save();   // mock mode only saves the file details, not the file
        return created(taskDetail(t), "File attached.");
    });
    route("DELETE", "/tasks/:id/attachments/:id", ({ params, user }) => {
        const t = getTask(user, params[0]);
        const a = t.attachments.find(x => x.id === Number(params[1]));
        if (!a) throw new HttpError(404, "Attachment not found.");
        if (a.byId !== user.id && !["Administrator", "Project Manager"].includes(user.role)) throw new HttpError(403, "You can remove only your own attachments.");
        t.attachments = t.attachments.filter(x => x.id !== a.id);
        addHistory(t, user, "attachment", "Removed " + a.name);
        save();
        return ok(taskDetail(t), "Attachment removed.");
    });
    route("POST", "/tasks/:id/reviews", ({ params, body, user }) => {
        requirePermission(user, "task.review");
        const t = getTask(user, params[0]);
        if (t.status !== "Review") throw new HttpError(409, "Only tasks in Review can be approved or sent back.");
        if (!Permissions.canReviewTask(user, t)) throw new HttpError(403, "You cannot review your own task.");
        const comment = String(body.comment || "").trim();
        if (body.decision === "approve") {
            t.status = "Completed"; t.reviewComment = comment || "Approved";
            addHistory(t, user, "review", "Approved" + (comment ? ": " + comment : ""), { from: "Review", to: "Completed", decision: "approve", comment });
            logActivity(user, "approved “" + t.title + "”.", t.projectId);
        } else if (body.decision === "changes") {
            if (!comment) throw new HttpError(422, "Please describe the changes required.", { comment: "Please describe the changes required." });
            t.status = "In Progress"; t.reviewComment = comment;
            addHistory(t, user, "review", "Changes requested: " + comment, { from: "Review", to: "In Progress", decision: "changes", comment });
            logActivity(user, "requested changes on “" + t.title + "”.", t.projectId);
        } else throw new HttpError(422, "Decision must be approve or changes.");
        save();
        return created(taskDetail(t), body.decision === "approve" ? "Task approved." : "Changes requested and comment saved.");
    });
    // review decisions across tasks (extra endpoint): one row per approve or request-changes, newest first
    route("GET", "/reviews", ({ query, user }) => {
        requirePermission(user, "review.view");
        let rows = [];
        db.tasks.forEach(t => t.history.filter(h => h.type === "review").forEach((h, i) => rows.push({
            id: t.id * 1000 + i, taskId: t.id, taskTitle: t.title, projectId: t.projectId, projectName: projectName(t.projectId),
            assigneeName: memberName(t.assigneeId), reviewerId: h.by, reviewerName: memberName(h.by),
            decision: h.decision || (h.to === "Completed" ? "approve" : "changes"), comment: h.comment || "", at: h.at
        })));
        if (query.decision) rows = rows.filter(r => r.decision === query.decision);
        if (query.projectId) rows = rows.filter(r => r.projectId === Number(query.projectId));
        rows.sort((a, b) => b.at.localeCompare(a.at));
        const r = paginate(rows, query);
        return ok(r.items, "OK", r.pagination);
    });

    // ----- reports (tasks are filtered by deadline date, from and to)
    function reportTasks(user, q) {
        if (!Permissions.can(user.role, "report.view")) throw new HttpError(403, "Your role cannot view reports.");
        if (q.from && q.to && q.to < q.from) throw new HttpError(422, "The end date cannot be earlier than the start date.");
        return db.tasks.filter(t => (!q.from || t.deadline >= q.from) && (!q.to || t.deadline <= q.to) && (!q.projectId || t.projectId === Number(q.projectId)));
    }
    function tally(list) {
        const done = list.filter(t => t.status === "Completed").length;
        return {
            total: list.length, completed: done, review: list.filter(t => t.status === "Review").length,
            inProgress: list.filter(t => t.status === "In Progress").length, todo: list.filter(t => t.status === "To Do").length,
            overdue: list.filter(isOverdue).length, completionRate: list.length ? Math.round(done / list.length * 100) : 0
        };
    }
    route("GET", "/reports/progress", ({ query, user }) => {
        const tasks = reportTasks(user, query);
        const byProject = db.projects.map(p => Object.assign({ projectId: p.id, name: p.name, manager: memberName(p.managerId), status: p.status }, tally(tasks.filter(t => t.projectId === p.id))))
            .filter(r => r.total > 0);
        return ok({ summary: tally(tasks), byProject, filters: { from: query.from || null, to: query.to || null, projectId: query.projectId ? Number(query.projectId) : null } });
    });
    route("GET", "/reports/team", ({ query, user }) => {
        const tasks = reportTasks(user, query);
        const byMember = db.members.map(m => Object.assign({ memberId: m.id, name: m.name, role: m.role }, tally(tasks.filter(t => t.assigneeId === m.id))))
            .filter(r => r.total > 0).sort((a, b) => b.total - a.total);
        return ok({ summary: tally(tasks), byMember, filters: { from: query.from || null, to: query.to || null, projectId: query.projectId ? Number(query.projectId) : null } });
    });

    // progress of one project. The percentage is calculated here (the "backend"), the screen only shows it
    route("GET", "/projects/:id/progress", ({ params, query, user }) => {
        const p = getProject(user, params[0]);
        if (query.from && query.to && query.to < query.from) throw new HttpError(422, "The end date cannot be earlier than the start date.");
        const all = db.tasks.filter(t => t.projectId === p.id);
        const tasks = all.filter(t => (!query.from || t.deadline >= query.from) && (!query.to || t.deadline <= query.to));
        const scope = user.role === "Team Member" ? tasks.filter(t => t.assigneeId === user.id) : tasks;     // a member only sees their own row
        const people = new Set(scope.map(t => t.assigneeId));
        const byMember = db.members.filter(m => people.has(m.id)).map(m => Object.assign({ memberId: m.id, name: m.name, role: m.role }, tally(scope.filter(t => t.assigneeId === m.id))))
            .sort((a, b) => b.total - a.total);
        return ok({
            project: { id: p.id, name: p.name, status: p.status, startDate: p.startDate, deadline: p.deadline, managerName: memberName(p.managerId) },
            progress: projectView(p).progress,                           // overall completion, ignores the date filter
            summary: tally(tasks), byMember,
            byStatus: STATUSES.map(s => ({ status: s, count: tasks.filter(t => t.status === s).length })),
            filters: { from: query.from || null, to: query.to || null }
        });
    });

    // ----- admin dashboard and activity log
    route("GET", "/admin/activities", ({ query, user }) => {
        if (user.role !== "Administrator") throw new HttpError(403, "Only administrators can view the activity log.");
        let rows = db.activities.map(a => Object.assign({}, a, { projectName: a.projectId ? projectName(a.projectId) : "" }));
        if (query.q) rows = rows.filter(a => includesText(a.person + " " + a.message + " " + a.projectName, query.q));
        if (query.projectId) rows = rows.filter(a => a.projectId === Number(query.projectId));
        if (query.from && query.to && query.to < query.from) throw new HttpError(422, "The end date cannot be earlier than the start date.");
        if (query.from) rows = rows.filter(a => a.at.slice(0, 10) >= query.from);
        if (query.to) rows = rows.filter(a => a.at.slice(0, 10) <= query.to);
        rows.sort((a, b) => b.at.localeCompare(a.at));
        const r = paginate(rows, query);
        return ok(r.items, "OK", r.pagination);
    });
    route("GET", "/admin/dashboard", ({ user }) => {
        if (user.role !== "Administrator") throw new HttpError(403, "Only administrators can view system statistics.");
        const week = new Date(Date.now() - 7 * 864e5).toISOString();
        const count = (list, key, values) => values.map(v => ({ label: v, count: list.filter(x => x[key] === v).length }));
        return ok({
            users: db.members.length, projects: db.projects.length, tasks: db.tasks.length,
            overdueTasks: db.tasks.filter(isOverdue).length, awaitingReview: db.tasks.filter(t => t.status === "Review").length,
            attachments: db.tasks.reduce((n, t) => n + t.attachments.length, 0), comments: db.tasks.reduce((n, t) => n + t.comments.length, 0),
            activityLast7Days: db.activities.filter(a => a.at >= week).length,
            usersByRole: count(db.members, "role", Permissions.ROLES), projectsByStatus: count(db.projects, "status", PROJECT_STATUSES),
            tasksByStatus: count(db.tasks, "status", STATUSES), tasksByPriority: count(db.tasks, "priority", PRIORITIES),
            activeProjects: db.projects.filter(p => p.status === "Active").length, completedProjects: db.projects.filter(p => p.status === "Completed").length,
            system: { dataSource: "Browser localStorage (mock server)", apiVersion: "mock-2.1" }
        });
    });

    /* ---------- entry point used by api.js ---------- */
    async function handle(method, path, query, body) {
        try {
            await init();
            await new Promise(r => setTimeout(r, CFG.MOCK_DELAY_MS));
            const r = routes.find(x => x.method === method && x.regex.test(path));
            if (!r) throw new HttpError(404, "Endpoint not found: " + method + " " + path);
            let user = null;
            if (!r.publicRoute) {
                user = db.members.find(m => String(m.id) === sessionStorage.getItem(SESSION_KEY));
                if (!user) throw new HttpError(401, "Your session has ended. Please sign in again.");
            }
            const params = (path.match(r.regex) || []).slice(1);
            return r.handler({ params, query: query || {}, body: body || {}, user });
        } catch (e) {
            if (e instanceof HttpError) return { status: e.status, body: { success: false, message: e.message, errors: e.errors } };
            throw e;
        }
    }
    return { handle, reset, init };
})();
