import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.js";
import { login, register, logout} from "../controllers/auth.controller.js";

const r = Router();

r.post("/register", asyncHandler(register));
r.post("/login",    asyncHandler(login));
r.post("/logout",   authMiddleware, asyncHandler(logout));

export default r;
