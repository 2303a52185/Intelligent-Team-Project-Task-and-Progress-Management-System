/* Veltrixa frontend demo
   Uses localStorage so sample changes remain after refreshing this browser.
   This is not a secure login system and does not replace the Java backend. */
const STORAGE_KEY = "veltrixa_demo_data_v1";
const DEFAULT_DATA = {
    "projects": [
        {
            "id": 1,
            "name": "FoodFinder",
            "description": "Restaurant recommendation web application",
            "startDate": "2026-10-20",
            "deadline": "2026-11-30",
            "manager": "Athiqa",
            "status": "Active",
            "progress": 65
        },
        {
            "id": 2,
            "name": "Student Portal",
            "description": "Student academic information portal",
            "startDate": "2026-10-25",
            "deadline": "2026-12-05",
            "manager": "Rahul",
            "status": "Active",
            "progress": 40
        },
        {
            "id": 3,
            "name": "AI Prediction",
            "description": "Machine learning prediction dashboard",
            "startDate": "2026-09-15",
            "deadline": "2026-10-28",
            "manager": "Priya",
            "status": "Completed",
            "progress": 100
        }
    ],
    "members": [
        {
            "id": 1,
            "name": "Athiqa",
            "email": "athiqa@example.com",
            "role": "Project Manager",
            "tasks": 4
        },
        {
            "id": 2,
            "name": "Rahul",
            "email": "rahul@example.com",
            "role": "Team Leader",
            "tasks": 5
        },
        {
            "id": 3,
            "name": "Priya",
            "email": "priya@example.com",
            "role": "Team Member",
            "tasks": 3
        },
        {
            "id": 4,
            "name": "Arjun",
            "email": "arjun@example.com",
            "role": "Team Member",
            "tasks": 2
        }
    ],
    "tasks": [
        {
            "id": 1,
            "title": "Design login page",
            "description": "Create a responsive login page and validate required fields.",
            "project": "FoodFinder",
            "assignee": "Priya",
            "priority": "High",
            "deadline": "2026-11-01",
            "status": "Completed",
            "comments": [
                {
                    "by": "Priya",
                    "text": "Initial design completed."
                }
            ],
            "reviewComment": "Looks good."
        },
        {
            "id": 2,
            "title": "Build dashboard cards",
            "description": "Create dashboard summary cards using Bootstrap.",
            "project": "FoodFinder",
            "assignee": "Athiqa",
            "priority": "Medium",
            "deadline": "2026-11-08",
            "status": "In Progress",
            "comments": [],
            "reviewComment": ""
        },
        {
            "id": 3,
            "title": "Prepare student profile screen",
            "description": "Build student profile details page.",
            "project": "Student Portal",
            "assignee": "Arjun",
            "priority": "Low",
            "deadline": "2026-11-06",
            "status": "To Do",
            "comments": [],
            "reviewComment": ""
        },
        {
            "id": 4,
            "title": "Test prediction results",
            "description": "Check model output display and edge cases.",
            "project": "AI Prediction",
            "assignee": "Rahul",
            "priority": "High",
            "deadline": "2026-10-28",
            "status": "Completed",
            "comments": [],
            "reviewComment": ""
        },
        {
            "id": 5,
            "title": "Review project documentation",
            "description": "Review README and user instructions.",
            "project": "Student Portal",
            "assignee": "Athiqa",
            "priority": "Medium",
            "deadline": "2026-11-12",
            "status": "Review",
            "comments": [],
            "reviewComment": ""
        }
    ],
    "activities": [
        {
            "id": 1,
            "person": "Priya",
            "message": "completed the login page design.",
            "when": "Today · 10:20 AM"
        },
        {
            "id": 2,
            "person": "Rahul",
            "message": "updated the FoodFinder project timeline.",
            "when": "Today · 09:45 AM"
        },
        {
            "id": 3,
            "person": "Arjun",
            "message": "started work on the student profile screen.",
            "when": "Yesterday"
        }
    ]
};
// Load the saved demo data when the page starts.
let data = loadData();
let currentUser = {
    name: "Athiqa", role: "Team Member", email: "athiqa@example.com"
};
let activePage = "dashboard";
let editingRecord = null;
const pageInfo = {
    dashboard:["Dashboard","Your workspace at a glance."],
    projects:["Projects","Create, update and track your projects."],
    team:["Team members","Manage the people working across your projects."],
    tasks:["Task management","Create tasks, assign owners and set priorities."],
    board:["Task board","Track work as it moves through each stage."],
    reports:["Progress reports","Understand project completion and task status."],
    approvals:["Review & approvals","Review submitted work and provide feedback."],
    admin:["Administration","View users, roles and workspace-level information."]
};
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
        weekday:"long",day:"numeric",month:"long",year:"numeric"
    })
    .toUpperCase();
    document.getElementById("loginForm").addEventListener("submit", login);
    document.getElementById("registerForm").addEventListener("submit", registerUser);
    document.getElementById("showRegister").addEventListener("click", showRegisterForm);
    document.getElementById("showLogin").addEventListener("click", showLoginForm);
    document.getElementById("logoutButton").addEventListener("click", logout);
    document.getElementById("mainNav").addEventListener("click", navClick);
    document.getElementById("topAction").addEventListener("click", () => openCreate(activePage === "tasks" ? "task" : "project"));
    document.getElementById("recordForm").addEventListener("submit", saveRecord);
    document.getElementById("pageContent").addEventListener("click", pageAction);
    document.getElementById("pageContent").addEventListener("change", pageChange);
    document.getElementById("pageContent").addEventListener("input", pageInput);
})
;
// Read saved data from this browser. If there is none, use the sample data.
function loadData() {
    try {
        const saved=localStorage.getItem(STORAGE_KEY);
        return saved?JSON.parse(saved):structuredClone(DEFAULT_DATA);
    }
    catch(e) {
        return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
}
// Save the latest changes so they are still here after a refresh.
function persist() {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}
// Read the accounts created from the registration form.
function getRegisteredUsers() {
    return JSON.parse(localStorage.getItem("veltrixa_registered_users") || "[]");
}

// Show success messages in green and errors in red.
function setAuthMessage(elementId, message, type) {
    const messageBox = document.getElementById(elementId);
    messageBox.textContent = message;
    messageBox.classList.remove("success", "error");
    if (message) {
        messageBox.classList.add(type);
    }
}

// Switch between sign-in and registration screens.
function showRegisterForm() {
    document.getElementById("loginPanel").classList.add("d-none");
    document.getElementById("registerPanel").classList.remove("d-none");
    setAuthMessage("registerError", "", "");
}
function showLoginForm() {
    document.getElementById("registerPanel").classList.add("d-none");
    document.getElementById("loginPanel").classList.remove("d-none");
    setAuthMessage("loginError", "", "");
}

// Create and save a new user account in this browser.
function registerUser(e) {
    e.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const role = document.getElementById("registerRole").value;
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const error = document.getElementById("registerError");

    if (password.length < 6) {
        setAuthMessage("registerError", "Password must contain at least 6 characters.", "error");
        return;
    }
    if (password !== confirmPassword) {
        setAuthMessage("registerError", "The passwords do not match.", "error");
        return;
    }

    const users = getRegisteredUsers();
    if (users.some(user => user.email === email)) {
        setAuthMessage("registerError", "An account with this email already exists. Please sign in.", "error");
        return;
    }

    users.push({ name, email, role, password });
    localStorage.setItem("veltrixa_registered_users", JSON.stringify(users));

    // Add the new account to the team list so it appears in administration.
    if (!data.members.some(member => member.email.toLowerCase() === email)) {
        data.members.push({ id: Date.now(), name, email, role, tasks: 0 });
        persist();
    }

    document.getElementById("loginEmail").value = email;
    document.getElementById("loginPassword").value = "";
    setAuthMessage("loginError", "Account created successfully. Please sign in.", "success");
    document.getElementById("registerForm").reset();
    showLoginForm();
    setAuthMessage("loginError", "Account created successfully. Please sign in.", "success");
}

// Sign in with a registered account or the original demo account.
function login(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const selectedRole = document.getElementById("loginRole").value;
    const error = document.getElementById("loginError");
    const users = getRegisteredUsers();
    const registeredUser = users.find(user => user.email === email && user.password === password);
    const isDemoAccount = email === "athiqa@example.com" && password === "demo1234";

    if (!selectedRole) {
        setAuthMessage("loginError", "Please select your role to continue.", "error");
        return;
    }

    if (!registeredUser && !isDemoAccount) {
        setAuthMessage("loginError", "Account not found or password is incorrect. Please register first.", "error");
        return;
    }

    const accountRole = registeredUser ? registeredUser.role : "Team Member";
    if (selectedRole !== accountRole) {
        setAuthMessage("loginError", "The selected role does not match this account. Please choose the role used during registration.", "error");
        return;
    }

    const name = registeredUser ? registeredUser.name : "Athiqa";
    const role = accountRole;
    currentUser = { name, role, email };
    document.getElementById("sidebarUser").textContent = name;
    document.getElementById("sidebarRole").textContent = role;
    document.getElementById("roleChip").textContent = role;
    document.querySelector(".sidebar-user .avatar").textContent = name.charAt(0).toUpperCase();
    document.getElementById("loginScreen").classList.add("d-none");
    document.getElementById("app").classList.remove("d-none");
    renderPage("dashboard");
}
function logout() {
    document.getElementById("app").classList.add("d-none");
    document.getElementById("loginScreen").classList.remove("d-none");
}
function navClick(e) {
    const link=e.target.closest("[data-page]");
    if(!link)return;
    e.preventDefault();
    renderPage(link.dataset.page);
}
// Show the page selected in the left navigation.
function renderPage(page) {
    activePage=page;
    document.querySelectorAll("#mainNav .nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===page));
    document.getElementById("pageHeading").textContent=pageInfo[page][0];
    document.getElementById("pageSubheading").textContent=pageInfo[page][1];
    document.getElementById("topAction").classList.toggle("d-none",!["projects","tasks"].includes(page));
    document.getElementById("topAction").textContent=page==="tasks"?"+ New task":"+ New project";
    const views= {
        dashboard:dashboardView,projects:projectsView,team:teamView,tasks:tasksView,board:boardView,reports:reportsView,approvals:approvalsView,admin:adminView
    };
    document.getElementById("pageContent").innerHTML=views[page]();
}
function stats() {
    const today=new Date();
    today.setHours(0,0,0,0);
    const overdue=data.tasks.filter(t=>t.status!=="Completed"&&new Date(t.deadline+"T00:00:00")<today).length;
    return {
        projects:data.projects.length,active:data.projects.filter(p=>p.status==="Active").length,completed:data.tasks.filter(t=>t.status==="Completed").length,overdue
    };
}
function dashboardView() {
    const s=stats();
    return `<div class="stats-grid">
 ${statCard("Total projects",s.projects,"▣","Across your workspace")}${statCard("Active projects",s.active,"↗","Currently in progress")}${statCard("Completed tasks",s.completed,"✓","Tasks finished")}${statCard("Overdue tasks",s.overdue,"!","Need your attention")}
 </div><div class="content-grid"><div class="panel"><div class="panel-head"><div><h2>Projects</h2><p>Keep track of your team's work</p></div><button class="btn btn-sm btn-light" data-go="projects">View all</button></div>${projectTable(data.projects.slice(0,5))}</div>
 <div class="panel"><div class="panel-head"><div><h2>My tasks</h2><p>Tasks assigned to ${esc(currentUser.name)}</p></div></div>${taskMiniList(data.tasks.filter(t=>t.assignee===currentUser.name).concat(data.tasks).slice(0,5))}</div></div>
 <div class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p>Latest workspace updates</p></div></div><div class="activity-grid">${data.activities.map(a=>`<div class="activity-card"><strong>${esc(a.person)}</strong>${esc(a.message)}<small>${esc(a.when)}</small></div>`).join("")}</div></div>`;
}
function statCard(label,value,icon,help) {
    return `<article class="stat-card"><span class="stat-icon">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-help">${help}</div></article>`;
}
function projectsView() {
    return `<div class="panel"><div class="panel-head"><div><h2>All projects</h2><p>${data.projects.length} projects in this demo workspace</p></div><button class="btn btn-primary" data-create="project">+ Create project</button></div><div class="toolbar"><input class="form-control" id="projectSearch" placeholder="Search projects..."><select class="form-select" id="projectStatusFilter"><option value="">All statuses</option><option>Active</option><option>Completed</option><option>On Hold</option></select></div><div id="projectsTable">${projectTable(data.projects,true)}</div></div>`;
}
function projectTable(items,actions=false) {
    if(!items.length)return `<div class="empty-state">No projects found. Create your first project.</div>`;
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>PROJECT</th><th>MANAGER</th><th>STATUS</th><th>PROGRESS</th><th>DEADLINE</th>${actions?"<th>ACTIONS</th>":""}</tr></thead><tbody>${items.map(p=>`<tr><td><span class="strong-text">${esc(p.name)}</span><div class="text-secondary small">${esc(p.description||"")}</div></td><td>${esc(p.manager)}</td><td>${pill(p.status)}</td><td><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1"><div class="progress-bar" style="width:${num(p.progress)}%"></div></div><small>${num(p.progress)}%</small></div></td><td>${date(p.deadline)}</td>${actions?`<td><button class="btn btn-sm btn-light" data-edit-project="${p.id}">Edit</button> <button class="btn btn-sm btn-light text-danger" data-delete-project="${p.id}">Delete</button></td>`:""}</tr>`).join("")}</tbody></table></div>`;
}
function teamView() {
    return `<div class="panel"><div class="panel-head"><div><h2>Team directory</h2><p>People and roles in your workspace</p></div><button class="btn btn-primary" data-create="member">+ Add member</button></div><div class="toolbar"><input class="form-control" id="memberSearch" placeholder="Search by name or email..."><select class="form-select" id="memberRoleFilter"><option value="">All roles</option><option>Administrator</option><option>Project Manager</option><option>Team Leader</option><option>Team Member</option></select></div><div id="memberGrid" class="member-grid">${memberCards(data.members)}</div></div>`;
}
function memberCards(items) {
    if(!items.length)return `<div class="empty-state">No team members match your search.</div>`;
    return items.map(m=>`<div class="member-card"><div class="member-avatar">${esc(m.name.charAt(0).toUpperCase())}</div><div class="flex-grow-1"><strong>${esc(m.name)}</strong><small>${esc(m.email)}<br>${esc(m.role)} · ${num(m.tasks)} tasks</small></div><button class="btn btn-sm btn-light" data-delete-member="${m.id}">Remove</button></div>`).join("");
}
function tasksView() {
    return `<div class="panel"><div class="panel-head"><div><h2>All tasks</h2><p>Create, assign and track team tasks</p></div><button class="btn btn-primary" data-create="task">+ Create task</button></div><div class="toolbar"><input class="form-control" id="taskSearch" placeholder="Search tasks..."><select class="form-select" id="taskProjectFilter"><option value="">All projects</option>${data.projects.map(p=>`<option>${esc(p.name)}</option>`).join("")}</select><select class="form-select" id="taskStatusFilter"><option value="">All statuses</option>${["To Do","In Progress","Review","Completed"].map(s=>`<option>${s}</option>`).join("")}</select><select class="form-select" id="taskPriorityFilter"><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select></div><div id="tasksTable">${taskTable(data.tasks)}</div></div>`;
}
function taskTable(items) {
    if(!items.length)return `<div class="empty-state">No tasks found.</div>`;
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>TASK</th><th>PROJECT</th><th>ASSIGNEE</th><th>PRIORITY</th><th>DEADLINE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${items.map(t=>`<tr><td><span class="strong-text">${esc(t.title)}</span></td><td>${esc(t.project)}</td><td>${esc(t.assignee)}</td><td>${priorityPill(t.priority)}</td><td>${date(t.deadline)}</td><td>${pill(t.status)}</td><td><button class="btn btn-sm btn-light" data-task-detail="${t.id}">Details</button> <button class="btn btn-sm btn-light" data-edit-task="${t.id}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}
function boardView() {
    const statuses=["To Do","In Progress","Review","Completed"];
    return `<div class="board">${statuses.map(status=>{const tasks=data.tasks.filter(t=>t.status===status);return `<div class="board-column"><div class="board-title"><span>${status.toUpperCase()}</span><span>${tasks.length}</span></div>${tasks.map(t=>`<div class="board-card" data-task-detail="${t.id}"><strong>${esc(t.title)}</strong><small>${esc(t.project)} · ${esc(t.assignee)}</small><div class="mt-2">${priorityPill(t.priority)}</div><label class="form-label mt-2 mb-1">Change status</label><select class="form-select form-select-sm" data-status-task="${t.id}">${statuses.map(s=>`<option ${s===t.status?"selected":""}>${s}</option>`).join("")}</select></div>`).join("")||`<div class="text-secondary small">No tasks</div>`}</div>`}).join("")}</div>`;
}
function reportsView() {
    const total=data.tasks.length||1;
    const done=data.tasks.filter(t=>t.status==="Completed").length;
    const pending=data.tasks.filter(t=>t.status!=="Completed"&&t.status!=="Review").length;
    const review=data.tasks.filter(t=>t.status==="Review").length;
    const today=new Date();
    today.setHours(0,0,0,0);
    const overdue=data.tasks.filter(t=>t.status!=="Completed"&&new Date(t.deadline+"T00:00:00")<today).length;
    return `<div class="report-grid"><div class="panel"><div class="panel-head"><div><h2>Overall task progress</h2><p>Based on current demo tasks</p></div></div><div class="report-number">${Math.round(done/total*100)}%</div><div class="progress mt-2"><div class="progress-bar" style="width:${done/total*100}%"></div></div><small class="text-secondary">${done} of ${data.tasks.length} tasks completed</small></div><div class="panel"><h2 class="fs-6">Task summary</h2><div class="d-flex justify-content-between py-2"><span>Completed</span><strong>${done}</strong></div><div class="d-flex justify-content-between py-2"><span>Pending / in progress</span><strong>${pending}</strong></div><div class="d-flex justify-content-between py-2"><span>Awaiting review</span><strong>${review}</strong></div><div class="d-flex justify-content-between py-2"><span>Overdue</span><strong class="text-danger">${overdue}</strong></div></div></div><div class="panel"><div class="panel-head"><div><h2>Project-wise progress</h2><p>Completion supplied by the current demo data</p></div></div>${data.projects.map(p=>`<div class="mb-3"><div class="d-flex justify-content-between mb-1"><strong>${esc(p.name)}</strong><small>${num(p.progress)}%</small></div><div class="progress"><div class="progress-bar" style="width:${num(p.progress)}%"></div></div></div>`).join("")}</div>`;
}
function approvalsView() {
    const waiting=data.tasks.filter(t=>t.status==="Review");
    return `<div class="panel"><div class="panel-head"><div><h2>Tasks awaiting review</h2><p>Approve completed work or request changes</p></div><span class="badge-soft">${waiting.length} awaiting</span></div>${waiting.length?waiting.map(t=>`<div class="approval-item"><div><strong>${esc(t.title)}</strong><small>${esc(t.project)} · Submitted by ${esc(t.assignee)} · Due ${date(t.deadline)}</small>${t.reviewComment?`<small>Previous note: ${esc(t.reviewComment)}</small>`:""}</div><div class="d-flex gap-2"><button class="btn btn-sm btn-success" data-approve="${t.id}">Approve</button><button class="btn btn-sm btn-outline-warning" data-request-changes="${t.id}">Request changes</button></div></div>`).join(""):`<div class="empty-state">There are no tasks waiting for review.</div>`}</div><div class="small text-secondary">Demo note: approval actions update the task status in browser storage.</div>`;
}
function adminView() {
    return `<div class="stats-grid">${statCard("Users",data.members.length,"♧","Registered demo members")}${statCard("Projects",data.projects.length,"▣","All workspace projects")}${statCard("Tasks",data.tasks.length,"✓","All recorded tasks")}${statCard("Awaiting review",data.tasks.filter(t=>t.status==="Review").length,"◎","Need reviewer action")}</div><div class="panel"><div class="panel-head"><div><h2>User and role overview</h2><p>Demo administration view</p></div><button class="btn btn-primary" data-go="team">Manage members</button></div><div class="table-responsive"><table class="table"><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>TASKS</th></tr></thead><tbody>${data.members.map(m=>`<tr><td class="strong-text">${esc(m.name)}</td><td>${esc(m.email)}</td><td>${pill(m.role)}</td><td>${num(m.tasks)}</td></tr>`).join("")}</tbody></table></div></div><p class="small text-secondary">Real role permissions and system administration must be enforced by the Java backend. Selecting a demo role on login does not secure this prototype.</p>`;
}
function taskMiniList(items) {
    return items.slice(0,5).map(t=>`<div class="task-row"><span class="task-mark ${t.status==="Completed"?"done":""}"></span><div><strong>${esc(t.title)}</strong><small>${esc(t.project)} · ${date(t.deadline)} · ${esc(t.status)}</small></div></div>`).join("")||`<div class="empty-state">No tasks assigned yet.</div>`;
}
function openCreate(type,id=null) {
    editingRecord=id? {
        type,id
    }
    :null;
    const item=id?findRecord(type,id):null;
    document.getElementById("modalTitle").textContent=(id?"Edit ":"Create ")+type;
    document.getElementById("modalFields").innerHTML=formFields(type,item);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("recordModal")).show();
}
function findRecord(type,id) {
    const list=type==="project"?data.projects:type==="task"?data.tasks:data.members;
    return list.find(x=>x.id===Number(id));
}
function formFields(type,item) {
    if(type==="project")return `<label class="form-label">Project name</label><input class="form-control mb-3" name="name" required maxlength="70" value="${attr(item?.name||"")}"><label class="form-label">Description</label><textarea class="form-control mb-3" name="description" rows="2">${esc(item?.description||"")}</textarea><div class="row"><div class="col"><label class="form-label">Start date</label><input class="form-control mb-3" type="date" name="startDate" required value="${attr(item?.startDate||"2026-11-03")}"></div><div class="col"><label class="form-label">Deadline</label><input class="form-control mb-3" type="date" name="deadline" required value="${attr(item?.deadline||"")}"></div></div><label class="form-label">Project manager</label><select class="form-select mb-3" name="manager">${data.members.map(m=>`<option ${item?.manager===m.name?"selected":""}>${esc(m.name)}</option>`).join("")}</select><label class="form-label">Status</label><select class="form-select" name="status">${["Active","On Hold","Completed"].map(s=>`<option ${item?.status===s?"selected":""}>${s}</option>`).join("")}</select>`;
    if(type==="task")return `<label class="form-label">Task title</label><input class="form-control mb-3" name="title" required value="${attr(item?.title||"")}"><label class="form-label">Description</label><textarea class="form-control mb-3" name="description" rows="2">${esc(item?.description||"")}</textarea><label class="form-label">Project</label><select class="form-select mb-3" name="project" required>${data.projects.map(p=>`<option ${item?.project===p.name?"selected":""}>${esc(p.name)}</option>`).join("")}</select><label class="form-label">Assignee</label><select class="form-select mb-3" name="assignee">${data.members.map(m=>`<option ${item?.assignee===m.name?"selected":""}>${esc(m.name)}</option>`).join("")}</select><div class="row"><div class="col"><label class="form-label">Priority</label><select class="form-select mb-3" name="priority">${["High","Medium","Low"].map(s=>`<option ${item?.priority===s?"selected":""}>${s}</option>`).join("")}</select></div><div class="col"><label class="form-label">Deadline</label><input class="form-control mb-3" type="date" name="deadline" required value="${attr(item?.deadline||"")}"></div></div><label class="form-label">Status</label><select class="form-select" name="status">${["To Do","In Progress","Review","Completed"].map(s=>`<option ${item?.status===s?"selected":""}>${s}</option>`).join("")}</select>`;
    return `<label class="form-label">Full name</label><input class="form-control mb-3" name="name" required value="${attr(item?.name||"")}"><label class="form-label">Email</label><input class="form-control mb-3" type="email" name="email" required value="${attr(item?.email||"")}"><label class="form-label">Role</label><select class="form-select" name="role">${["Administrator","Project Manager","Team Leader","Team Member"].map(s=>`<option ${item?.role===s?"selected":""}>${s}</option>`).join("")}</select>`;
}
// Save a new project/task/member, or update an existing one.
function saveRecord(e) {
    e.preventDefault();
    const form=new FormData(e.target);
    const values=Object.fromEntries(form.entries());
    const type=editingRecord?.type||(activePage==="tasks"?"task":activePage==="team"?"member":"project");
    const id=editingRecord?.id;
    if(type==="project") {
        if(values.deadline<values.startDate) {
            alert("Deadline cannot be earlier than the start date.");
            return;
        }
        const old=id?findRecord(type,id):null;
        const record= {
            ...(old|| {
            })
            ,...values,id:id||Date.now(),progress:old?.progress||0
        };
        if(id)data.projects=data.projects.map(p=>p.id===id?record:p);
        else data.projects.unshift(record);
    }
    if(type==="task") {
        const old=id?findRecord(type,id):null;
        const record= {
            ...(old|| {
            })
            ,...values,id:id||Date.now(),comments:old?.comments||[],reviewComment:old?.reviewComment||""
        };
        if(id)data.tasks=data.tasks.map(t=>t.id===id?record:t);
        else data.tasks.unshift(record);
    }
    if(type==="member") {
        const record= {
            ...values,id:id||Date.now(),tasks:findRecord("member",id)?.tasks||0
        };
        if(id)data.members=data.members.map(m=>m.id===id?record:m);
        else data.members.push(record);
    }
    persist();
    bootstrap.Modal.getInstance(document.getElementById("recordModal")).hide();
    showAlert((id?"Updated ":"Created ")+type+" successfully.");
    renderPage(activePage);
}
// Handle buttons inside the page area.
function pageAction(e) {
    const el=e.target.closest("button,[data-task-detail]");
    if(!el)return;
    if(el.dataset.create) {
        openCreate(el.dataset.create);
        return;
    }
    if(el.dataset.go) {
        renderPage(el.dataset.go);
        return;
    }
    if(el.dataset.editProject) {
        openCreate("project",el.dataset.editProject);
        return;
    }
    if(el.dataset.editTask) {
        openCreate("task",el.dataset.editTask);
        return;
    }
    if(el.dataset.deleteProject) {
        if(confirm("Delete this project? Related tasks will not be deleted.")) {
            data.projects=data.projects.filter(p=>p.id!==Number(el.dataset.deleteProject));
            persist();
            renderPage(activePage);
        }
        return;
    }
    if(el.dataset.deleteMember) {
        if(confirm("Remove this team member?")) {
            data.members=data.members.filter(m=>m.id!==Number(el.dataset.deleteMember));
            persist();
            renderPage(activePage);
        }
        return;
    }
    if(el.dataset.taskDetail) {
        showTaskDetail(Number(el.dataset.taskDetail));
        return;
    }
    if(el.dataset.approve) {
        const t=findRecord("task",el.dataset.approve);
        t.status="Completed";
        t.reviewComment="Approved";
        persist();
        renderPage(activePage);
        showAlert("Task approved.");
        return;
    }
    if(el.dataset.requestChanges) {
        const t=findRecord("task",el.dataset.requestChanges);
        const note=prompt("Enter the changes required:");
        if(note===null)return;
        t.status="In Progress";
        t.reviewComment=note;
        persist();
        renderPage(activePage);
        showAlert("Changes requested and comment saved.");
    }
}
function pageChange(e) {
    const t=e.target;
    if(t.dataset.statusTask) {
        const task=findRecord("task",t.dataset.statusTask);
        task.status=t.value;
        persist();
        renderPage("board");
        showAlert("Task status updated.");
        return;
    }
    if(["projectStatusFilter","memberRoleFilter","taskProjectFilter","taskStatusFilter","taskPriorityFilter"].includes(t.id))applyFilters();
}
function pageInput(e) {
    if(["projectSearch","memberSearch","taskSearch"].includes(e.target.id))applyFilters();
}
// Apply the search box and dropdown filters for the current page.
function applyFilters() {
    if(activePage==="projects") {
        const q=(document.getElementById("projectSearch")?.value||"").toLowerCase(),s=document.getElementById("projectStatusFilter")?.value||"";
        document.getElementById("projectsTable").innerHTML=projectTable(data.projects.filter(p=>(p.name+" "+p.description).toLowerCase().includes(q)&&(!s||p.status===s)),true);
    }
    if(activePage==="team") {
        const q=(document.getElementById("memberSearch")?.value||"").toLowerCase(),r=document.getElementById("memberRoleFilter")?.value||"";
        document.getElementById("memberGrid").innerHTML=memberCards(data.members.filter(m=>(m.name+" "+m.email).toLowerCase().includes(q)&&(!r||m.role===r)));
    }
    if(activePage==="tasks") {
        const q=(document.getElementById("taskSearch")?.value||"").toLowerCase(),p=document.getElementById("taskProjectFilter")?.value||"",s=document.getElementById("taskStatusFilter")?.value||"",pr=document.getElementById("taskPriorityFilter")?.value||"";
        document.getElementById("tasksTable").innerHTML=taskTable(data.tasks.filter(t=>t.title.toLowerCase().includes(q)&&(!p||t.project===p)&&(!s||t.status===s)&&(!pr||t.priority===pr)));
    }
}
function showTaskDetail(id) {
    const t=findRecord("task",id);
    if(!t)return;
    document.getElementById("detailTitle").textContent=t.title;
    document.getElementById("detailBody").innerHTML=`<div class="row g-3 mb-3"><div class="col-md-6"><small class="text-secondary">PROJECT</small><div>${esc(t.project)}</div></div><div class="col-md-6"><small class="text-secondary">ASSIGNEE</small><div>${esc(t.assignee)}</div></div><div class="col-md-6"><small class="text-secondary">PRIORITY</small><div>${priorityPill(t.priority)}</div></div><div class="col-md-6"><small class="text-secondary">DEADLINE</small><div>${date(t.deadline)}</div></div><div class="col-12"><small class="text-secondary">STATUS</small><div>${pill(t.status)}</div></div><div class="col-12"><small class="text-secondary">DESCRIPTION</small><p class="mb-0">${esc(t.description||"No description provided.")}</p></div></div><hr><h3 class="fs-6">Comments</h3><div id="commentList">${(t.comments||[]).map(c=>`<p class="small mb-2"><strong>${esc(c.by)}:</strong> ${esc(c.text)}</p>`).join("")||`<p class="small text-secondary">No comments yet.</p>`}</div><form id="commentForm" data-comment-task="${t.id}" class="d-flex gap-2 mt-3"><input class="form-control" name="comment" required placeholder="Write a comment..."><button class="btn btn-primary">Send</button></form><div class="small text-secondary mt-3">Review note: ${esc(t.reviewComment||"No review feedback yet.")}</div>`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("detailModal")).show();
    document.getElementById("commentForm").addEventListener("submit",e=> {
        e.preventDefault();
        const value=new FormData(e.target).get("comment").trim();
        if(!value)return;
        t.comments=t.comments||[];
        t.comments.push( {
            by:currentUser.name,text:value
        })
        ;
        persist();
        showTaskDetail(id);
    })
    ;
}
function showAlert(message) {
    const area=document.getElementById("alertArea");
    area.innerHTML=`<div class="alert alert-success py-2 small">${esc(message)}</div>`;
    setTimeout(()=> {
        area.innerHTML="";
    },
    2800);
}
function pill(value) {
    const cls=String(value).toLowerCase().replace(/\s+/g,"-");
    return `<span class="badge-soft status-${cls}">${esc(value)}</span>`;
}
function priorityPill(value) {
    return `<span class="badge-soft ${value==="High"?"status-overdue":value==="Low"?"status-completed":"status-review"}">${esc(value)}</span>`;
}
function date(value) {
    if(!value)return "—";
    return new Date(value+"T00:00:00").toLocaleDateString("en-IN", {
        day:"2-digit",month:"short",year:"numeric"
    })
    ;
}
function num(value) {
    return Number.isFinite(Number(value))?Number(value):0;
}
function esc(value) {
    return String(value??"").replace(/[&<>"']/g,c=>( {
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }
    [c]));
}
function attr(value) {
    return esc(value).replace(/`/g,"&#096;");
}
