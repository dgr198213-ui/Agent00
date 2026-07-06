import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { deploymentService } from "../application/deployment-service";

/**
 * Endpoint REST público para invocar agentes publicados.
 *   POST /api/v1/agents/invoke
 *   Authorization: Bearer <apiKey>
 *   Body: { "message": "..." }
 */
function registerAgentInvokeRoute(app: express.Express) {
  app.post("/api/v1/agents/invoke", async (req, res) => {
    try {
      const auth = String(req.headers.authorization ?? "");
      const apiKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

      if (!apiKey) return res.status(401).json({ error: "Falta la cabecera Authorization: Bearer <apiKey>" });
      if (!message) return res.status(400).json({ error: "El cuerpo debe incluir un campo message" });
      if (message.length > 20_000) return res.status(400).json({ error: "message demasiado largo" });

      const result = await deploymentService.invokeViaApiKey(apiKey, message);
      return res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error inesperado";
      const status = /API key/.test(msg) ? 401 : /no disponible/.test(msg) ? 404 : 500;
      return res.status(status).json({ error: msg });
    }
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // API pública de agentes desplegados (deployments tipo api/widget/webhook)
  registerAgentInvokeRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
