import { User } from "../models/User.js";
import { paystack } from "../services/paystack.service.js";

const isDigits = (s) => typeof s === "string" && /^\d+$/.test(s);

export const createRecipient = async (req, res) => {
  let { bankCode, accountNumber, currency } = req.body;

  if (typeof bankCode !== "string" || !bankCode.trim()) {
    return res.status(400).json({ error: "bankCode is required." });
  }
  if (!isDigits(bankCode) || bankCode.length > 6) {
    return res.status(400).json({ error: "bankCode must be digits (<= 6 chars)." });
  }

  if (typeof accountNumber !== "string" || !accountNumber.trim()) {
    return res.status(400).json({ error: "accountNumber is required." });
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return res.status(400).json({ error: "accountNumber must be a 10-digit number." });
  }

  currency = typeof currency === "string" && currency.trim() ? currency : "NGN";

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.paystackRecipientCode) {
    return res.status(409).json({
      error: "Transfer recipient already exists for this user.",
      recipientCode: user.paystackRecipientCode,
    });
  }

  const payload = {
    type: "nuban",
    name: user.firstName + " " + user.lastName,
    bank_code: bankCode,
    account_number: accountNumber,
    currency,
    metadata: { userId: user._id },
  };

  const psResp = await paystack.post("/transferrecipient", payload, {
    headers: { "Content-Type": "application/json" },
  });

  const recipientCode = psResp?.data?.data?.recipient_code;
  if (recipientCode) {
    await User.findByIdAndUpdate(user._id, { $set: { paystackRecipientCode: recipientCode } });
  }

  return res.json(psResp.data);
};
