(function () {
  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function previewText(content, maxLen) {
    var text = content || "";
    if (text.length <= maxLen) {
      return text;
    }
    return text.slice(0, maxLen).trim() + "...";
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }
    return String(value).slice(0, 10);
  }

  function authorLabel(usersById, userId) {
    var user = usersById[userId];
    if (!user) {
      return "User " + userId;
    }
    return user.Displayname || user.Username || "User " + userId;
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
  }

  function loadUsersById() {
    return fetchJson("/api/users").then(function (result) {
      var map = {};
      if (!result.ok || !Array.isArray(result.data)) {
        return map;
      }
      result.data.forEach(function (user) {
        map[user.id] = user;
      });
      return map;
    });
  }

  function highlightActiveCategory(category) {
    var links = document.querySelectorAll(".categories a");
    links.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var linkCategory = null;
      try {
        var url = new URL(href, window.location.origin);
        linkCategory = url.searchParams.get("category");
      } catch (err) {
        linkCategory = null;
      }

      var isAll = !linkCategory && href.indexOf("category=") === -1;
      var isActive = category
        ? linkCategory &&
          linkCategory.toLowerCase() === category.toLowerCase()
        : isAll;

      if (isActive) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    });
  }

  function renderCommunity() {
    var list = document.getElementById("thread-list");
    if (!list) {
      return;
    }

    setupCreateThreadForm();

    var category = getQueryParam("category");
    highlightActiveCategory(category);

    var threadsUrl = "/api/threads";
    if (category) {
      threadsUrl += "?category=" + encodeURIComponent(category);
    }

    clear(list);
    var loading = el("li");
    loading.textContent = "Loading threads...";
    list.appendChild(loading);

    Promise.all([fetchJson(threadsUrl), loadUsersById()])
      .then(function (results) {
        var threadsResult = results[0];
        var usersById = results[1];

        clear(list);

        if (!threadsResult.ok) {
          var errItem = el("li");
          errItem.textContent =
            (threadsResult.data && threadsResult.data.error) ||
            "Failed to load threads.";
          list.appendChild(errItem);
          return;
        }

        var threads = Array.isArray(threadsResult.data)
          ? threadsResult.data
          : [];

        if (threads.length === 0) {
          var empty = el("li");
          empty.textContent = "No threads in this category yet.";
          list.appendChild(empty);
          return;
        }

        threads.forEach(function (thread) {
          var item = el("li");

          var meta = el("p", "thread-meta");
          var metaParts = [thread.category || "Uncategorized"];
          var date = formatDate(thread.createdAt || thread.created_at);
          if (date) {
            metaParts.push(date);
          }
          meta.textContent = metaParts.join(" · ");
          item.appendChild(meta);

          var titleWrap = el("p");
          var titleLink = el("a");
          titleLink.href = "thread.html?id=" + encodeURIComponent(thread.id);
          titleLink.textContent = thread.title || "Untitled";
          titleWrap.appendChild(titleLink);
          item.appendChild(titleWrap);

          var author = el("p");
          author.textContent = authorLabel(usersById, thread.userId);
          item.appendChild(author);

          var preview = el("p");
          preview.textContent = previewText(thread.content, 100);
          item.appendChild(preview);

          list.appendChild(item);
        });
      })
      .catch(function () {
        clear(list);
        var errItem = el("li");
        errItem.textContent = "Could not reach the server. Is it running?";
        list.appendChild(errItem);
      });
  }

  function setupCreateThreadForm() {
    var form = document.getElementById("thread-form");
    if (!form || form.getAttribute("data-setup") === "1") {
      return;
    }
    form.setAttribute("data-setup", "1");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      showFormError("thread-error", "");

      var currentUser = getCurrentUser();
      if (!currentUser || !currentUser.id) {
        showFormError("thread-error", "Log in to create a thread.");
        return;
      }

      var title = form.elements.namedItem("title").value.trim();
      var category = form.elements.namedItem("category").value;
      var content = form.elements.namedItem("content").value.trim();

      if (!title || !category || !content) {
        showFormError("thread-error", "Title, category, and content are required.");
        return;
      }

      fetchJson("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          title: title,
          content: content,
          category: category,
        }),
      })
        .then(function (result) {
          if (!result.ok) {
            showFormError(
              "thread-error",
              (result.data && result.data.error) || "Failed to create thread."
            );
            return;
          }

          var created =
            result.data && result.data.thread ? result.data.thread : null;
          if (!created || !created.id) {
            showFormError("thread-error", "Thread created but no id returned.");
            return;
          }

          window.location.href =
            "thread.html?id=" + encodeURIComponent(created.id);
        })
        .catch(function () {
          showFormError(
            "thread-error",
            "Could not reach the server. Is it running?"
          );
        });
    });
  }

  function renderCommentsList(commentsEl, comments, usersById) {
    clear(commentsEl);

    if (!comments.length) {
      var empty = el("p");
      empty.textContent = "No comments yet.";
      commentsEl.appendChild(empty);
      return;
    }

    comments.forEach(function (comment) {
      var block = el("div", "comment");

      var meta = el("p");
      var metaParts = [authorLabel(usersById, comment.userId)];
      var date = formatDate(comment.createdAt || comment.created_at);
      if (date) {
        metaParts.push(date);
      }
      meta.textContent = metaParts.join(" · ");
      block.appendChild(meta);

      var body = el("p");
      body.textContent = comment.content || "";
      block.appendChild(body);

      commentsEl.appendChild(block);
    });
  }

  function renderThread() {
    var titleEl = document.getElementById("thread-title");
    if (!titleEl) {
      return;
    }

    var idParam = getQueryParam("id");
    var categoryEl = document.getElementById("thread-category");
    var metaEl = document.getElementById("thread-meta");
    var bodyEl = document.getElementById("thread-body");
    var commentsEl = document.getElementById("comments");
    var form = document.getElementById("comment-form");

    if (!idParam) {
      categoryEl.textContent = "";
      titleEl.textContent = "Thread not found";
      metaEl.textContent = "";
      bodyEl.textContent = "Missing thread id.";
      clear(commentsEl);
      if (form) {
        form.hidden = true;
      }
      return;
    }

    titleEl.textContent = "Loading...";
    clear(commentsEl);

    var threadId = idParam;
    var usersById = {};

    Promise.all([
      fetchJson("/api/threads?id=" + encodeURIComponent(threadId)),
      fetchJson("/api/threads/" + encodeURIComponent(threadId) + "/comments"),
      loadUsersById(),
    ])
      .then(function (results) {
        var threadResult = results[0];
        var commentsResult = results[1];
        usersById = results[2];

        if (!threadResult.ok) {
          categoryEl.textContent = "";
          titleEl.textContent = "Thread not found";
          metaEl.textContent = "";
          bodyEl.textContent =
            (threadResult.data && threadResult.data.error) ||
            "Could not load this thread.";
          clear(commentsEl);
          if (form) {
            form.hidden = true;
          }
          return;
        }

        var thread = threadResult.data;
        categoryEl.textContent = thread.category || "";
        titleEl.textContent = thread.title || "Untitled";

        var metaParts = [authorLabel(usersById, thread.userId)];
        var date = formatDate(thread.createdAt || thread.created_at);
        if (date) {
          metaParts.push(date);
        }
        metaEl.textContent = metaParts.join(" · ");
        bodyEl.textContent = thread.content || "";

        var comments =
          commentsResult.ok && Array.isArray(commentsResult.data)
            ? commentsResult.data
            : [];
        renderCommentsList(commentsEl, comments, usersById);

        if (form) {
          wireCommentForm(form, thread.id, usersById, commentsEl);
        }
      })
      .catch(function () {
        categoryEl.textContent = "";
        titleEl.textContent = "Error";
        metaEl.textContent = "";
        bodyEl.textContent = "Could not reach the server. Is it running?";
        clear(commentsEl);
      });
  }

  function wireCommentForm(form, threadId, usersById, commentsEl) {
    if (form.getAttribute("data-wired") === "1") {
      return;
    }
    form.setAttribute("data-wired", "1");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      showFormError("comment-error", "");

      var currentUser = getCurrentUser();
      if (!currentUser || !currentUser.id) {
        showFormError("comment-error", "Log in to post a comment.");
        return;
      }

      var content = form.body.value.trim();
      if (!content) {
        showFormError("comment-error", "Comment cannot be empty.");
        return;
      }

      fetchJson("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          threadId: threadId,
          content: content,
        }),
      })
        .then(function (result) {
          if (!result.ok) {
            showFormError(
              "comment-error",
              (result.data && result.data.error) || "Failed to post comment."
            );
            return;
          }

          form.body.value = "";
          return fetchJson(
            "/api/threads/" + encodeURIComponent(threadId) + "/comments"
          ).then(function (commentsResult) {
            var comments =
              commentsResult.ok && Array.isArray(commentsResult.data)
                ? commentsResult.data
                : [];
            renderCommentsList(commentsEl, comments, usersById);
          });
        })
        .catch(function () {
          showFormError(
            "comment-error",
            "Could not reach the server. Is it running?"
          );
        });
    });
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

  var CURRENT_USER_KEY = "currentUser";

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return;
    }
    var safe = Object.assign({}, user);
    delete safe.password;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safe));
  }

  function clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  function showFormError(elementId, message) {
    var element = document.getElementById(elementId);
    if (!element) {
      return;
    }
    if (message) {
      element.textContent = message;
      element.hidden = false;
    } else {
      element.textContent = "";
      element.hidden = true;
    }
  }

  function wireAuthForms() {
    var loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        showFormError("login-error", "");

        var email = loginForm.email.value.trim();
        var password = loginForm.password.value;

        fetch("/api/users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password }),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              showFormError(
                "login-error",
                result.data.error || "Login failed. Please try again."
              );
              return;
            }
            setCurrentUser(result.data.user);
            window.location.href = "community.html";
          })
          .catch(function () {
            showFormError(
              "login-error",
              "Could not reach the server. Is it running?"
            );
          });
      });
    }

    var signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.addEventListener("submit", function (event) {
        event.preventDefault();
        showFormError("signup-error", "");

        var payload = {
          Username: signupForm.Username.value.trim(),
          Displayname: signupForm.Displayname.value.trim(),
          email: signupForm.email.value.trim(),
          password: signupForm.password.value,
          major: signupForm.major.value.trim() || null,
          verified: false,
          universityName: "Drexel University",
        };

        fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              showFormError(
                "signup-error",
                result.data.error || "Sign up failed. Please try again."
              );
              return;
            }
            var created = Array.isArray(result.data)
              ? result.data[0]
              : result.data;
            setCurrentUser(created);
            window.location.href = "community.html";
          })
          .catch(function () {
            showFormError(
              "signup-error",
              "Could not reach the server. Is it running?"
            );
          });
      });
    }
  }

  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.clearCurrentUser = clearCurrentUser;

  renderCommunity();
  renderThread();
  renderProfile();
  wireAuthForms();
})();
