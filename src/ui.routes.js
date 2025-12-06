// ui.routes.js
import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

// Helper to send a file by name in /public
const send = (res, name) => res.sendFile(path.join(PUBLIC_DIR, name));

// Nice, clean routes:
router.get("/",         (_req, res) => send(res, "login.html"));
router.get("/login",    (_req, res) => send(res, "login.html"));
router.get("/signup",   (_req, res) => send(res, "signup.html"));
router.get("/dashboard",(_req, res) => send(res, "dashboard.html"));
router.get("/fundwallet",(_req, res) => send(res, "fundwallet.html"));
router.get("/addbank",  (_req, res) => send(res, "addbank.html"));
router.get("/withdraw", (_req, res) => send(res, "withdraw.html"));

export default router;
