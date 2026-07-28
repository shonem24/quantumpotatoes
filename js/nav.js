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
})();
