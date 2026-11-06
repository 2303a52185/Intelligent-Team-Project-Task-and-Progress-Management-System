# Veltrixa – Intelligent Team Project Management System

Veltrixa is a small frontend project for managing projects, team members and tasks. It is made with **HTML, CSS and JavaScript**. Bootstrap is used for a few ready-made layout and modal components.

This version is designed as a learning project. The code is kept in small functions with clear names and comments so it is easier to follow and change.

## What you can do

- Sign in using the demo login screen and choose one of the four roles: Administrator, Project Manager, Team Leader or Team Member.
- View project and task counts on the dashboard.
- Add, edit, search and delete projects.
- Add and remove team members.
- Create and update tasks, assign team members and set priorities.
- Move tasks between stages on the task board.
- Open a task to read its details and add comments.
- Review submitted tasks and approve them or request changes.
- View simple project and task reports.

## Open the project in VS Code

1. Extract the ZIP file.
2. Open VS Code.
3. Select **File → Open Folder** and choose the `Intelligent-Team-Project-Management` folder. Open the folder that contains `index.html`.
4. Install the **Live Server** extension if you do not already have it.
5. Right-click `index.html` and choose **Open with Live Server**.
6. Sign in. The page already has a sample email and password filled in. You can also enter any valid email and a password with at least four characters.
7. Choose a role from the Demo role list and click **Sign in**.

You need an internet connection for Bootstrap and the Google font loaded from their CDNs.

## Demo login details

- Email: `athiqa@example.com`
- Password: `demo1234`
- Role: choose any role from the list

The role is selected on the same login screen. This is a frontend demonstration, not four separate secure login systems.

## Folder and file guide

```text
Intelligent-Team-Project-Management/
│
├── index.html          Main page and login screen
├── css/
│   └── style.css       Colours, spacing, layout and mobile styles
├── js/
│   └── app.js          Login, navigation, forms and page behaviour
├── data/
│   └── mock-data.json  Sample project, member and task data
└── README.md           Setup instructions and project notes
```

### What each file does

- **`index.html`** contains the page structure, navigation, login form and popup windows.
- **`css/style.css`** controls how the website looks on desktop and mobile screens.
- **`js/app.js`** contains the JavaScript. It loads the sample data, handles button clicks and forms, updates the pages and saves changes.
- **`data/mock-data.json`** is a readable copy of the sample data. The demo currently starts with the sample data written inside `app.js`; this JSON file is included as a reference dataset.

## How saving works

The browser's `localStorage` stores changes made in the demo. Your changes usually remain after refreshing the page in the same browser. They are not sent to a server and will not appear on another computer.

To reset the demo, open the browser's Developer Tools, go to **Application → Local Storage**, delete the `veltrixa_demo_data_v1` entry, and refresh the page.

## Important notes

- Login is simulated. Any valid email and a password of four or more characters will work. There is no password checking or secure account system.
- Choosing a role changes the role shown in the interface. It does not enforce real permissions.
- Data is stored only in the current browser using `localStorage`.
- This is a frontend prototype. It does not include a Java backend or database.
- The original system can later be connected to a Java/JSP backend and a database once the backend APIs are ready.


## User registration and sign-in

The login screen includes a Create an account option. A new user can enter their name, email, role, and password. The form checks that the email is not already registered and that both password entries match. After registration, the account is saved in the browser's localStorage and the user can sign in with that email and password. New accounts are also added to the team members list.

This is a frontend learning demo only. Browser localStorage is not secure authentication and stores data on that device. Do not use real or sensitive passwords. A production website needs a backend, password hashing, and server-side role checks.
