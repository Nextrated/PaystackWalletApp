import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getUser } from "../controllers/user.controller.js";

const r = Router();
r.get("/user", authMiddleware, asyncHandler(getUser));
export default r;
