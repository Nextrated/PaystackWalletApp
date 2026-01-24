import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { initPayment, withdraw, banks, bankProviders, createDedicatedAccount, verifyCardBin } from "../controllers/wallet.controller.js";

const r = Router();
r.post("/wallet/fund/init",                 authMiddleware, asyncHandler(initPayment));
r.post("/withdraw",                authMiddleware, asyncHandler(withdraw));
r.get("/banks",                    authMiddleware, asyncHandler(banks));
r.get("/bank-providers",           authMiddleware, asyncHandler(bankProviders));
r.post("/wallet/dva/create",authMiddleware, asyncHandler(createDedicatedAccount));
r.get("/verify-card-bin/:bin",     authMiddleware, asyncHandler(verifyCardBin));


export default r;
