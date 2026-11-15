<%@ page contentType="text/html;charset=UTF-8" language="java" session="true" %>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>
<c:if test="${not empty sessionScope.user}"><c:redirect url="/dashboard.jsp"/></c:if>
<c:set var="pageTitle" value="Create account"/>
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
      <h1>Create your account</h1>
      <p class="muted">Join your team on Veltrixa.</p>
      <div id="registerPanel">
        <form id="registerForm">
          <label class="form-label" for="registerName">Full name</label>
          <input class="form-control mb-3" id="registerName" type="text" required minlength="2" placeholder="Enter your full name">
          <label class="form-label" for="registerEmail">Email address</label>
          <input class="form-control mb-3" id="registerEmail" type="email" required placeholder="name@example.com">
          <label class="form-label" for="registerRole">Your role</label>
          <select class="form-select mb-3" id="registerRole" required>
            <option value="Team Member">Team Member</option>
            <option value="Team Leader">Team Leader</option>
            <option value="Project Manager">Project Manager</option>
            <option value="Administrator">Administrator</option>
          </select>
          <label class="form-label" for="registerPassword">Create password</label>
          <input class="form-control mb-3" id="registerPassword" type="password" required minlength="6" placeholder="At least 6 characters">
          <label class="form-label" for="confirmPassword">Confirm password</label>
          <input class="form-control mb-3" id="confirmPassword" type="password" required minlength="6" placeholder="Enter password again">
          <div id="registerError" class="auth-message small mb-2" role="alert" aria-live="polite"></div>
          <button class="btn btn-primary w-100" type="submit" id="registerButton">Create account</button>
        </form>
        <p class="auth-switch">Already registered? <a class="link-button" href="${ctx}/login.jsp">Sign in</a></p>
      </div>
      <p class="login-note">Your account is created on the server. Privileged roles may need administrator approval.</p>
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
