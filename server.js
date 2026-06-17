const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 8081;
const BASE = ""; // change if served from a subpath

function rewriteHtml(html, targetBaseUrl) {
  // rewrite <a href="..."> to go through proxy
  let out = html;

  // rewrite absolute URLs in href/src/action attributes
  out = out.replace(
    /(href|src|action)=["'](\/\/[^"']+|https?:\/\/[^"']+)["']/gi,
    (match, attr, linkUrl) => {
      return attr + '="/p/' + encodeURIComponent(linkUrl.replace(/^\/\//, 'https://')) + '"';
    }
  );

  // rewrite protocol-relative URLs that start with //
  out = out.replace(
    /(href|src|action)=["'](\/\/[^"']+)["']/gi,
    (match, attr, linkUrl) => {
      return attr + '="/p/' + encodeURIComponent('https:' + linkUrl) + '"';
    }
  );

  // rewrite relative URLs that start with /
  out = out.replace(
    /(href|src|action)=["'](\/[^"']*)["']/gi,
    (match, attr, pathUrl) => {
      const abs = new URL(pathUrl, targetBaseUrl).href;
      return attr + '="/p/' + encodeURIComponent(abs) + '"';
    }
  );

  // rewrite relative URLs without leading /
  out = out.replace(
    /(href|src|action)=["']((?!\/|#|javascript:|data:|mailto:)[^"']+)["']/gi,
    (match, attr, relUrl) => {
      const abs = new URL(relUrl, targetBaseUrl).href;
      return attr + '="/p/' + encodeURIComponent(abs) + '"';
    }
  );

  return out;
}

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Class Portal</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; min-height: 100vh; }
    h1 { font-size: 2.5em; margin-bottom: 10px; }
    p { color: #aaa; margin-bottom: 30px; }
    input { width: 80%; max-width: 500px; padding: 15px 20px; font-size: 18px; border-radius: 30px; border: 2px solid #555; background: #1a1a2e; color: #fff; outline: none; }
    input:focus { border-color: #e94560; }
    button { padding: 15px 40px; font-size: 18px; border-radius: 30px; background: #e94560; color: #fff; border: none; cursor: pointer; margin-top: 15px; transition: background 0.2s; }
    button:hover { background: #c73e54; }
  </style>
</head>
<body>
  <h1>Class Portal</h1>
  <p>Enter any website URL below</p>
  <form onsubmit="event.preventDefault();go()">
    <input type="text" id="url" placeholder="e.g. snapchat.com" autofocus>
    <br><button type="submit">Go</button>
  </form>
  <script>
    function go(){var u=document.getElementById("url").value.trim();if(u){var h=u.startsWith("http")?u:"https://"+u;window.location.href="/p/"+encodeURIComponent(h)}}
  </script>
</body>
</html>`);
    return;
  }

  if (req.url.startsWith("/p/")) {
    const targetUrl = decodeURIComponent(req.url.slice(3));
    if (!targetUrl.startsWith("http")) {
      res.writeHead(400);
      res.end("Invalid URL");
      return;
    }

    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const port = parsed.port || (isHttps ? 443 : 80);

    const options = {
      hostname: parsed.hostname,
      port: port,
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers: { ...req.headers, host: parsed.hostname },
    };

    const proxyReq = lib.request(options, (proxyRes) => {
      const contentType = proxyRes.headers["content-type"] || "";
      const isHtml = contentType.includes("text/html");

      if (isHtml) {
        // buffer the response, rewrite URLs, then send
        let body = "";
        proxyRes.on("data", (chunk) => { body += chunk.toString("utf-8"); });
        proxyRes.on("end", () => {
          const rewritten = rewriteHtml(body, targetUrl);
          const headers = { ...proxyRes.headers };
          headers["content-length"] = Buffer.byteLength(rewritten);
          res.writeHead(proxyRes.statusCode, headers);
          res.end(rewritten);
        });
      } else {
        // non-html: pipe through as-is
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on("error", (err) => {
      res.writeHead(502);
      res.end("Proxy error: " + err.message);
    });

    req.pipe(proxyReq);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Proxy running on port " + PORT);
});
