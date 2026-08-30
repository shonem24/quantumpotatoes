const cache = require("./cache");

const ALLOWED_CATEGORIES = ["Campus", "Housing", "Co-ops"];
const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const MAX_SEARCH_LENGTH = 100;

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeSearchPattern(value) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function buildSearchFilter(search) {
  const term = escapeSearchPattern(trimString(search));
  const encodedTerm = encodeURIComponent(term);
  const pattern = `%25${encodedTerm}%25`;
  return `or=(title.ilike.${pattern},content.ilike.${pattern})`;
}

function supabaseHeaders(secretKey) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

function userExists(axios, baseUrl, secretKey, userId) {
  const url = `${baseUrl}/rest/v1/Users?select=id&id=eq.${encodeURIComponent(userId)}`;
  return axios
    .get(url, { headers: supabaseHeaders(secretKey) })
    .then((response) => Array.isArray(response.data) && response.data.length > 0);
}

function threadExists(axios, baseUrl, secretKey, threadId) {
  const url = `${baseUrl}/rest/v1/Threads?select=id&id=eq.${encodeURIComponent(threadId)}`;
  return axios
    .get(url, { headers: supabaseHeaders(secretKey) })
    .then((response) => Array.isArray(response.data) && response.data.length > 0);
}

function getCommentById(axios, baseUrl, secretKey, commentId) {
  const url = `${baseUrl}/rest/v1/Comments?select=*&id=eq.${encodeURIComponent(commentId)}`;
  return axios
    .get(url, { headers: supabaseHeaders(secretKey) })
    .then((response) =>
      Array.isArray(response.data) && response.data.length > 0
        ? response.data[0]
        : null
    );
}

function threadsCacheKey(query) {
  if (query.id) {
    return "threads:id:" + query.id;
  }

  let key = query.category
    ? "threads:category:" + query.category
    : "threads:all";
  const search = trimString(query.search);
  if (search) {
    key += ":search:" + search.toLowerCase();
  }
  return key;
}

function postThread(app, { baseUrl, secretKey, axios }) {
  app.get("/api/threads", (req, res) => {
    if (req.query.category && !ALLOWED_CATEGORIES.includes(req.query.category)) {
      return res.status(400).json({
        error: "Invalid category. Use Campus, Housing, or Co-ops.",
      });
    }

    const search = trimString(req.query.search);
    if (search.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        error: `Search must be ${MAX_SEARCH_LENGTH} characters or fewer`,
      });
    }

    const cacheKey = threadsCacheKey(req.query);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      console.log("Cache hit for " + cacheKey);
      return res.status(200).json(cached);
    }

    let url = `${baseUrl}/rest/v1/Threads?select=*`;

    if (req.query.id) {
      url += `&id=eq.${encodeURIComponent(req.query.id)}`;
    }

    if (req.query.category) {
      url += `&category=eq.${encodeURIComponent(req.query.category)}`;
    }

    if (search && !req.query.id) {
      url += `&${buildSearchFilter(search)}`;
    }

    console.log("Sending request to db(supabase) for threads");
    axios
      .get(url, {
        headers: supabaseHeaders(secretKey),
      })
      .then((response) => {
        if (req.query.id) {
          if (response.data.length === 0) {
            return res.status(404).json({ error: "Thread not found" });
          }
          const thread = response.data[0];
          cache.set(cacheKey, thread);
          return res.status(200).json(thread);
        }

        cache.set(cacheKey, response.data);
        res.status(200).json(response.data);
      })
      .catch((error) => {
        console.log(error.response?.data || error.message);
        res.status(500).json({
          error: "Failed to get threads from the database",
        });
      });
  });

  app.post("/api/threads", async (req, res) => {
    const url = `${baseUrl}/rest/v1/Threads`;
    const userId = req.body.userId;
    const title = trimString(req.body.title);
    const content = trimString(req.body.content);
    const category = trimString(req.body.category);

    if (!userId || !title || !content || !category) {
      return res.status(400).json({
        error: "User, title, content, and category are required",
      });
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: "Invalid category. Use Campus, Housing, or Co-ops.",
      });
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer`,
      });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        error: `Content must be ${MAX_CONTENT_LENGTH} characters or fewer`,
      });
    }

    try {
      const exists = await userExists(axios, baseUrl, secretKey, userId);
      if (!exists) {
        return res.status(400).json({
          error: "User not found",
        });
      }
    } catch (error) {
      console.log(error.response?.data || error.message);
      return res.status(500).json({
        error: "Failed to verify user",
      });
    }

    const thread = {
      userId: userId,
      title: title,
      content: content,
      category: category,
    };

    console.log("Sending new thread to db(supabase)");

    axios
      .post(url, thread, {
        headers: {
          ...supabaseHeaders(secretKey),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      })
      .then((response) => {
        cache.invalidatePrefix("threads:");
        return res.status(200).json({
          message: "Thread posted successfully",
          thread: response.data[0],
        });
      })
      .catch((error) => {
        console.log(error.response?.data || error.message);

        return res.status(500).json({
          error: "Failed to create thread",
        });
      });
  });

  app.get("/api/threads/:threadId/comments", (req, res) => {
    const threadId = req.params.threadId;
    const cacheKey = "comments:thread:" + threadId;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      console.log("Cache hit for " + cacheKey);
      return res.status(200).json(cached);
    }

    const url = `${baseUrl}/rest/v1/Comments?select=*&threadId=eq.${encodeURIComponent(threadId)}`;

    console.log("Sending request to db(supabase) for comments");
    axios
      .get(url, {
        headers: supabaseHeaders(secretKey),
      })
      .then((response) => {
        cache.set(cacheKey, response.data);
        res.status(200).json(response.data);
      })
      .catch((error) => {
        console.log(error.response?.data || error.message);
        res.status(500).json({
          error: "Failed to get comments from the database",
        });
      });
  });

  app.get("/api/comments", (req, res) => {
    const threadId = req.query.threadId;
    const userId = req.query.userId;

    if (!threadId && !userId) {
      return res.status(400).json({
        error: "threadId or userId is required",
      });
    }

    let cacheKey;
    if (threadId && userId) {
      cacheKey = "comments:thread:" + threadId + ":user:" + userId;
    } else if (threadId) {
      cacheKey = "comments:thread:" + threadId;
    } else {
      cacheKey = "comments:user:" + userId;
    }

    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      console.log("Cache hit for " + cacheKey);
      return res.status(200).json(cached);
    }

    let url = `${baseUrl}/rest/v1/Comments?select=*`;
    if (threadId) {
      url += `&threadId=eq.${encodeURIComponent(threadId)}`;
    }
    if (userId) {
      url += `&userId=eq.${encodeURIComponent(userId)}`;
    }

    console.log("Sending request to db(supabase) for comments");
    axios
      .get(url, {
        headers: supabaseHeaders(secretKey),
      })
      .then((response) => {
        cache.set(cacheKey, response.data);
        res.status(200).json(response.data);
      })
      .catch((error) => {
        console.log(error.response?.data || error.message);
        res.status(500).json({
          error: "Failed to get comments from the database",
        });
      });
  });

  app.post("/api/comments", async (req, res) => {
    const url = `${baseUrl}/rest/v1/Comments`;
    const userId = req.body.userId;
    const threadId = req.body.threadId;
    const content = trimString(req.body.content);

    if (!userId || !threadId || !content) {
      return res.status(400).json({
        error: "User, thread, and content are required",
      });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        error: `Content must be ${MAX_CONTENT_LENGTH} characters or fewer`,
      });
    }

    try {
      const exists = await userExists(axios, baseUrl, secretKey, userId);
      if (!exists) {
        return res.status(400).json({
          error: "User not found",
        });
      }
    } catch (error) {
      console.log(error.response?.data || error.message);
      return res.status(500).json({
        error: "Failed to verify user",
      });
    }

    try {
      const exists = await threadExists(axios, baseUrl, secretKey, threadId);
      if (!exists) {
        return res.status(400).json({
          error: "Thread not found",
        });
      }
    } catch (error) {
      console.log(error.response?.data || error.message);
      return res.status(500).json({
        error: "Failed to verify thread",
      });
    }

    let parentId = req.body.parentId;
    if (parentId === "" || parentId === undefined || parentId === null) {
      parentId = null;
    }

    if (parentId !== null) {
      try {
        const parent = await getCommentById(
          axios,
          baseUrl,
          secretKey,
          parentId
        );
        if (!parent) {
          return res.status(400).json({
            error: "Parent comment not found",
          });
        }
        if (String(parent.threadId) !== String(threadId)) {
          return res.status(400).json({
            error: "Parent comment is not on this thread",
          });
        }
      } catch (error) {
        console.log(error.response?.data || error.message);
        return res.status(500).json({
          error: "Failed to verify parent comment",
        });
      }
    }

    const comment = {
      userId: userId,
      threadId: threadId,
      content: content,
    };
    if (parentId !== null) {
      comment.parentCommentId = parentId;
    }

    console.log("Sending new comment to db(supabase)");

    axios
      .post(url, comment, {
        headers: {
          ...supabaseHeaders(secretKey),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      })
      .then((response) => {
        cache.del("comments:thread:" + threadId);
        cache.del("comments:user:" + userId);
        cache.invalidatePrefix("comments:thread:" + threadId + ":");
        return res.status(200).json({
          message: "Comment posted successfully",
          comment: response.data[0],
        });
      })
      .catch((error) => {
        console.log(error.response?.data || error.message);

        return res.status(500).json({
          error: "Failed to create comment",
        });
      });
  });
}

module.exports = postThread;
