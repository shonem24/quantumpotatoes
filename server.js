const express = require("express");
const path = require("path");
const axios = require("axios");
let apiFile = require("./env.json");

const app = express();
const PORT = process.env.PORT || 3000;
const hostname = "localhost";

app.use(express.json());
//pretty print the json response
app.set("json spaces", 2);

// the .env is in the shared project drive
let baseUrl = apiFile.SUPABASE_URL;
let secretKey = apiFile.SUPABASE_SECRET_KEY;

//get all users from the database 
app.get("/api/users", (req, res) => {
  let url = `${baseUrl}/rest/v1/Users?select=*`;

  console.log(`Sending request to db(supabase)`);
  axios.get(url, {
    //from superbase
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    }).then(response => {
      // console.log(response.data);
      res.status(200).json(response.data);
    
    }).catch(error => {
      console.log(error);
      res.status(500).json({
        error: "failed to get the data from the database",
      });
    });
});

//add a new user to the database and return the staus and the data of the user
app.post("/api/users", (req, res) => {
  let url = `${baseUrl}/rest/v1/Users`;

  console.log("Sending new user to db(supabase)");
  // console.log(req.body);

  axios.post(url, req.body, {
    //from superbase
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  }).then(response => {
    console.log(response.data);
    res.status(200).json(response.data);
  }).catch(error => {
    console.log(error);
    res.status(500).json({
      error: "Failed to add the user to the database",
    });
  });
});


app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Campus Connect running at http://localhost:${PORT}`);
});
