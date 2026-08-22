const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4000;
const ROOT = path.join(__dirname, ".."); // product-stock root
const API_TARGET = "http://localhost:3001";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let url = req.url.split("?")[0];

  // proxy API requests to POS server
  if (url === "/api/stock-app" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const proxyReq = http.request(
        API_TARGET + "/api/stock-app",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          proxyRes.pipe(res);
        }
      );
      proxyReq.on("error", (err) => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "POS server ไม่พร้อม: " + err.message }));
      });
      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // static files
  if (url === "/") url = "/index.html";
  const filePath = path.join(ROOT, url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "text/html",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("Stock app running at http://localhost:" + PORT);
  console.log("API proxy -> " + API_TARGET + "/api/stock-app");
});
