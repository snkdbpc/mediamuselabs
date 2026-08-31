const http = require('http');

const PORT_8501 = 8501;
const TARGET_PORT = 3000;

const server = http.createServer((req, res) => {
  const targetUrl = `http://localhost:${TARGET_PORT}${req.url}`;
  console.log(`[OAuth Bridge] Forwarding port ${PORT_8501} -> ${targetUrl}`);
  res.writeHead(302, { Location: targetUrl });
  res.end();
});

server.listen(PORT_8501, () => {
  console.log(`[OAuth Bridge] Active on http://localhost:${PORT_8501} -> forwarding to http://localhost:${TARGET_PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[OAuth Bridge] Port ${PORT_8501} already in use; skipping bridge creation.`);
  } else {
    console.error('[OAuth Bridge] Error:', err);
  }
});
