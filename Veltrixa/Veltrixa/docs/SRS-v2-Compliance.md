# SRS status (version 2.1)

**Done** means it is built and I checked it in a real browser with the demo (mock) server. **Provided** means it is delivered but I could not run it where it will really run.

## Score

Every bullet in sections 4 to 8 of the SRS is one point. A bullet that is only partly done counts as half.

| SRS section | Score | Notes |
|---|---|---|
| 4.1 Login and registration | 5 / 5 | |
| 4.2 Dashboard | 6 / 6 | total, active and completed projects, my tasks, overdue, waiting for approval, recent activity |
| 4.3 Project management | 6 / 6 | project details screen with a Team tab, a starting team can be picked when creating a project |
| 4.4 Team management | 5 / 5 | each member shows open, done, in review and overdue tasks |
| 4.5 Task management | 6 / 6 | tasks only go to people in the project team, deadline must be inside the project dates |
| 4.6 Task board | 5 / 5 | |
| 4.7 Task details and comments | 5 / 5 | attachments only work in the screen, real file storage needs the backend |
| 4.8 Progress reports | 4 / 4 | includes the progress tab of one project (`GET /projects/{id}/progress`) |
| 4.9 Review and approval | 4 / 4 | has a "Recent decisions" list |
| 4.10 Administrator dashboard | 4 / 4 | has a page for the activity log with search and pages |
| 5 UI requirements | 8 / 8 | layout checked on every page at three widths, confirmation before saving edits |
| 6 Endpoints | 18 / 18 | all 18 paths match the SRS, but only tested with the demo server |
| 7 Deliverables | 7.5 / 8 | screenshots are in `docs/screenshots/`, one HTML page per module. The JSP files were never run on a server |
| 8 Acceptance criteria | 2.25 / 3 | "reflects backend responses" can only be checked when the backend exists |
| **Total** | **85.75 / 87 (about 98.6%)** | version 2.0 was 75.5 / 87 (about 87%) |

The missing points are not frontend work: running the JSP pages on Tomcat and testing with the real Java backend.

## Endpoints from section 6

| SRS endpoint | Status |
|---|---|
| `POST /auth/login`, `POST /auth/logout` | Done |
| `GET /users/me` | Done (it was `/auth/me` in 2.0) |
| `GET /projects`, `POST /projects`, `PUT /projects/{id}` | Done |
| `GET /projects/{id}` | Done, new, used by the project details screen |
| `GET /projects/{id}/members`, `POST /projects/{id}/members` | Done, new, used by the Team tab |
| `GET /projects/{id}/tasks`, `POST /projects/{id}/tasks` | Done, the app uses these now (`POST /tasks` is gone) |
| `PUT /tasks/{id}`, `PATCH /tasks/{id}/status` | Done |
| `GET /tasks/{id}/comments`, `POST /tasks/{id}/comments` | Done, comments are not inside `GET /tasks/{id}` any more |
| `POST /tasks/{id}/reviews` | Done (it was `/review` in 2.0) |
| `GET /projects/{id}/progress` | Done, new |
| `GET /admin/dashboard` | Done (it was `/admin/stats` in 2.0) |

Endpoints that are not in the SRS but that the screens need are marked **extra** in `docs/API-INTEGRATION.md`.

## Other requirements

| Requirement | Status | Where |
|---|---|---|
| Login, registration, four roles | Done | `login.html`, `register.html`, `js/permissions.js` |
| Form checks, success and error messages | Done | HTML5 checks, messages from the server shown per field, toasts |
| Menu and buttons by role | Done | buttons are hidden and the mock API also answers 403. The backend must check again (`docs/API-INTEGRATION.md`, section 3) |
| Team for each project | Done | Team tab of the project. A person can't be removed while they have open tasks in that project |
| Deadline inside the project dates | Done | the date picker is limited and the server rule gives a 422 message |
| Confirmation for important changes | Done | saving an edit, moving a task to Review or Completed (or reopening it), removing a person from a team |
| Task board, details, comments, history | Done | |
| Attachments | Done in the screen | type and size are checked. Demo mode only saves the file name |
| Reports with dates, CSV, print | Done | |
| Loading indicators, pages, API errors | Done | `js/api.js`, `js/ui.js` |
| Phone and tablet layout | Done | see the checks below |
| One HTML page per module | Done | 11 pages and an `index.html` that redirects. They share `css/style.css` and `js/app.js` so there are fewer files to upload |
| JSP templates | Provided | `jsp/` has login, register, 9 pages and the shared layout. Not run in a servlet container yet |
| Screenshots | Done | `docs/screenshots/desktop` and `docs/screenshots/mobile` (8 each: login and the main screen of every role) |
| API document for the backend developer | Done | `docs/API-INTEGRATION.md` |

## How version 2.1 was checked

The scripts are in `tests/` and use headless Chromium with Playwright (see `tests/README.md`).

- **API** (`test_api.js`): calls all 18 endpoints as written in the SRS, then the new rules (assignee must be in the team, deadline inside the project dates, protected removals, role limits). 39 of 39 pass.
- **Screens** (`test_ui.js`): clicks through project details, team changes, task limits, confirmations, review decisions, the activity log and the board for all four roles. 45 of 45 pass and there are no errors in the browser console.
- **Layout** (`test_resp.js`): opens every page and the main dialogs for all four roles at 390, 768 and 1100 pixels and looks for anything sticking out of the screen. 123 checks, no problems. I first added a too wide box on purpose to make sure the check catches it.
- **Same look as before:** when the project was split into one page per module, 42 screenshots of the old and the new version were compared pixel by pixel and they match. After rewriting the comments, I also compared the code with all comments removed and it is identical.
- **Not checked:** real phones, Safari, Firefox, screen readers and the JSP pages.

## Problems found and fixed

- Sign out was hidden on phones (the user block was removed to save space). It is now a small button in the corner.
- After renaming `/auth/me` to `/users/me`, every fresh page load showed "Your session has ended". That start up check is quiet now.
- The Remove button in the project team table was off screen on phones, so the Role column is hidden there.

## Demo data

- The demo data is version 3. Projects have teams, review decisions are saved as real review events (two of them are "changes requested") and the activity log has 78 entries so the pages can be seen.
- The browser storage key is now `veltrixa_mock_db_v3`. Accounts registered in version 2.0 are copied the first time, but changed projects and tasks are not.
- "Overdue" depends on today's date. The screenshots were taken on 13 November 2026.

## Not done (not frontend work)

- Java servlets, business logic, database, password hashing and real file storage.
- Trying the JSP files on Tomcat or another server.
- Email invitations and password reset.
- If a project's dates are changed so that old tasks end up outside them, nothing warns about it. The deadline rule only runs when a task is created or its deadline or project changes.
