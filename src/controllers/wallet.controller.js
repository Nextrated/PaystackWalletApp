import { User } from "../models/User.js";
import { paystack } from "../services/paystack.service.js";

export const initPayment = async (req, res) => {
  try {
    const { amount } = req.body;

    // 1. Validate amount
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required"
      });
    }

    const amountNum = Number(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required and must be greater than 0"
      });
    }

    // 2. Get user ID safely (using the authenticated user's email)
    const user = await User.findOne({ email: req.user.email }).select("_id");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found. Please log in again."
      });
    }

    // 3. Prepare Paystack payload
    const payload = {
      email: req.user.email,
      amount: amountNum * 100, // Paystack API expects amounts in kobo (1 NGN = 100 kobo)
      currency: "NGN",
      metadata: {
        userId: user._id, 
      },
      channels: ["card", "bank", "bank_transfer", "apple_pay"]
    };

    // 4. Call Paystack
    const paystackResponse = await paystack.post("/transaction/initialize", payload);

    // 5. Return consistent success format
    return res.status(200).json({
      success: true,
      message: "Payment initialization successful",
      data: {
        reference: paystackResponse.data.data.reference,
        authorization_url: paystackResponse.data.data.authorization_url,
        access_code: paystackResponse.data.data.access_code,
      }
    });

  } catch (error) {
    console.error("Payment initialization error:", error);

    // Handle Paystack-specific errors nicely
    if (error.response?.data) {
      const paystackError = error.response.data;
      return res.status(error.response.status || 400).json({
        success: false,
        message: paystackError.message || "Payment initialization failed",
        error: {
          code: paystackError.status || "PAYSTACK_ERROR",
          details: paystackError.data?.message || paystackError.message
        }
      });
    }

    // Generic fallback
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while initializing payment",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};

export const withdraw = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  try {
    // 1. Basic check: amount must exist
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required"
      });
    }

    // 2. Convert amount to number **only for comparison and calculation**
    const amountNum = Number(amount);

    // 3. Validate it's a valid positive number
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid amount greater than 0"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const recipient = user.paystackRecipientCode;
    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: "No bank account linked. Please add a bank account first."
      });
    }

    const balance = user.balance || 0;

    // 4. Safe comparison
    if (balance < amountNum) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });
    }

    // 5. Prevent concurrent withdrawals using optimistic locking
    // This atomic operation will only succeed if isWithdrawing is currently false
   // If two withdrawal requests come in simultaneously, only one will acquire the lock
    const lockedUser = await User.findOneAndUpdate(
      { _id: userId, isWithdrawing: false },
      { $set: { isWithdrawing: true } },
      { new: true }
    );

    if (!lockedUser) {
      return res.status(409).json({
        success: false,
        message: "Withdrawal already in progress. Please try again shortly."
      });
    }

    let paystackResponse;

    try {
      // 6. Send to Paystack: convert to kobo (number * 100)
      paystackResponse = await paystack.post("/transfer", {
        source: "balance",
        amount: amountNum * 100,          // Paystack expects kobo
        recipient,
        reference: `withdrawal_${userId}_${Date.now()}`,
        reason: "User withdrawal",
      });
    } catch (transferError) {
      // Unlock on failure
      await User.findByIdAndUpdate(userId, { $set: { isWithdrawing: false } });

      console.error("Paystack transfer failed:", transferError?.response?.data || transferError);
      return res.status(502).json({
        success: false,
        message: "Transfer failed. Please try again."
      });
    }

    // Return consistent response format
    return res.json({
      success: true,
      message: "Withdrawal initiated successfully",
      data: paystackResponse.data.data
    });

  } catch (err) {
    console.error("Withdrawal error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


export const banks = async (_req, res) => {
  try {
    const response = await paystack.get("/bank/?country=nigeria");
    return res.status(200).json({
      success: true,
      message: "Banks retrieved successfully",
      data: response.data.data  // the actual array of banks
    });

  } catch (error) {
    console.error("Error fetching banks from Paystack:", error);

    if (error.response?.data) {
      // Paystack-specific error
      const paystackError = error.response.data;
      return res.status(error.response.status || 502).json({
        success: false,
        message: paystackError.message || "Failed to fetch banks",
        error: {
          code: paystackError.status || "PAYSTACK_ERROR",
          details: paystackError.data?.message || paystackError.message
        }
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching banks",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};

export const bankProviders = async (_req, res) => {
  try {
    const response = await paystack.get("/dedicated_account/available_providers");

    // Get the key mode from SECRET_KEY
    const { SECRET_KEY } = await import("../services/paystack.service.js");
    const keyMode = SECRET_KEY.startsWith("sk_live") ? "live" : "test";

    return res.status(200).json({
      success: true,
      message: "Dedicated account providers retrieved",
      data: response.data.data,
      keyMode,
    });

  } catch (error) {
    console.error("Error fetching dedicated account providers:", error);

    if (error.response?.data) {
      const paystackError = error.response.data;
      return res.status(error.response.status || 502).json({
        success: false,
        message: paystackError.message || "Failed to retrieve dedicated account providers",
        error: {
          code: paystackError.status || "PAYSTACK_ERROR",
          details: paystackError.data?.message || paystackError.message
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching dedicated account providers",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};

export const createDedicatedAccount = async (req, res) => {
  try {
    const { preferredBank = "test-bank" } = req.body || {};
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found"
      });
    }

    if (user.DVA_Number) {
      return res.status(409).json({
        success: false,
        message: "Dedicated virtual account already exists for this user",
        data: {
          dvaAccountNum: user.DVA_Number
        }
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

    // Paystack success → normalize response
    return res.status(201).json({
      success: true,
      message: "Dedicated virtual account created successfully",
      data: response.data.data 
    });

  } catch (error) {
    console.error("Error creating dedicated account:", error);

    if (error.response?.data) {
      const paystackError = error.response.data;
      return res.status(error.response.status || 502).json({
        success: false,
        message: paystackError.message || "Failed to create dedicated virtual account",
        error: {
          code: paystackError.status || "PAYSTACK_ERROR",
          details: paystackError.data?.message || paystackError.message
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating dedicated account",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};

export const verifyCardBin = async (req, res) => {
  try {
    const { bin } = req.params;

    // Basic validation for BIN (6 digits is standard)
    if (!bin || !/^\d{6}$/.test(bin)) {
      return res.status(400).json({
        success: false,
        message: "Valid 6-digit card BIN is required"
      });
    }

    const response = await paystack.get(`/decision/bin/${bin}`);

    // Normalize Paystack response to consistent format
    return res.status(200).json({
      success: true,
      message: "Card BIN verified successfully",
      data: response.data.data  
    });

  } catch (error) {
    console.error("Error verifying card BIN:", error);

    if (error.response?.data) {
      // Paystack-specific error
      const paystackError = error.response.data;
      return res.status(error.response.status || 400).json({
        success: false,
        message: paystackError.message || "Failed to verify card BIN",
        error: {
          code: paystackError.status || "PAYSTACK_ERROR",
          details: paystackError.data?.message || paystackError.message
        }
      });
    }

    // Generic fallback
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while verifying card BIN",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};
