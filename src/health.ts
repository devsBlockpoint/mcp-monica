import { createServer } from "node:http";

export function startHealthServer(port: number): { stop: () => void } {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
  });
  server.listen(port);
  return {
    stop() {
      server.close();
    },
  };
}
