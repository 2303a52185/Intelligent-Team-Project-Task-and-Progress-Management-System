<%@ page contentType="text/html;charset=UTF-8" language="java" session="true" %>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>
<c:if test="${not empty sessionScope.user}"><c:redirect url="/dashboard.jsp"/></c:if>
<c:set var="pageTitle" value="Sign in"/>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Veltrixa | ${pageTitle}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="${ctx}/css/style.css">
</head>
<body data-mode="auth" data-api-base="${ctx}/api"
      data-dashboard-url="${ctx}/dashboard.jsp" data-login-url="${ctx}/login.jsp">
  <div id="topLoader" class="top-loader" aria-hidden="true"></div>
  <div id="toastArea" class="toast-container position-fixed top-0 end-0 p-3" aria-live="polite"></div>
  <div id="loginScreen" class="login-screen">
    <div class="login-card">
      <div class="brand-mark large" aria-label="Veltrixa logo">V</div>
      <h1>Welcome to Veltrixa</h1>
      <p class="muted">Sign in to manage your team's projects and tasks.</p>
      <div id="loginPanel">
        <form id="loginForm">
          <label class="form-label" for="loginEmail">Email address</label>
          <input class="form-control mb-3" id="loginEmail" type="email" required placeholder="name@example.com">
          <label class="form-label" for="loginPassword">Password</label>
          <input class="form-control mb-3" id="loginPassword" type="password" required minlength="4" placeholder="Enter your password">
          <label class="form-label" for="loginRole">Select your role</label>
          <select class="form-select mb-3" id="loginRole" required>
            <option value="" disabled selected>Choose your role</option>
            <option value="Administrator">Administrator</option>
            <option value="Project Manager">Project Manager</option>
            <option value="Team Leader">Team Leader</option>
            <option value="Team Member">Team Member</option>
          </select>
          <div id="loginError" class="auth-message small mb-2" role="alert" aria-live="polite"></div>
          <button class="btn btn-primary w-100" type="submit" id="loginButton">Sign in</button>
        </form>
        <p class="auth-switch">New to Veltrixa? <a class="link-button" href="${ctx}/register.jsp">Create an account</a></p>
      </div>
      <p class="login-note">Passwords are checked by the server. Your session is stored in a secure cookie.</p>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="${ctx}/js/config.js"></script>
  <script src="${ctx}/js/permissions.js"></script>
  <script src="${ctx}/js/api.js"></script>   <%-- no mock-server.js here, real fetch calls go to ${ctx}/api --%>
  <script src="${ctx}/js/ui.js"></script>
  <script src="${ctx}/js/app.js"></script>
</body>
</html>
