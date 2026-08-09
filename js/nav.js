(function () {
  var path = window.location.pathname.split("/").pop() || "index.html";
  if (path === "") {
    path = "index.html";
  }

  var links = document.querySelectorAll("nav a[data-page]");
  links.forEach(function (link) {
    if (link.getAttribute("data-page") === path) {
      link.setAttribute("aria-current", "page");
    }
  });

  var loginLink = document.querySelector('nav a[data-page="login.html"]');
  if (!loginLink) {
    return;
  }

  var currentUser = null;
  try {
    var raw = localStorage.getItem("currentUser");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch (err) {
    currentUser = null;
  }

  if (currentUser) {
    var label = currentUser.Displayname || currentUser.Username || "Profile";
    loginLink.textContent = label;
    loginLink.href = "profile.html";
    loginLink.setAttribute("data-page", "profile.html");
    if (path === "profile.html") {
      loginLink.setAttribute("aria-current", "page");
    } else {
      loginLink.removeAttribute("aria-current");
    }

    var logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.textContent = "Log out";
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("currentUser");
      window.location.href = "login.html";
    });
    loginLink.insertAdjacentElement("afterend", logoutBtn);

    var signupCta = document.querySelector('.cta-links a[href="signup.html"]');
    if (signupCta) {
      signupCta.remove();
    }
  }
})();
