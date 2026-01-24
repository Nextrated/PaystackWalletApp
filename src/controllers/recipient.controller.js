import { User } from "../models/User.js";
import { paystack } from "../services/paystack.service.js";

const isDigits = (s) => typeof s === "string" && /^\d+$/.test(s);

export const createRecipient = async (req, res) => {
  try {
    let { bankCode, accountNumber, currency } = req.body;

    if (typeof bankCode !== "string" || !bankCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "bankCode is required."
      });
    }
    if (!isDigits(bankCode) || bankCode.length > 6) {
      return res.status(400).json({
        success: false,
        message: "bankCode must be digits (<= 6 chars)."
      });
    }

    if (typeof accountNumber !== "string" || !accountNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "accountNumber is required."
      });
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: "accountNumber must be a 10-digit number."
      });
    }

    currency = typeof currency === "string" && currency.trim() ? currency : "NGN";

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.paystackRecipientCode) {
      return res.status(409).json({
        success: false,
        message: "Transfer recipient already exists for this user.",
        data: {
          recipientCode: user.paystackRecipientCode
        }
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
      await User.findByIdAndUpdate(user._id, {
        $set: { paystackRecipientCode: recipientCode }
      });
    }

    // Success response
    return res.status(201).json({
      success: true,
      message: "Transfer recipient created successfully",
      data: psResp.data.data  // usually contains recipient_code, details, etc.
    });

  } catch (error) {
    console.error("Error creating transfer recipient:", error);

    if (error.response?.data) {
      const paystackError = error.response.data;
      return res.status(error.response.status || 400).json({
        success: false,
        message: paystackError.message || "Failed to create transfer recipient",
        error: {
          code: paystackError.status || "PAYSTACK_ERROR",
          details: paystackError.data?.message || paystackError.message
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating transfer recipient",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};