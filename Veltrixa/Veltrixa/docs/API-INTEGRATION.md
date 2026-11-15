# Veltrixa API integration guide (for the Java backend developer)

**Version 2.1.** The paths of all endpoints in section 6 of the SRS now match the SRS exactly (see the table at the start of section 4). Endpoints that are not in the SRS but that the screens need are marked **extra**.

The frontend talks to the backend only through `js/api.js`, using fetch.
In demo mode `js/mock-server.js` answers the same calls and follows this document exactly, so you can read its routes to see what each endpoint has to check and return.

## 1. Connecting the real backend

| Step | What to do |
|---|---|
| 1 | Deploy the JSP files from `jsp/` at the web-app root and copy `css/` and `js/` next to them (see section 7). |
| 2 | JSP pages already send `data-api-base="${ctx}/api"` on `<body>`. This turns mock mode off automatically. For a separate-origin setup, edit `js/config.js`: `USE_MOCK: false`, `API_BASE_URL: "https://your-server/api"`. |
| 3 | Remove the `mock-server.js` script tag from `index.html` if you keep using it. (The JSP pages do not load it.) |
| 4 | Implement the endpoints in section 4. Return the response envelope in section 2. |

If the API is on a different origin than the pages, enable CORS with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin` (not `*`), because requests use `credentials: "include"`.

## 2. Conventions

**Request:** JSON body (`Content-Type: application/json`) except file upload (`multipart/form-data`, field name `file`). Dates are `yyyy-MM-dd`; timestamps are ISO-8601.

**Response envelope (every endpoint, success and failure):**

```json
{ "success": true, "message": "Project created successfully.", "data": { }, "pagination": null, "errors": null }
```

* `message` is shown to the user in a toast or form message, so write it for people.
* `errors` (validation only, HTTP 422): `{ "deadline": "Deadline cannot be earlier than the start date." }`. The key is the form field name.
* `pagination` (list endpoints only): `{ "page": 1, "size": 6, "totalItems": 32, "totalPages": 6 }`.

**HTTP status codes used by the frontend:** `200` OK, `201` created, `401` not signed in (the frontend sends the user to the login page), `403` role not allowed, `404` not found, `409` conflict (duplicate email, member still has open tasks), `413` file too large, `415` file type not allowed, `422` validation failed.

**Authentication:** either a session cookie (`JSESSIONID`, recommended with JSP; `HttpOnly`, `Secure`, `SameSite=Lax`) or a token. If `/auth/login` returns `data.token`, the frontend sends `Authorization: Bearer <token>` on later calls. On login, also store the user bean in the HTTP session as `user` (`id`, `name`, `email`, `role`); the JSP pages read it.

**List query parameters:** `page` (from 1), `size` (1 to 500; the UI uses 6, 12 or 24), `q` (search text), `sort`, plus the filters of each endpoint.

**Security rules the backend must enforce again.** The frontend only hides what a role may not use:
* Every request needs a valid session, except `/auth/login` and `/auth/register`.
* Check the role (table in section 3) on every write and on restricted reads.
* Scope data: a *Team Member* sees only their own tasks and the projects those tasks belong to.
* Hash passwords (BCrypt or Argon2). Never return password fields.
* Use prepared statements. Limit upload size and file types on the server (the UI limits are only a convenience).
* Registration currently lets people choose any role, because this is a demo. In production, restrict *Administrator* and *Project Manager* sign-up (for example, admin approval).

## 3. Roles and permissions

| Action | Administrator | Project Manager | Team Leader | Team Member |
|---|:-:|:-:|:-:|:-:|
| Open pages: dashboard, projects, tasks, board | ✔ | ✔ | ✔ | ✔ (own data only) |
| Team directory (`GET /members`) | ✔ | ✔ | ✔ | ✘ |
| Reports | ✔ | ✔ | ✔ | ✘ |
| Review and approvals | ✔ | ✔ | ✔ | ✘ |
| Administration, `GET /admin/dashboard`, activity log (`GET /admin/activities`) | ✔ | ✘ | ✘ | ✘ |
| Create project | ✔ | ✔ (becomes its manager) | ✘ | ✘ |
| Edit project | ✔ all | ✔ only projects they manage | ✘ | ✘ |
| Assign a different project manager | ✔ | ✘ | ✘ | ✘ |
| Add / remove people on a project's team | ✔ all projects | ✔ only projects they manage | ✘ | ✘ |
| See a project, its team and its progress | ✔ all | ✔ all | ✔ all | ✔ only projects they are on (team emails are left out) |
| See the list of review decisions (`GET /reviews`) | ✔ | ✔ | ✔ | ✘ |
| Delete project (deletes its tasks) | ✔ | ✘ | ✘ | ✘ |
| Add / remove member | ✔ any role | ✔ only Team Leader / Team Member roles | ✘ | ✘ |
| Change a member's role | ✔ (not their own) | ✘ | ✘ | ✘ |
| Create / edit / assign tasks | ✔ | ✔ | ✔ | ✘ |
| Delete task (not in the current UI) | ✔ | ✔ | ✘ | ✘ |
| Change task status | ✔ | ✔ | ✔ | own tasks, never to *Completed* |
| Approve or request changes | ✔ | ✔ | ✔ | ✘ (nobody may review their own task) |
| Comment and attach files | ✔ | ✔ | ✔ | ✔ (tasks they can see) |

The same matrix lives in `js/permissions.js` and is used by `js/mock-server.js`.

## 4. Endpoints

All paths are relative to `API_BASE_URL` (for example `/api`).

### SRS section 6 coverage (18 of 18)

| # | SRS endpoint | Notes |
|---|---|---|
| 1 | `POST /auth/login` | |
| 2 | `POST /auth/logout` | |
| 3 | `GET /users/me` | Current user. The app calls it once at start-up to restore a session, and a `401` there is expected and silent. |
| 4 | `GET /projects` | |
| 5 | `POST /projects` | Accepts an optional starting team: `memberIds` |
| 6 | `GET /projects/{id}` | |
| 7 | `PUT /projects/{id}` | |
| 8 | `GET /projects/{id}/members` | |
| 9 | `POST /projects/{id}/members` | |
| 10 | `GET /projects/{id}/tasks` | |
| 11 | `POST /projects/{id}/tasks` | |
| 12 | `PUT /tasks/{id}` | |
| 13 | `PATCH /tasks/{id}/status` | |
| 14 | `GET /tasks/{id}/comments` | |
| 15 | `POST /tasks/{id}/comments` | |
| 16 | `POST /tasks/{id}/reviews` | |
| 17 | `GET /projects/{id}/progress` | |
| 18 | `GET /admin/dashboard` | |

**Extra endpoints** the screens use (not in the SRS list): `POST /auth/register`, `GET /lookups`, `GET /dashboard`, `GET /admin/activities`, `DELETE /projects/{id}`, `DELETE /projects/{id}/members/{memberId}`, `GET /tasks`, `GET /tasks/{id}`, the attachment endpoints, `GET /reviews`, `GET /reports/progress`, `GET /reports/team`, and `GET/POST/PUT/DELETE /members`. Paths changed from version 2.0: `/auth/me` is now `/users/me`, `/admin/stats` is `/admin/dashboard`, `POST /tasks` is `POST /projects/{id}/tasks`, and `POST /tasks/{id}/review` is `POST /tasks/{id}/reviews`.

### Authentication

| Method and path | Body | Success `data` |
|---|---|---|
| `POST /auth/login` | `{ "email", "password", "role" }` | `{ "user": { id, name, email, role }, "token": "optional" }` |
| `POST /auth/register` | `{ "name", "email", "role", "password" }` | `{ "email" }` (201) |
| `POST /auth/logout` | none | `null` |
| `GET /users/me` | none | `{ id, name, email, role }` |

Login rules: `401` if email or password is wrong, `403` if the chosen `role` is not the account's role. Registration: name 2+ characters, valid email, password 6+ characters, `409` if the email exists.

### Reference data and dashboards

| Method and path | Notes |
|---|---|
| `GET /lookups` | `{ projects:[{id,name,status,startDate,deadline,managerId}], members:[{id,name,role}], managers:[{id,name,role}] }`. `managers` are people whose role is Project Manager or Administrator. The task form uses the project dates to limit the deadline picker. |
| `GET /dashboard` | Role-aware summary. `counts`: `totalProjects, activeProjects, completedProjects, onHoldProjects, totalTasks, completedTasks, overdueTasks, awaitingReview, myOpenTasks`; plus `byStatus`, `projects`, `myTasks`, `reviewQueue`, `atRisk`, `workload`, `activities`. Scope: Administrator = everything; Project Manager = projects they manage; Team Leader = everything; Team Member = their own tasks and the projects they are on. For a Team Member `awaitingReview` means *their own* tasks waiting for a decision. |
| `GET /admin/dashboard` | Administrator only: `users`, `projects`, `activeProjects`, `completedProjects`, `tasks`, `overdueTasks`, `awaitingReview`, `attachments`, `comments`, `activityLast7Days`, `usersByRole`, `projectsByStatus`, `tasksByStatus`, `tasksByPriority` (each a list of `{label,count}`), `system.dataSource`. |
| `GET /admin/activities?page&size&q&projectId&from&to` | **Extra.** Administrator only. The full activity log, newest first. `q` searches person, action and project name; `from`/`to` are dates (`422` if `to` is before `from`). Item: `id, personId, person, message, at, projectId, projectName`. |

### Projects and project teams

A project's **team** is its manager plus the people added with `POST /projects/{id}/members`. Tasks can only be assigned to people on the team.

| Method and path | Notes |
|---|---|
| `GET /projects?page&size&q&status&managerId&sort` | `sort`: `name`, `deadline`, `progress`; default newest first. Item: `id, name, description, startDate, deadline, status, managerId, managerName, progress, taskCount, completedCount, overdueCount, reviewCount, memberCount`. `progress` is **calculated** from tasks (completed ÷ total), and 100 when the project is Completed. A Team Member sees only projects they are on. |
| `GET /projects/{id}` | One item as above. `404` if it does not exist or the caller may not see it. |
| `POST /projects` | `{ name, description, startDate, deadline, status, managerId, memberIds? }`. `name` required, max 70. `deadline` >= `startDate`. `status`: `Active`, `On Hold`, `Completed`. If the caller is a Project Manager, ignore `managerId` and use the caller. If an Administrator, `managerId` must belong to a Project Manager or Administrator. `memberIds` is an optional list of user ids for the starting team (the manager is always on the team, never list them). |
| `PUT /projects/{id}` | Same body, without `memberIds` (the team is changed through the members endpoints). A Project Manager may edit only their own projects (`403` otherwise). |
| `DELETE /projects/{id}` | **Extra.** Administrator only. Deletes the project's tasks too; say so in `message`. |
| `GET /projects/{id}/members` | The team, manager first. Item: `id, name, role, isManager, email, tasks:{total,completed,open,review,overdue}`. `tasks` counts only this project. `email` is left out for Team Members. |
| `POST /projects/{id}/members` | `{ memberId }`. `201` with the new row. `403` unless Administrator or the project's manager; `409` if already on the team; `422` if `memberId` is missing or unknown. |
| `DELETE /projects/{id}/members/{memberId}` | **Extra.** Same permission. `409` if the person is the manager, or still has open tasks in this project (the message says how many). |
| `GET /projects/{id}/progress?from&to` | `{ project:{id,name,status,startDate,deadline,managerName}, progress, summary, byStatus:[{status,count}], byMember:[{memberId,name,role,total,completed,review,inProgress,todo,overdue,completionRate}], filters }`. `progress` is the overall completion percentage and ignores the dates; `summary` and the lists use tasks whose **deadline** falls inside `from`..`to` (inclusive, both optional, `422` if `to` is before `from`). A Team Member only receives their own row in `byMember`. |

### Team members

| Method and path | Notes |
|---|---|
| `GET /members?page&size&q&role&sort` | `q` searches name and email. `sort`: `name`, `role`, `workload`. Item: `id, name, email, role, openTasks, projectCount, tasks:{total,completed,open,review,overdue}`. The team page shows `tasks` as a small summary on each card. |
| `POST /members` | `{ name, email, role }`. `409` on duplicate email. Create a temporary password or send an invite. |
| `PUT /members/{id}` | `{ role }`. Administrator only; `409` if changing own role, or if the person manages projects and the new role is not Project Manager or Administrator. |
| `DELETE /members/{id}` | `409` if they still have open tasks, manage a project, or it is the caller. A Project Manager cannot remove Administrators or Project Managers. Also removes them from every project team. |

### Tasks

| Method and path | Notes |
|---|---|
| `GET /projects/{id}/tasks` | Same query and item as `GET /tasks`, limited to that project (a Team Member gets only their own tasks in it). |
| `POST /projects/{id}/tasks` | `{ title, description, assigneeId, priority, deadline, status }`; the project comes from the path. `priority`: `High`, `Medium`, `Low`. `status`: `To Do`, `In Progress`, `Review`, `Completed`; a new task cannot be Completed. **`422`** if the assignee is not on the project's team, or if `deadline` is outside the project's `startDate`..`deadline`. Writes a `created` history entry. |
| `GET /tasks?page&size&q&projectId&status&priority&assigneeId&deadlineFrom&deadlineTo&overdue&sort` | **Extra** (all visible tasks across projects). `q` searches title, description, project and assignee names. `overdue=true` means not Completed and `deadline` before today. `sort`: `deadline`, `-deadline`, `priority`, `title`, `status`; default newest first. Item: `id, title, description, projectId, projectName, assigneeId, assigneeName, priority, deadline, status, overdue, reviewComment, commentCount, attachmentCount`. The task board calls this with `size=500`. |
| `GET /tasks/{id}` | **Extra.** The item above plus `createdAt`, `createdBy`, `attachments:[{id,name,size,type,by,byId,at}]`, `history:[{at,by,byName,type,text,from?,to?,decision?,comment?}]` (newest first). Comments are **not** included: read them with the next endpoint. |
| `PUT /tasks/{id}` | `{ title, description, projectId, assigneeId, priority, deadline, status }`. Same team and date rules as create; the assignee and deadline checks run only when those fields (or the project) changed, so an old task can still be edited. One history entry per changed field. |
| `PATCH /tasks/{id}/status` | `{ status }`. Team Members: own tasks only and never *Completed*. Completing a task requires the review permission and the caller must not be the assignee. |
| `GET /tasks/{id}/comments` | Array of `{ id, byId, by, text, at }`, oldest first. |
| `POST /tasks/{id}/comments` | `{ text }` (1 to 500 characters). `201` with the new comment. Adds a `comment` history entry. |
| `POST /tasks/{id}/attachments` | **Extra.** `multipart/form-data`, field `file`. Allowed: pdf, png, jpg, jpeg, docx, xlsx, txt, zip. Max 5 MB (`415` / `413`). Returns the full task. |
| `DELETE /tasks/{id}/attachments/{attachmentId}` | **Extra.** Uploader, Project Manager or Administrator. Returns the full task. |
| `POST /tasks/{id}/reviews` | `{ decision: "approve" \| "changes", comment }`. `201` with the full task. Task must be in `Review` (`409`). Approve sets *Completed*; changes sets *In Progress* and requires a `comment` (`422`). The reviewer cannot be the assignee. Store the `decision` and `comment` on the `review` history entry. |
| `GET /reviews?page&size&decision&projectId` | **Extra.** Administrator, Project Manager, Team Leader. One row per review decision, newest first: `id, taskId, taskTitle, projectId, projectName, assigneeName, reviewerId, reviewerName, decision ("approve" \| "changes"), comment, at`. `decision` and `projectId` filter. |

**History entry `type` values:** `created`, `status`, `assignment`, `priority`, `deadline`, `edit`, `comment`, `attachment`, `review`.

### Reports

Tasks are included when their **deadline** is between `from` and `to` (both optional, inclusive). `422` if `to` is before `from`. Roles: Administrator, Project Manager, Team Leader. These two cover all projects at once; one project's numbers come from `GET /projects/{id}/progress`.

| Method and path | `data` |
|---|---|
| `GET /reports/progress?from&to&projectId` | **Extra.** `{ summary, byProject:[{projectId,name,manager,status,total,completed,review,inProgress,todo,overdue,completionRate}], filters }` |
| `GET /reports/team?from&to&projectId` | **Extra.** `{ summary, byMember:[{memberId,name,role,total,completed,review,inProgress,todo,overdue,completionRate}], filters }` |

`summary` has `total, completed, review, inProgress, todo, overdue, completionRate` (whole percent).

## 5. Suggested tables

`users(id, name, email unique, password_hash, role)` · `projects(id, name, description, start_date, deadline, status, manager_id references users)` · `project_members(project_id, user_id)` (the team, primary key on both columns) · `tasks(id, title, description, project_id, assignee_id, priority, deadline, status, review_comment, created_at, created_by)` · `task_comments(id, task_id, user_id, text, created_at)` · `task_history(id, task_id, user_id, type, text, from_status, to_status, created_at)` · `task_attachments(id, task_id, user_id, file_name, stored_path, size, content_type, created_at)` · `activities(id, user_id, project_id nullable, message, created_at)`.

## 6. Minimal servlet shape (example)

```java
@WebServlet("/api/projects/*")
public class ProjectApiServlet extends HttpServlet {
    @Override protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        User user = (User) req.getSession().getAttribute("user");
        if (user == null) { Json.write(res, 401, Json.fail("Your session has ended. Please sign in again.")); return; }
        int page = Params.intOr(req, "page", 1), size = Params.intOr(req, "size", 6);
        Page<Project> result = projectService.search(user, req.getParameter("q"), req.getParameter("status"), page, size);
        Json.write(res, 200, Json.ok(result.items(), "OK", result.pagination()));   // writes the envelope from section 2
    }
}
```

## 7. Deploying the JSP files

```text
webapp/                     (src/main/webapp in Maven)
├── login.jsp  register.jsp  dashboard.jsp  projects.jsp  team.jsp
├── tasks.jsp  board.jsp  reports.jsp  approvals.jsp  admin.jsp  activity.jsp
├── includes/app-page.jspf  includes/app-shell.jspf
├── WEB-INF/web.xml  WEB-INF/jspf/taglibs.jspf
├── css/style.css
└── js/config.js  permissions.js  api.js  ui.js  app.js        (no mock-server.js)
```

* Copy the contents of `jsp/` to the web-app root, then copy `css/` and `js/` beside them.
* The JSTL library must be available (for example the `jakarta.servlet.jsp.jstl` dependency). On Tomcat 10.1 / Jakarta EE 10, change the two URIs in `WEB-INF/jspf/taglibs.jspf` as its comment explains.
* After a successful `/auth/login`, your servlet must put the user in the session (`session.setAttribute("user", user)`) so the JSP pages can show the name and role. `/auth/logout` must call `session.invalidate()`.
* Add a servlet filter for `*.jsp` and `/api/*` that rejects requests without a session (JSP pages also redirect, but the API must not rely on that).
* The JSP pages are templates only: they were written and checked for structure, but they have not been run inside a servlet container yet. Expect to adjust package names, the user bean, and the JSTL URIs for your server.
* Every module is its own page (`projects.jsp`, `board.jsp`, ...) and links to the others with real links; `data-page-ext=".jsp"` in `includes/app-page.jspf` tells `app.js` to use `.jsp` addresses.
* The app shell markup (sidebar, top bar, dialogs) is repeated in every static `.html` page and once in `jsp/includes/app-shell.jspf`. If you change it, change it in each place.

## 8. Test checklist

1. Log in as each role; each sees only its pages (compare with section 3).
2. List pages: change page, page size, search, filters. Counts in `pagination` match.
3. Create a project and a task with a missing field: the `422` message and `errors` map appear in the form.
4. Try each forbidden action from the table with a REST client; every one must return `403`.
5. Submit a task for review, approve it, then request changes on another: check `history`.
6. Upload a `.exe`, a 6 MB file, and a valid file.
7. Reports with an end date before the start date return `422`.
8. Create a task for someone who is not on the project's team: `422`. Add them with `POST /projects/{id}/members`, then it succeeds.
9. Create a task whose deadline is outside the project dates: `422`.
10. Remove a person who still has an open task in the project, and the project's manager: both `409`.
11. As a Project Manager, add a person to a project you do not manage: `403`.
12. As a Team Member, open a project you are not on: `404`; open `GET /reviews` and `GET /admin/activities`: `403`.
13. `GET /users/me` without a session returns `401` (the app treats it as "not signed in", with no message).
