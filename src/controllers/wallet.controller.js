import { User } from "../models/User.js";
import { paystack } from "../services/paystack.service.js";

export const initPayment = async (req, res) => {
  const { amount } = req.body;
  const userId = await User.findOne({ email: req.user.email }).select("_id");
  const response = await paystack.post("/transaction/initialize", {
    email: req.user.email,
    amount: amount * 100,
    currency: "NGN",
    metadata: { userId: userId._id },
    channels: ["card", "bank", "bank_transfer", "apple_pay"],
  });
  res.json(response.data);
};

export const withdraw = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const recipient = user.paystackRecipientCode;
  if (!recipient) {
    return res.status(400).json({ error: "No bank account linked. Please add a bank account first." });
  }

  const balance = user.balance || 0;
  if (balance < amount) return res.status(400).json({ error: "Insufficient balance" });

  const response = await paystack.post("/transfer", {
    source: "balance",
    amount: amount * 100,
    recipient,
    reference: `withdrawal_${userId}_${Date.now()}`,
    reason: "User withdrawal",
  });

  if (response.data && response.data.status === "success") {
    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } }, { new: true });
  }

  res.json(response.data);
};

export const banks = async (_req, res) => {
  const response = await paystack.get("/bank/?country=nigeria");
  res.json(response.data);
};

export const bankProviders = async (_req, res) => {
  const response = await paystack.get("/dedicated_account/available_providers");
  const SECRET_KEY = (await import("../services/paystack.service.js")).SECRET_KEY;
  const keyMode = SECRET_KEY.startsWith("sk_live") ? "live" : "test";
  res.json({
    status: true,
    message: "Dedicated account providers retrieved",
    data: response.data.data,
    keyMode,
  });
};

export const createDedicatedAccount = async (req, res) => {
  const { preferredBank = "test-bank" } = req.body || {};
  const user = await (await import("../models/User.js")).User.findById(req.user.id);

  if (user.DVA_Number) {
    return res.status(409).json({
      error: "Dedicated virtual account already exists for this user.",
      dvaAccountNum: user.DVA_Number,
    });
  }

  const response = await paystack.post("/dedicated_account/assign", {
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    phone: user.phone,
    preferredBank,
    country: "NG",
  });

  res.json(response.data);
};

export const verifyCardBin = async (req, res) => {
  const { bin } = req.params;
  const response = await paystack.get(`/decision/bin/${bin}`);
  res.json(response.data);
};