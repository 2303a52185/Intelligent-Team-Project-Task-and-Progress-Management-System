/* Permissions for the four roles.
   The screens use this to hide pages and buttons, and the mock server uses it to reject
   requests with 403. The Java backend must check these again, because hiding a button
   in the browser is not security. */
const Permissions = (() => {
    const A = "Administrator", PM = "Project Manager", TL = "Team Leader", TM = "Team Member";
    const ROLES = [A, PM, TL, TM];

    // which roles can open each page
    const PAGES = {
        dashboard: ROLES,
        projects: ROLES,            // team members only see the projects they work on
        team: [A, PM, TL],
        tasks: ROLES,               // team members only see their own tasks
        board: ROLES,
        reports: [A, PM, TL],
        approvals: [A, PM, TL],
        admin: [A],
        activity: [A]               // full activity log
    };

    // which roles can do each action
    const ACTIONS = {
        "project.create": [A, PM],
        "project.edit": [A, PM],           // a project manager can edit only the projects they manage
        "project.delete": [A],
        "project.assignManager": [A],
        "project.manageTeam": [A, PM],     // add or remove people on a project team (a project manager only on their own projects)
        "member.add": [A, PM],
        "member.remove": [A, PM],
        "member.changeRole": [A],
        "task.create": [A, PM, TL],
        "task.edit": [A, PM, TL],
        "task.assign": [A, PM, TL],
        "task.delete": [A, PM],
        "task.review": [A, PM, TL],
        "task.comment": ROLES,
        "task.attach": ROLES,
        "report.view": [A, PM, TL],
        "review.view": [A, PM, TL]         // list of recent review decisions
    };

    const can = (role, action) => (ACTIONS[action] || []).includes(role);
    const canViewPage = (role, page) => (PAGES[page] || []).includes(role);

    // a project manager can only edit their own projects, an administrator can edit all of them
    const canEditProject = (user, project) =>
        user.role === A || (user.role === PM && project.managerId === user.id);

    // adding or removing people on a team follows the same rule as editing the project
    const canManageProjectTeam = (user, project) => can(user.role, "project.manageTeam") && canEditProject(user, project);

    // which roles someone can give to a new member. A project manager can't create admins or other PMs
    const rolesUserMayAssign = role => role === A ? ROLES : role === PM ? [TL, TM] : [];

    // a reviewer can't approve their own work
    const canReviewTask = (user, task) => can(user.role, "task.review") && task.assigneeId !== user.id;

    // can this user move this task to this status?
    // team members can move only their own tasks, and only up to "Review" (a reviewer completes it)
    function canMoveTask(user, task, toStatus) {
        if (user.role === TM) return task.assigneeId === user.id && toStatus !== "Completed" && task.status !== "Completed";
        if (toStatus === "Completed") return canReviewTask(user, task);   // completing means approving
        return can(user.role, "task.edit");
    }

    return { ROLES, can, canViewPage, canEditProject, canManageProjectTeam, canMoveTask, canReviewTask, rolesUserMayAssign };
})();
