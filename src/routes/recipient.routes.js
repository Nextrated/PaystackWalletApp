import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createRecipient } from "../controllers/recipient.controller.js";

const r = Router();
r.post("/transfer-recipient", authMiddleware, asyncHandler(createRecipient));
export default r;
