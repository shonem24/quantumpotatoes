function postThread(app, { baseUrl, secretKey, axios }) {
  app.get("/api/threads", (req, res) => {
    let url = `${baseUrl}/rest/v1/Threads?select=*`;

    if (req.query.id) {
      url += `&id=eq.${encodeURIComponent(req.query.id)}`;
    }

    if (req.query.category) {
      url += `&category=eq.${encodeURIComponent(req.query.category)}`;
    }

    console.log("Sending request to db(supabase) for threads");
    axios.get(url, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    }).then(response => {
      if (req.query.id) {
        if (response.data.length === 0) {
          return res.status(404).json({ error: "Thread not found" });
        }
        return res.status(200).json(response.data[0]);
      }

      res.status(200).json(response.data);
    }).catch(error => {
      console.log(error.response?.data || error.message);
      res.status(500).json({
        error: "Failed to get threads from the database",
      });
    });
  });

  app.post("/api/threads", async (req, res) => {
    let url = `${baseUrl}/rest/v1/Threads`;
  
    //check required thread information
    if (!req.body.userId || !req.body.title||
        !req.body.content || !req.body.category) {
      return res.status(400).json({
        error: "User, title, content, and category are required",
      });
    }
  
    const thread = {
      userId: req.body.userId,
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
    };
  
    console.log("Sending new thread to db(supabase)");
  
    axios.post(url, thread, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    }).then(response => {
  
      return res.status(200).json({
        message: "Thread posted successfully",
        thread: response.data[0],
      });
  
    }).catch(error => {
      console.log(error.response?.data || error.message);
  
      return res.status(500).json({
        error: "Failed to create thread",
      });
    });
  });

  app.get("/api/threads/:threadId/comments", (req, res) => {
    let url = `${baseUrl}/rest/v1/Comments?select=*&threadId=eq.${req.params.threadId}`;

    console.log("Sending request to db(supabase) for comments");
    axios.get(url, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    }).then(response => {
      res.status(200).json(response.data);
    }).catch(error => {
      console.log(error.response?.data || error.message);
      res.status(500).json({
        error: "Failed to get comments from the database",
      });
    });
  });

  app.get("/api/comments", (req, res) => {
    if (!req.query.threadId) {
      return res.status(400).json({
        error: "threadId is required",
      });
    }

    let url = `${baseUrl}/rest/v1/Comments?select=*&threadId=eq.${req.query.threadId}`;

    console.log("Sending request to db(supabase) for comments");
    axios.get(url, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    }).then(response => {
      res.status(200).json(response.data);
    }).catch(error => {
      console.log(error.response?.data || error.message);
      res.status(500).json({
        error: "Failed to get comments from the database",
      });
    });
  });

  app.post("/api/comments", async (req, res) => {
    let url = `${baseUrl}/rest/v1/Comments`;

    if (!req.body.userId || !req.body.threadId || !req.body.content) {
      return res.status(400).json({
        error: "User, thread, and content are required",
      });
    }

    const comment = {
      userId: req.body.userId,
      threadId: req.body.threadId,
      content: req.body.content,
    };

    console.log("Sending new comment to db(supabase)");

    axios.post(url, comment, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    }).then(response => {
      return res.status(200).json({
        message: "Comment posted successfully",
        comment: response.data[0],
      });
    }).catch(error => {
      console.log(error.response?.data || error.message);

      return res.status(500).json({
        error: "Failed to create comment",
      });
    });
  });
}

module.exports = postThread;