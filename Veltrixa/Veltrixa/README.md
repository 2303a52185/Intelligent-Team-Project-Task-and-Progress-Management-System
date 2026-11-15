# Veltrixa - Intelligent Team Project Management System

Veltrixa is a frontend project for managing projects, team members and tasks. It is built with HTML, CSS and JavaScript, and uses Bootstrap for the layout and the pop-up windows.

I tried to keep the code easy to read: small functions, clear names and short comments.

## What you can do

- Log in with a demo role (the buttons on the login page) or register a new account.
- See a dashboard that fits your role.
- Add, edit, search, sort and delete projects, and open a project to see its team, tasks and progress.
- Add and remove team members, and change roles (administrator only).
- Create, assign and filter tasks, and move them on the board (drag a card or use the menu on it).
- Open a task to write comments, see its history and add files.
- Review tasks: approve them or send them back with a comment.
- Make progress and team reports for a date range, and export them as CSV or print them.

## How to run it

1. Unzip the project.
2. Open the folder in VS Code (File > Open Folder), the one that has `index.html`.
3. Install the **Live Server** extension if you don't have it.
4. Right-click `index.html` and choose **Open with Live Server**. Don't just double-click the file, because the demo loads `data/mock-data.json` and browsers block that on `file://` addresses.
5. Click one of the demo role buttons and then **Sign in**.

You need internet for Bootstrap and the Google font, they load from a CDN.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@veltrixa.com` | `admin1234` |
| Project Manager | `athiqa@example.com` | `demo1234` |
| Team Leader | `rahul@example.com` | `demo1234` |
| Team Member | `priya@example.com` | `demo1234` |

Pick the role that matches the account. The buttons on the login page fill these in for you.

## Pages and SRS modules

Each module is its own HTML page and the pages link to each other. They all use the same `css/style.css` and `js/app.js`. Each page has `data-page` on its body tag, which tells the script which module to draw.

| SRS module | Page |
|---|---|
| 4.1 Login and registration | `login.html`, `register.html` |
| 4.2 Dashboard | `dashboard.html` |
| 4.3 Project management | `projects.html` (project details are at `projects.html#project-3`) |
| 4.4 Team management | `team.html` |
| 4.5 Task management | `tasks.html` |
| 4.6 Task board | `board.html` |
| 4.7 Task details and comments | a dialog that opens from the dashboard, projects, tasks, board and approvals pages |
| 4.8 Progress reports | `reports.html` |
| 4.9 Review and approval | `approvals.html` |
| 4.10 Administrator dashboard | `admin.html`, `activity.html` |

The sidebar, top bar and dialogs are the same in every page. If you change them, change them in each `.html` file (and once in `jsp/includes/app-shell.jspf`).

## Files

```text
Veltrixa/
├── index.html              sends you to login.html (or the dashboard if you are logged in)
├── login.html  register.html  dashboard.html  projects.html  team.html  tasks.html
├── board.html  reports.html  approvals.html  admin.html  activity.html
├── css/style.css           all the styles
├── js/
│   ├── config.js           settings: mock or real API, page sizes, attachment limits
│   ├── permissions.js      which role can open or do what
│   ├── mock-server.js      demo backend that runs in the browser
│   ├── api.js              fetch calls, one function per endpoint
│   ├── ui.js               toasts, dialogs, loading, pagination
│   └── app.js              the screens and what they do
├── data/mock-data.json     demo data: 15 people, 9 projects, 32 tasks
├── jsp/                    JSP version of the pages for the Java web app
├── tests/                  browser tests (optional, see tests/README.md)
└── docs/
    ├── API-INTEGRATION.md  the endpoints the Java backend must provide
    ├── SRS-v2-Compliance.md  what is done and what is not
    └── screenshots/        desktop and mobile screenshots
```

## Connecting the Java backend

Everything is explained in `docs/API-INTEGRATION.md`. Short version: put the files in `jsp/` together with `css/` and `js/`, don't load `mock-server.js`, and build the endpoints from the document. The JSP pages already make the app use real requests.

## How the demo saves data

The mock server keeps the data in the browser (`localStorage`, key `veltrixa_mock_db_v3`) and the logged in user in `sessionStorage`. It is not secure and not shared between browsers. To reset the demo, delete that key (Developer Tools > Application > Local Storage) and refresh.

## Things to remember

- The demo login is fake and the passwords stay in the browser. Don't use real passwords.
- Hiding a button for a role is not security. The Java backend has to check the role on every request.
- In demo mode an attachment only saves the file name and size, not the file.
- When registering, the form checks the email is new and that both passwords match. In production it calls `POST /auth/register`, and the backend must hash the passwords and decide which roles a person may pick.

## Versions

**2.1**
- Project details screen with Overview, Team, Tasks and Progress tabs. People can be added to or removed from a project team, and tasks can only go to people in that team.
- The API paths match section 6 of the SRS (all 18).
- A task deadline must be inside the project dates.
- The dashboard has the six cards from the SRS.
- The team page shows open, done, in review and overdue tasks for each person.
- Review and approvals has a "Recent decisions" tab, and the administrator has an activity log page.
- Asks for confirmation before saving an edit, moving a task to Review or Completed, and removing a person from a team.
- One HTML page for each module, and a fix for the sign out button on phones.

**2.0**
- Dashboards, menu and permissions for the four roles.
- `js/api.js` with fetch calls, loading indicators and messages. Demo mode uses the mock server.
- Pagination, search and filters.
- Task history, comments and attachments.
- Reports with CSV export and printing, administrator statistics, JSP templates and the API guide.
