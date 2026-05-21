const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const root = path.join(__dirname);
app.use(express.static(root));

app.get(["/openapi.json", "/api/openapi.json"], (req, res) => {
  res.sendFile(path.join(root, "appPackage", ".generated", "specs", "openapi.json"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
