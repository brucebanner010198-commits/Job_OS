/**
 * Minimal Pipecat connect stub for dev. Returns a mock room URL.
 * Replace with a real Pipecat + SmallWebRTC runner for production OSS voice.
 */
import http from "http";

const PORT = Number(process.env.PORT ?? 8765);

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/connect") {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        roomUrl: `ws://localhost:${PORT}/mock-room`,
        token: "dev-token",
        echo: body.slice(0, 200),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`[pipecat-runner] stub listening on :${PORT}`);
});
