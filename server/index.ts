console.log("========== SERVER STARTING ==========");
import dotenv from "dotenv";
dotenv.config({ override: true });
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";  // ← Add this import
import { registerRoutes } from "./routes";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

console.log("✓ Imports loaded");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Configure EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

console.log("✓ EJS configured");

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ============================================================================
// SESSION CONFIGURATION - Add this AFTER body parsing
// ============================================================================
app.set('trust proxy', 1); // Trust nginx proxy
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }
}));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

console.log("✓ Middleware configured");

(async () => {
  console.log("✓ Starting async initialization...");

  await registerRoutes(httpServer, app);

  console.log("✓ Routes registered");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  console.log("✓ Starting server on port", port);
  httpServer.listen(

    {
      port,
      host: "127.0.0.1",
    },

    () => {
      console.log(`serving on http://127.0.0.1:${port}`);
    },
  );
})();

console.log("========== SERVER STARTED ==========");
