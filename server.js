const express = require("express");
const path = require("path");
const axios = require("axios");
let apiFile = require("./env.json");
const argon2 = require("argon2");
const postThread = require("./posts");
const cache = require("./cache");
const {
  generateVerificationCode,
  sendVerificationEmail,
} = require("./nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;
const hostname = "localhost";

app.use(express.json());
//pretty print the json response
app.set("json spaces", 2);

// the .env is in the shared project drive (Fly secrets override env.json)
let baseUrl = process.env.SUPABASE_URL || apiFile.SUPABASE_URL;
let secretKey = process.env.SUPABASE_SECRET_KEY || apiFile.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}


function stripPassword(user) {
  if (!user || typeof user !== "object") {
    return user;
  }
  const { password, ...safeUser } = user;
  return safeUser;
}

//get all users from the database 
app.get("/api/users", (req, res) => {
  const cacheKey = "users:all";
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    console.log("Cache hit for " + cacheKey);
    return res.status(200).json(cached);
  }

  let url = `${baseUrl}/rest/v1/Users?select=*`;

  console.log(`Sending request to db(supabase)`);
  axios.get(url, {
    //from superbase
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    }).then(response => {
      const users = Array.isArray(response.data)
        ? response.data.map(stripPassword)
        : response.data;
      cache.set(cacheKey, users);
      res.status(200).json(users);
    
    }).catch(error => {
      console.log(error);
      res.status(500).json({
        error: "failed to get the data from the database",
      });
    });
});




//add a new user to the database and return the staus and the data of the user
app.post("/api/users", async (req, res) => {
  let url = `${baseUrl}/rest/v1/Users`;

  if (req.body.email) {
    req.body.email = String(req.body.email).trim().toLowerCase();
  }

  //hash the password using argon2
  if (req.body.password) {
    req.body.password = await hashPassword(req.body.password);
  }
  else {
    return res.status(400).send({ error: "Password is required" });
  }

  console.log("Sending new user to db(supabase)");

  axios.post(url, req.body, {
    //from superbase
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  }).then(response => {
    const data = Array.isArray(response.data)
      ? response.data.map(stripPassword)
      : stripPassword(response.data);
    cache.invalidatePrefix("users:");
    res.status(200).json(data);
  }).catch(error => {
    console.log(error);
    res.status(500).json({
      error: "Failed to add the user to the database",
    });
  });
});


app.post("/api/users/login", async (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  //format the email for sending as url
  let email = encodeURIComponent(String(req.body.email).trim().toLowerCase());
  let url = `${baseUrl}/rest/v1/Users?select=*&email=eq.${email}`;

  //check if the email is in the database
  console.log("calling supabase to get the user");
  axios.get(url, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
  }).then(async response => {

    if (response.data.length === 0) {
      return res.status(404).json({ error: "Email not found" });
    }

    //supabase returns an array of objects, so we need to get the first object
    let user = response.data[0];

    let password = await argon2.verify(user.password, req.body.password);
    delete user.password;

    if (!password) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.status(200);
    return res.json({ message: "Login successful", user: user });
    
  }).catch(error => {
    console.log(error);
    return res.status(500).json({ error: "Failed to login" });
  });
});

postThread(app, { baseUrl, secretKey, axios });

// get a user's bio
app.get("/api/users/:id/bio", (req, res) => {
  let userId = req.params.id;
  let url = `${baseUrl}/rest/v1/Users?select=id,bio&id=eq.${encodeURIComponent(userId)}`;

  console.log("Getting bio from db(supabase)");
  axios.get(url, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
  }).then(response => {
    if (response.data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(response.data[0]);
  }).catch(error => {
    console.log(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to get bio" });
  });
});

// update a user's bio
app.post("/api/users/:id/bio", (req, res) => {
  let userId = req.params.id;

  if (req.body.bio === undefined) {
    return res.status(400).json({ error: "Bio is required" });
  }

  let bio = String(req.body.bio).trim();
  let url = `${baseUrl}/rest/v1/Users?id=eq.${encodeURIComponent(userId)}`;

  console.log("Updating bio in db(supabase)");
  axios.patch(url, { bio: bio }, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  }).then(response => {
    if (response.data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    cache.invalidatePrefix("users:");
    res.status(200).json(response.data);
  }).catch(error => {
    console.log(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to update bio" });
  });
});

app.post("/api/users/verify", async (req, res) => {
  if (!req.body.email) {
    return res.status(400).json({ error: "Email is required" });
  }

  let email = String(req.body.email).trim().toLowerCase();
  let url = `${baseUrl}/rest/v1/Users?email=eq.${encodeURIComponent(email)}`;

  axios.get(url, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
  }).then(async response => {

    if (response.data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    let code = generateVerificationCode();
    let hashedCode = await hashPassword(code);
    //using patch  instead of put to avoid overwriting other fields
    await axios.patch(url, {
      verificationCode: hashedCode,
    }, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    let sent = await sendVerificationEmail(email, code);

    if (!sent) {
      return res.status(500).json({
        error: "Failed to send verification email",
      });
    }

    return res.status(200).json({
      message: "Verification email sent",
    });

  }).catch(error => {
    console.log(error.response?.data || error.message);

    return res.status(500).json({
      error: "Failed to send verification email",
    });
  });
});

// confirm email verification: body { email, code }
app.post("/api/users/verify/confirm", async (req, res) => {
  if (!req.body.email || !req.body.code) {
    return res.status(400).json({ error: "Email and code are required" });
  }

  let email = String(req.body.email).trim().toLowerCase();
  let code = String(req.body.code).trim();
  let url = `${baseUrl}/rest/v1/Users?email=eq.${encodeURIComponent(email)}`;

  axios.get(url, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
  }).then(async response => {
    if (response.data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    let user = response.data[0];

    if (user.verified) {
      return res.status(200).json({ message: "Account already verified" });
    }

    if (!user.verificationCode) {
      return res.status(400).json({
        error: "No verification pending in db.",
      });
    }

    let match = await argon2.verify(user.verificationCode, code);
    if (!match) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await axios.patch(
      url,
      {
        verified: true,
        verificationCode: null,
      },
      {
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    cache.invalidatePrefix("users:");

    return res.status(200).json({ message: "Account verified" });
  }).catch(error => {
    console.log(error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to verify account" });
  });
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Campus Connect running at http://localhost:${PORT}`);
});
