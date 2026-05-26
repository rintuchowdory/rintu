diff --git a/server.js b/server.js
index 70d44c9f2bf8ad451e4b33705892beecdd988e81..e0d00a2450c7b60eb32cb0090f06833791539675 100644
--- a/server.js
+++ b/server.js
@@ -1,20 +1,20 @@
 const express = require("express");
 const path = require("path");
 
 const app = express();
 const port = process.env.PORT || 3000;
 
 const root = path.join(__dirname);
 app.use(express.static(root));
 
 app.get(["/openapi.json", "/api/openapi.json"], (req, res) => {
   res.sendFile(path.join(root, "appPackage", ".generated", "specs", "openapi.json"));
 });
 
-app.get("*", (req, res) => {
+app.get("/*splat", (req, res) => {
   res.sendFile(path.join(root, "index.html"));
 });
 
 app.listen(port, () => {
   console.log(`Server started on port ${port}`);
 });
