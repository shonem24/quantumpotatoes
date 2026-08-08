(function () {
  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function renderCommunity() {
    var list = document.getElementById("thread-list");
    if (!list) {
      return;
    }

    var category = getQueryParam("category");
    var threads = THREADS;

    if (category) {
      threads = THREADS.filter(function (thread) {
        return thread.category.toLowerCase() === category.toLowerCase();
      });
    }

    if (threads.length === 0) {
      list.innerHTML = "<li>No threads in this category yet.</li>";
      return;
    }

    list.innerHTML = threads
      .map(function (thread) {
        var author = getUserById(thread.authorId);
        var authorName = author ? author.name : "Unknown";
        var verified = formatVerified(author);
        return (
          "<li>" +
          '<p class="thread-meta">' +
          thread.category +
          " · " +
          thread.createdAt +
          "</p>" +
          '<p><a href="thread.html?id=' +
          thread.id +
          '">' +
          thread.title +
          "</a></p>" +
          "<p>" +
          authorName +
          " " +
          verified +
          "</p>" +
          "<p>" +
          thread.preview +
          "</p>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderThread() {
    var titleEl = document.getElementById("thread-title");
    if (!titleEl) {
      return;
    }

    var idParam = getQueryParam("id");
    var threadId = idParam ? parseInt(idParam, 10) : THREADS[0].id;
    var thread = getThreadById(threadId) || THREADS[0];
    var author = getUserById(thread.authorId);

    document.getElementById("thread-category").textContent = thread.category;
    titleEl.textContent = thread.title;
    document.getElementById("thread-meta").textContent =
      (author ? author.name : "Unknown") +
      " " +
      formatVerified(author) +
      " · " +
      thread.createdAt;
    document.getElementById("thread-body").textContent = thread.body;

    var comments = getCommentsForThread(thread.id);
    var commentsEl = document.getElementById("comments");
    if (comments.length === 0) {
      commentsEl.innerHTML = "<p>No comments yet.</p>";
    } else {
      commentsEl.innerHTML = comments
        .map(function (comment) {
          var commentAuthor = getUserById(comment.authorId);
          return (
            '<div class="comment">' +
            "<p>" +
            (commentAuthor ? commentAuthor.name : "Unknown") +
            " " +
            formatVerified(commentAuthor) +
            " · " +
            comment.createdAt +
            "</p>" +
            "<p>" +
            comment.body +
            "</p>" +
            "</div>"
          );
        })
        .join("");
    }

    var form = document.getElementById("comment-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Posting comments will work once the backend is connected.");
      });
    }
  }

  function renderProfile() {
    var nameEl = document.getElementById("profile-name");
    if (!nameEl) {
      return;
    }

    var idParam = getQueryParam("id");
    var userId = idParam ? parseInt(idParam, 10) : 1;
    var user = getUserById(userId) || USERS[0];

    nameEl.textContent = user.name + " " + formatVerified(user);
    document.getElementById("profile-details").textContent =
      user.major +
      " · Class of " +
      user.graduationYear +
      " · " +
      user.university;
    document.getElementById("profile-bio").textContent = user.bio;

    var activity = getUserActivity(user.id);
    var activityEl = document.getElementById("activity-list");
    if (activity.length === 0) {
      activityEl.innerHTML = "<li>No recent activity.</li>";
    } else {
      activityEl.innerHTML = activity
        .map(function (item) {
          return (
            "<li>" +
            '<a href="thread.html?id=' +
            item.threadId +
            '">' +
            item.text +
            "</a>" +
            " (" +
            item.date +
            ")" +
            "</li>"
          );
        })
        .join("");
    }
  }

  function wireAuthForms() {
    var loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Sign-in will work once the backend is connected.");
        window.location.href = "community.html";
      });
    }

    var signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Account creation will work once the backend is connected.");
        window.location.href = "community.html";
      });
    }
  }

  renderCommunity();
  renderThread();
  renderProfile();
  wireAuthForms();
})();
