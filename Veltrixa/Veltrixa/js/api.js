/* Fetch layer. Every request in the app goes through Api.request(), which
     - sends the request to the Java backend with fetch() (or to the mock server in demo mode)
     - tells the screen when to show or hide the loading bar
     - turns every failure into one ApiError with a readable message
     - goes to the login page when the server answers 401
   The JSON response looks like: { "success": true|false, "message": "...", "data": ..., "pagination": {...}, "errors": {...} } */
const Api = (() => {
    const CFG = Object.assign({}, window.VELTRIXA_CONFIG);
    const body = document.body.dataset;                       // JSP pages pass the API address here
    if (body.apiBase) { CFG.API_BASE_URL = body.apiBase; CFG.USE_MOCK = false; }

    class ApiError extends Error {
        constructor(message, status, errors) { super(message); this.name = "ApiError"; this.status = status || 0; this.errors = errors || null; }
    }

    let pending = 0, loadingListener = () => {}, unauthorizedListener = () => {};
    const track = delta => { pending += delta; loadingListener(pending > 0); };

    function toQueryString(params) {
        const q = new URLSearchParams();
        Object.entries(params || {}).forEach(([k, v]) => { if (v !== "" && v !== null && v !== undefined) q.append(k, v); });
        const text = q.toString();
        return text ? "?" + text : "";
    }

    async function liveFetch(method, path, query, payload) {
        const headers = { "Accept": "application/json" };
        const options = { method, headers, credentials: "include" };         // sends the Java session cookie
        const token = sessionStorage.getItem("veltrixa_token");               // optional, for JWT login
        if (token) headers["Authorization"] = "Bearer " + token;
        if (payload instanceof FormData) options.body = payload;             // file upload: the browser sets the boundary
        else if (payload !== undefined && method !== "GET") { headers["Content-Type"] = "application/json"; options.body = JSON.stringify(payload); }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CFG.REQUEST_TIMEOUT_MS);
        options.signal = controller.signal;
        try {
            const res = await fetch(CFG.API_BASE_URL + path + toQueryString(query), options);
            let json = null;
            try { json = await res.json(); } catch (e) { /* response was not JSON */ }
            return { status: res.status, body: json || { success: res.ok, message: res.ok ? "OK" : "The server returned an unexpected response (HTTP " + res.status + ")." } };
        } finally { clearTimeout(timer); }
    }

    async function request(method, path, { query, data, silent } = {}) {
        if (!silent) track(1);
        try {
            let res;
            try {
                res = CFG.USE_MOCK ? await MockServer.handle(method, path, query, data) : await liveFetch(method, path, query, data);
            } catch (e) {
                if (e.status) throw new ApiError(e.message, e.status);
                throw new ApiError(e.name === "AbortError" ? "The server took too long to respond. Please try again." : "Could not reach the server. Check your connection and try again.", 0);
            }
            const ok = res.status >= 200 && res.status < 300 && res.body.success !== false;
            if (!ok) {
                if (res.status === 401 && !silent && !path.startsWith("/auth/")) unauthorizedListener();      // the quiet /users/me check at start is allowed to fail
                throw new ApiError(res.body.message || "Something went wrong.", res.status, res.body.errors);
            }
            return res.body;
        } finally { if (!silent) track(-1); }
    }

    const get = (path, query, opts) => request("GET", path, Object.assign({ query }, opts));
    const send = (method, path, data) => request(method, path, { data });
    const Api_listProjectTasks = q => { const { projectId, ...rest } = q; return get("/projects/" + projectId + "/tasks", rest); };

    return {
        ApiError, config: CFG,
        onLoading: fn => { loadingListener = fn; },
        onUnauthorized: fn => { unauthorizedListener = fn; },
        saveToken: token => token ? sessionStorage.setItem("veltrixa_token", token) : sessionStorage.removeItem("veltrixa_token"),

        // login
        login: b => send("POST", "/auth/login", b),
        register: b => send("POST", "/auth/register", b),
        logout: () => send("POST", "/auth/logout"),
        me: () => get("/users/me", null, { silent: true }),

        // data for dropdowns, dashboard and admin
        lookups: () => get("/lookups"),
        dashboard: () => get("/dashboard"),
        adminDashboard: () => get("/admin/dashboard"),
        adminActivities: q => get("/admin/activities", q),

        // projects
        listProjects: q => get("/projects", q),
        getProject: id => get("/projects/" + id),
        createProject: b => send("POST", "/projects", b),
        updateProject: (id, b) => send("PUT", "/projects/" + id, b),
        deleteProject: id => send("DELETE", "/projects/" + id),
        projectProgress: (id, q) => get("/projects/" + id + "/progress", q),

        // project team
        listProjectMembers: id => get("/projects/" + id + "/members"),
        addProjectMember: (id, memberId) => send("POST", "/projects/" + id + "/members", { memberId }),
        removeProjectMember: (id, memberId) => send("DELETE", "/projects/" + id + "/members/" + memberId),

        // team members
        listMembers: q => get("/members", q),
        addMember: b => send("POST", "/members", b),
        changeMemberRole: (id, role) => send("PUT", "/members/" + id, { role }),
        removeMember: id => send("DELETE", "/members/" + id),

        // tasks. With a projectId the list comes from GET /projects/{id}/tasks, otherwise from GET /tasks (all tasks the user can see)
        listProjectTasks: (projectId, q) => get("/projects/" + projectId + "/tasks", q),
        listTasks: q => q && q.projectId ? Api_listProjectTasks(q) : get("/tasks", q),
        getTask: id => get("/tasks/" + id),
        createTask: (projectId, b) => send("POST", "/projects/" + projectId + "/tasks", b),
        updateTask: (id, b) => send("PUT", "/tasks/" + id, b),
        updateTaskStatus: (id, status) => send("PATCH", "/tasks/" + id + "/status", { status }),
        listComments: id => get("/tasks/" + id + "/comments"),
        addComment: (id, text) => send("POST", "/tasks/" + id + "/comments", { text }),
        uploadAttachment: (id, file) => { const f = new FormData(); f.append("file", file); return send("POST", "/tasks/" + id + "/attachments", f); },
        deleteAttachment: (taskId, attId) => send("DELETE", "/tasks/" + taskId + "/attachments/" + attId),
        reviewTask: (id, decision, comment) => send("POST", "/tasks/" + id + "/reviews", { decision, comment }),
        listReviews: q => get("/reviews", q),

        // reports
        progressReport: q => get("/reports/progress", q),
        teamReport: q => get("/reports/team", q)
    };
})();
