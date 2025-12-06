import express from "express";
import cors from "cors";

import webhookRoutes from "./routes/webhook.routes.js"; // mounted before JSON
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import recipientRoutes from "./routes/recipient.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import uiRoutes from "./ui.routes.js";


import { notFound, errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.use(cors());

// Serve static files from /public
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Map pretty URLs → specific HTML files
app.use(uiRoutes);


// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Webhook FIRST (raw body)
app.use(webhookRoutes);

// JSON parser for normal routes
app.use(express.json({ limit: "1mb" }));

// App routes
app.use(authRoutes);
app.use(userRoutes);
app.use(walletRoutes);
app.use(recipientRoutes);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);
