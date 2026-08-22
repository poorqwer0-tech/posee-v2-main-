const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4000;
const ROOT = path.join(__dirname, ".."); // product-stock root

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";

  const filePath = path.join(ROOT, url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/html" });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("Stock app running at http://localhost:" + PORT);
});
