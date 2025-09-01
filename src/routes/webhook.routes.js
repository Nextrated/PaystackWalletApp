import { Router } from "express";
import express from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { paystackWebhook } from "../controllers/webhook.controller.js";

const r = Router();

// IMPORTANT: raw body on this route before global json parser
r.post("/webhooks/paystack", express.raw({ type: "application/json" }), asyncHandler(paystackWebhook));

export default r;
