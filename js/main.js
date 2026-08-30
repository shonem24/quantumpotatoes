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

  function setupCategoryFilter(category) {
    var filter = document.getElementById("category-filter");
    if (!filter) {
      return;
    }

    filter.value = category || "";

    if (filter.getAttribute("data-setup") === "1") {
      return;
    }
    filter.setAttribute("data-setup", "1");

    filter.addEventListener("change", function () {
      var selected = filter.value;
      if (selected) {
        window.location.href =
          "community.html?category=" + encodeURIComponent(selected);
      } else {
        window.location.href = "community.html";
      }
    });
  }

  function updateThreadFormVisibility(category) {
    var form = document.getElementById("thread-form");
    var prompt = document.getElementById("thread-login-prompt");
    var currentUser = getCurrentUser();
    var loggedIn = currentUser && currentUser.id;

    if (form) {
      form.hidden = !loggedIn;
    }
    if (prompt) {
      prompt.hidden = !!loggedIn;
    }

    if (loggedIn && form && category) {
      var categoryInput = form.elements.namedItem("category");
      if (categoryInput) {
        categoryInput.value = category;
      }
    }
  }

  function updateCommentFormVisibility(showForm) {
    var form = document.getElementById("comment-form");
    var prompt = document.getElementById("comment-login-prompt");
    var currentUser = getCurrentUser();
    var loggedIn = currentUser && currentUser.id;
    var shouldShow = !!showForm && loggedIn;

    if (form) {
      form.hidden = !shouldShow;
    }
    if (prompt) {
      prompt.hidden = !showForm || loggedIn;
    }
  }

  function renderCommunity() {
    var list = document.getElementById("thread-list");
    if (!list) {
      return;
    }

    var category = getQueryParam("category");
    updateThreadFormVisibility(category);
    setupCreateThreadForm();
    setupCategoryFilter(category);

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

  function commentParentId(comment) {
    if (!comment) {
      return null;
    }
    if (
      comment.parentCommentId !== null &&
      comment.parentCommentId !== undefined &&
      comment.parentCommentId !== ""
    ) {
      return comment.parentCommentId;
    }
    if (
      comment.parentId !== null &&
      comment.parentId !== undefined &&
      comment.parentId !== ""
    ) {
      return comment.parentId;
    }
    return null;
  }

  function isTopLevelComment(comment) {
    return commentParentId(comment) === null;
  }

  function buildCommentTree(comments) {
    var roots = [];
    var byParent = {};

    comments.forEach(function (comment) {
      var parent = commentParentId(comment);
      if (parent === null) {
        roots.push(comment);
        return;
      }
      var parentKey = String(parent);
      if (!byParent[parentKey]) {
        byParent[parentKey] = [];
      }
      byParent[parentKey].push(comment);
    });

    return { roots: roots, byParent: byParent };
  }

  function reloadThreadComments(threadId, usersById, commentsEl) {
    return fetchJson(
      "/api/threads/" + encodeURIComponent(threadId) + "/comments"
    ).then(function (commentsResult) {
      if (!commentsResult.ok) {
        return commentsResult;
      }
      var comments = Array.isArray(commentsResult.data)
        ? commentsResult.data
        : [];
      renderCommentsList(commentsEl, comments, usersById, threadId);
      return commentsResult;
    });
  }

  function createReplyForm(threadId, parentId, usersById, commentsEl) {
    var form = el("form", "reply-form");
    form.setAttribute("data-parent-id", String(parentId));

    var label = el("label");
    label.textContent = "Write a reply";
    var textarea = el("textarea");
    textarea.name = "body";
    textarea.required = true;
    textarea.rows = 3;
    label.setAttribute("for", "");
    form.appendChild(label);
    form.appendChild(textarea);

    var error = el("p", "form-error");
    error.hidden = true;
    form.appendChild(error);

    var actions = el("div", "reply-form-actions");
    var submit = el("button");
    submit.type = "submit";
    submit.textContent = "Post reply";
    var cancel = el("button");
    cancel.type = "button";
    cancel.className = "reply-cancel";
    cancel.textContent = "Cancel";
    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(actions);

    cancel.addEventListener("click", function () {
      if (form.parentNode) {
        form.parentNode.removeChild(form);
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.textContent = "";
      error.hidden = true;

      var currentUser = getCurrentUser();
      if (!currentUser || !currentUser.id) {
        error.textContent = "Log in to post a reply.";
        error.hidden = false;
        return;
      }

      var content = textarea.value.trim();
      if (!content) {
        error.textContent = "Reply cannot be empty.";
        error.hidden = false;
        return;
      }

      fetchJson("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          threadId: threadId,
          content: content,
          parentId: parentId,
        }),
      })
        .then(function (result) {
          if (!result.ok) {
            error.textContent =
              (result.data && result.data.error) || "Failed to post reply.";
            error.hidden = false;
            return;
          }
          return reloadThreadComments(threadId, usersById, commentsEl).then(
            function (commentsResult) {
              if (!commentsResult.ok) {
                error.textContent =
                  (commentsResult.data && commentsResult.data.error) ||
                  "Reply posted, but failed to refresh comments.";
                error.hidden = false;
              }
            }
          );
        })
        .catch(function () {
          error.textContent = "Could not reach the server. Is it running?";
          error.hidden = false;
        });
    });

    return form;
  }

  function renderSingleComment(comment, usersById, options) {
    var block = el("div", options && options.isReply ? "comment comment-reply" : "comment");

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

    if (options && options.allowReply) {
      var replyBtn = el("button", "reply-button");
      replyBtn.type = "button";
      replyBtn.textContent = "Reply";
      replyBtn.addEventListener("click", function () {
        var existing = block.querySelector(".reply-form");
        if (existing) {
          existing.parentNode.removeChild(existing);
          return;
        }
        var replyForm = createReplyForm(
          options.threadId,
          comment.id,
          usersById,
          options.commentsEl
        );
        block.appendChild(replyForm);
        replyForm.querySelector("textarea").focus();
      });
      block.appendChild(replyBtn);
    }

    return block;
  }

  function renderCommentsList(commentsEl, comments, usersById, threadId) {
    clear(commentsEl);

    if (!comments.length) {
      var empty = el("p");
      empty.textContent = "No comments yet.";
      commentsEl.appendChild(empty);
      return;
    }

    var tree = buildCommentTree(comments);
    var loggedIn = !!(getCurrentUser() && getCurrentUser().id);

    tree.roots.forEach(function (comment) {
      var block = renderSingleComment(comment, usersById, {
        allowReply: loggedIn && !!threadId,
        threadId: threadId,
        commentsEl: commentsEl,
      });

      var replies = tree.byParent[String(comment.id)] || [];
      if (replies.length) {
        var repliesWrap = el("div", "comment-replies");
        replies.forEach(function (reply) {
          repliesWrap.appendChild(
            renderSingleComment(reply, usersById, { isReply: true })
          );
        });
        block.appendChild(repliesWrap);
      }

      commentsEl.appendChild(block);
    });
  }

  function renderCommentsError(commentsEl, message) {
    clear(commentsEl);
    var err = el("p", "form-error");
    err.textContent = message || "Failed to load comments.";
    commentsEl.appendChild(err);
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
      updateCommentFormVisibility(false);
      return;
    }

    titleEl.textContent = "Loading...";
    clear(commentsEl);
    updateCommentFormVisibility(false);

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
          updateCommentFormVisibility(false);
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

        if (!commentsResult.ok) {
          renderCommentsError(
            commentsEl,
            (commentsResult.data && commentsResult.data.error) ||
              "Failed to load comments."
          );
        } else {
          var comments = Array.isArray(commentsResult.data)
            ? commentsResult.data
            : [];
          renderCommentsList(commentsEl, comments, usersById, thread.id);
        }

        updateCommentFormVisibility(true);
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
        updateCommentFormVisibility(false);
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
          return reloadThreadComments(threadId, usersById, commentsEl).then(
            function (commentsResult) {
              if (!commentsResult.ok) {
                showFormError(
                  "comment-error",
                  (commentsResult.data && commentsResult.data.error) ||
                    "Comment posted, but failed to refresh comments."
                );
              }
            }
          );
        })
        .catch(function () {
          showFormError(
            "comment-error",
            "Could not reach the server. Is it running?"
          );
        });
    });
  }

  function editBioButton(userId, isOwnProfile, currentBio) {
    var editButton = document.getElementById("edit-bio-button");
    var saveButton = document.getElementById("save-bio-button");
    var cancelButton = document.getElementById("cancel-bio-button");
    var bioEl = document.getElementById("profile-bio");
    var bioInput = document.getElementById("bio-input");
    var bioEditForm = document.getElementById("bio-edit-form");

    if (
      !editButton ||
      !saveButton ||
      !cancelButton ||
      !bioEl ||
      !bioInput ||
      !bioEditForm
    ) {
      return;
    }

    if (!isOwnProfile) {
      editButton.hidden = true;
      bioEditForm.hidden = true;
      return;
    }

    editButton.hidden = false;
    bioEditForm.hidden = true;

    editButton.addEventListener("click", function () {
      bioInput.value = currentBio || "";
      bioEditForm.hidden = false;
      editButton.hidden = true;
      bioInput.focus();
    });

    cancelButton.addEventListener("click", function () {
      bioEditForm.hidden = true;
      editButton.hidden = false;
    });

    saveButton.addEventListener("click", function () {
      var newBio = bioInput.value.trim();

      fetch(`/api/users/${encodeURIComponent(userId)}/bio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: newBio }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            console.error(result.data.error || "Could not save bio.");
            return;
          }

          var saved;
          if (Array.isArray(result.data)) {
            saved = result.data[0];
          } else {
            saved = result.data;
          }
          currentBio = (saved && saved.bio) || newBio;
          bioEl.textContent = currentBio;
          bioEditForm.hidden = true;
          editButton.hidden = false;

          var currentUser = getCurrentUser();
          if (currentUser && String(currentUser.id) === String(userId)) {
            currentUser.bio = currentBio;
            setCurrentUser(currentUser);
          }
        })
        .catch(function (error) {
          console.error(error);
        });
    });
  }

  function verifiedText(user) {
    if (user && user.verified) {
      return "(verified)";
    }
    return "";
  }

  function sendVerifyButton(user, isOwnProfile) {
    var sendButton = document.getElementById("send-verify-button");
    var statusEl = document.getElementById("verify-send-status");
    if (!sendButton) {
      return;
    }

    var alreadyVerified = user && user.verified;

    if (!isOwnProfile || !user || !user.email || alreadyVerified) {
      sendButton.hidden = true;
      if (statusEl) {
        statusEl.hidden = true;
      }
      return;
    }

    sendButton.hidden = false;
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }

    sendButton.onclick = function () {
      showFormError("verify-send-error", "");
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "";
      }
      sendButton.disabled = true;

      fetch("/api/users/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          sendButton.disabled = false;
          if (!result.ok) {
            showFormError(
              "verify-send-error",
              result.data.error || "Could not send verification email."
            );
            return;
          }

          if (statusEl) {
            statusEl.textContent =
              "Check your email for a verification link.";
            statusEl.hidden = false;
          }
        })
        .catch(function () {
          sendButton.disabled = false;
          showFormError(
            "verify-send-error",
            "Could not reach the server. Is it running?"
          );
        });
    };
  }

  function verifyPage() {
    var verifyButton = document.getElementById("verify-button");
    if (!verifyButton) {
      return;
    }
    //get the email and code from the url
    //found url search params online
    var params = new URLSearchParams(window.location.search);
    var email = params.get("email") || "";
    var code = params.get("code") || "";

    if (!email || !code) {
      showFormError(
        "verify-error",
        "Missing email or code. Open the link from your email."
      );
      verifyButton.disabled = true;
      return;
    }

    verifyButton.addEventListener("click", function () {
      showFormError("verify-error", "");
      verifyButton.disabled = true;

      fetch("/api/users/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, code: code }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showFormError(
              "verify-error",
              result.data.error || "Could not verify account."
            );
            verifyButton.disabled = false;
            return;
          }

          var messageEl = document.getElementById("verify-message");
          if (messageEl) {
            messageEl.textContent =
              result.data.message || "Your account is verified.";
          }
          verifyButton.hidden = true;

          var currentUser = getCurrentUser();
          if (
            currentUser &&
            String(currentUser.email).toLowerCase() ===
              String(email).toLowerCase()
          ) {
            currentUser.verified = true;
            setCurrentUser(currentUser);
          }
        })
        .catch(function (error) {
          console.error(error);
          verifyButton.disabled = false;
        });
    });
  }

  function renderProfile() {
    var nameEl = document.getElementById("profile-name");
    if (!nameEl) {
      return;
    }

    var detailsEl = document.getElementById("profile-details");
    var bioEl = document.getElementById("profile-bio");
    var activityEl = document.getElementById("activity-list");

    var idParam = getQueryParam("id");
    var currentUser = getCurrentUser();
    var profileId = idParam || (currentUser && currentUser.id);
    var isOwnProfile = !!(
      currentUser &&
      currentUser.id &&
      String(currentUser.id) === String(profileId)
    );

    if (!profileId) {
      nameEl.textContent = "Profile";
      detailsEl.textContent = "";
      bioEl.innerHTML = '<a href="login.html">Log in</a> to view your profile.';
      activityEl.innerHTML = "";
      return;
    }

    nameEl.textContent = "Loading...";
    detailsEl.textContent = "";
    bioEl.textContent = "";
    activityEl.innerHTML = "<li>Loading activity...</li>";

    Promise.all([
      loadUsersById(),
      fetchJson("/api/threads"),
      fetchJson("/api/comments?userId=" + encodeURIComponent(profileId)),
    ])
      .then(function (results) {
        var usersById = results[0];
        var threadsResult = results[1];
        var commentsResult = results[2];
        var user = usersById[profileId];

        if (!user) {
          nameEl.textContent = "User not found";
          detailsEl.textContent = "";
          bioEl.textContent = "Could not find this user.";
          activityEl.innerHTML = "";
          return;
        }

        var displayName =
          user.Displayname || user.Username || "User " + profileId;
        var verified = verifiedText(user);
        nameEl.textContent = verified
          ? displayName + " " + verified
          : displayName;

        var detailParts = [];
        if (user.Username) {
          detailParts.push("@" + user.Username);
        }
        if (user.email) {
          detailParts.push(user.email);
        }
        if (user.major) {
          detailParts.push(user.major);
        }
        if (user.universityName || user.university) {
          detailParts.push(user.universityName || user.university);
        }
        detailsEl.textContent = detailParts.join(" · ");
        bioEl.textContent = user.bio || "";
        editBioButton(profileId, isOwnProfile, user.bio || "");
        sendVerifyButton(user, isOwnProfile);

        if (!threadsResult.ok) {
          activityEl.innerHTML =
            "<li>" +
            ((threadsResult.data && threadsResult.data.error) ||
              "Failed to load activity.") +
            "</li>";
          return;
        }

        var threads = Array.isArray(threadsResult.data)
          ? threadsResult.data
          : [];
        var userThreads = threads.filter(function (thread) {
          return String(thread.userId) === String(profileId);
        });

        var comments =
          commentsResult.ok && Array.isArray(commentsResult.data)
            ? commentsResult.data
            : [];

        var activity = [];
        userThreads.forEach(function (thread) {
          activity.push({
            threadId: thread.id,
            text: "Posted: " + (thread.title || "Untitled"),
            date: formatDate(thread.createdAt || thread.created_at),
            sortKey: thread.createdAt || thread.created_at || "",
          });
        });
        comments.forEach(function (comment) {
          activity.push({
            threadId: comment.threadId,
            text: "Commented: " + previewText(comment.content, 60),
            date: formatDate(comment.createdAt || comment.created_at),
            sortKey: comment.createdAt || comment.created_at || "",
          });
        });

        if (!commentsResult.ok) {
          activityEl.innerHTML =
            "<li>" +
            ((commentsResult.data && commentsResult.data.error) ||
              "Failed to load comments for activity.") +
            "</li>";
          if (activity.length === 0) {
            return;
          }
        }

        activity.sort(function (a, b) {
          return String(b.sortKey).localeCompare(String(a.sortKey));
        });

        if (activity.length === 0) {
          activityEl.innerHTML = "<li>No recent activity.</li>";
          return;
        }

        clear(activityEl);
        activity.forEach(function (item) {
          var li = el("li");
          var link = el("a");
          link.href = "thread.html?id=" + encodeURIComponent(item.threadId);
          link.textContent = item.text;
          li.appendChild(link);
          if (item.date) {
            li.appendChild(document.createTextNode(" (" + item.date + ")"));
          }
          activityEl.appendChild(li);
        });
      })
      .catch(function () {
        nameEl.textContent = "Error";
        detailsEl.textContent = "";
        bioEl.textContent = "Could not reach the server. Is it running?";
        activityEl.innerHTML = "";
      });
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

        var email = loginForm.email.value.trim().toLowerCase();
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
          email: signupForm.email.value.trim().toLowerCase(),
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
  verifyPage();
})();
