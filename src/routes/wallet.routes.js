import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { initPayment, withdraw, banks, bankProviders, createDedicatedAccount } from "../controllers/wallet.controller.js";

const r = Router();
r.post("/payment",                 authMiddleware, asyncHandler(initPayment));
r.post("/withdraw",                authMiddleware, asyncHandler(withdraw));
r.get("/banks",                    authMiddleware, asyncHandler(banks));
r.get("/bank-providers",           authMiddleware, asyncHandler(bankProviders));
r.post("/create-dedicated-account",authMiddleware, asyncHandler(createDedicatedAccount));

export default r;
