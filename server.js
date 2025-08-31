import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
dotenv.config();
const app = express();
app.use(cors());

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const MONGO_URI = `mongodb+srv://${encodeURIComponent(
  process.env.DB_USERNAME
)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}/${
  process.env.DB_NAME
}?retryWrites=true&w=majority&appName=${process.env.DB_NAME}`;

// Create a MongoClient to connect to the server
const connectToDb = async () => {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(MONGO_URI, {
      dbName: process.env.DB_NAME,
    });
    console.log("MongoDB connected:", conn.connection.host);
  } catch (error) {
    console.error("MongoDB connection error!", error);
    process.exit(1);
  }
};

export { connectToDb };

// User Schema + Model
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    balance: { type: Number, required: true, default: 0 },
    paystackRecipientCode: { type: String, default: null },
    DVA_Number: { type: String, default: null },
  },
  { timestamps: true }
);

// // transactions
// const TxSchema = new mongoose.Schema({
//   userId: { type: mongoose.Types.ObjectId, ref: "User", index: true, required: true },
//   direction: { type: String, enum: ["credit", "debit"], required: true },
//   type: { type: String, enum: ["fund","transfer","withdraw","refund","fee"], required: true },
//   status: { type: String, enum: ["pending","success","failed"], index: true, required: true },
//   amount: { type: Number, required: true },     // NGN (units), not kobo
//   currency: { type: String, default: "NGN" },
//   psReference: { type: String, unique: true, sparse: true }, // for idempotency
//   narration: String,
//   meta: mongoose.Schema.Types.Mixed,
// }, { timestamps: true });

// TxSchema.index({ userId: 1, createdAt: -1 });
// TxSchema.index({ psReference: 1 }, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);
// const Transaction = mongoose.model("Transaction", TxSchema);

// Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  res.json({ user });
});

// Webhooks
app.post(
  "/webhooks/paystack",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      // 1) Verify signature
      const signature = req.headers["x-paystack-signature"];
      if (!signature) return res.sendStatus(400);

      const computed = crypto
        .createHmac("sha512", SECRET_KEY)
        .update(req.body)
        .digest("hex");

      if (computed !== signature) {
        return res.sendStatus(401);
      }

      // 2) Parse the raw body AFTER verification
      const payload = JSON.parse(req.body.toString("utf8"));
      const { event, data } = payload;

      // Handle events
      if (event === "dedicatedaccount.assign.success") {
        res.sendStatus(200); // ack immediately

        // run async logic "fire and forget"
        (async () => {
          try {
            const userEmail = data?.customer?.email;
            const user = await User.findOne({ email: userEmail });
            if (!user) {
              console.warn("Webhook: user not found for", userEmail);
              return;
            }
            const dvaAccountNum = data?.dedicated_account?.account_number;
            await User.findByIdAndUpdate(user._id, {
              $set: { DVA_Number: dvaAccountNum },
            });
          } catch (err) {
            console.error("Webhook post-ack error:", err);
          }
        })();
      }

      if (event === "transfer.success") {
        console.log(" transfer.success:", JSON.stringify(data, null, 2));
        // Acknowledge immediately
        return res.sendStatus(200);
      }

      if (event === "charge.success") {
        console.log("💰 charge.success:", JSON.stringify(data, null, 2));

        // Acknowledge immediately
        res.sendStatus(200);

        // Run DB logic asynchronously
        (async () => {
          try {
            const userId = data?.metadata?.userId;
            const amountNgn = (data?.amount ?? 0) / 100;

            if (userId && Number.isFinite(amountNgn)) {
              // Increment balance
              await User.findByIdAndUpdate(
                userId,
                { $inc: { balance: amountNgn } },
                { new: true }
              );
            } else {
              // DVA path: match on receiver_account_number
              const receiverAcct = data?.metadata?.receiver_account_number;
              console.log("Receiver acct:", receiverAcct);
              const email = data?.customer?.email;

              const userByDVA = await User.findOne({ email }).select(
                "DVA_Number"
              );
              if (userByDVA && userByDVA.DVA_Number === receiverAcct) {
                await User.findByIdAndUpdate(
                  userByDVA._id,
                  { $inc: { balance: amountNgn } },
                  { new: true }
                );
              }
            }
          } catch (err) {
            console.error("Error processing charge.success webhook:", err);
          }
        })();
      }
    } catch (err) {
      console.error("Webhook error:", err);
      return res.sendStatus(500);
    }
  }
);

// Get Bank List
app.get("/banks", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.paystack.co/bank/?country=nigeria",
      {
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching bank list:", error);
    res.status(500).json({ error: "Failed to fetch bank list" });
  }
});

// Parse JSON for normal routes
app.use(express.json({ limit: "1mb" }));

// Login User
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email }, // payload
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});

// Logout User
app.post("/logout", authMiddleware, async (req, res) => {
  try {
    // Invalidate the user's session
    req.user = null;
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ error: "Failed to log out" });
  }
});

// Get User from Database
app.get("/user", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    res.json({ user: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// tiny validators
const isDigits = (s) => typeof s === "string" && /^\d+$/.test(s);

// Transfer Recipient
app.post("/transfer-recipient", authMiddleware, async (req, res) => {
  try {
    let { bankCode, accountNumber, currency } = req.body;

    // Basic validation (frontend supplies bankCode + accountNumber)
    if (typeof bankCode !== "string" || !bankCode.trim()) {
      return res.status(400).json({ error: "bankCode is required." });
    }
    if (!isDigits(bankCode) || bankCode.length > 6) {
      return res
        .status(400)
        .json({ error: "bankCode must be digits (<= 6 chars)." });
    }

    if (typeof accountNumber !== "string" || !accountNumber.trim()) {
      return res.status(400).json({ error: "accountNumber is required." });
    }
    // NG NUBAN is 10 digits
    if (!/^\d{10}$/.test(accountNumber)) {
      return res
        .status(400)
        .json({ error: "accountNumber must be a 10-digit number." });
    }

    currency =
      typeof currency === "string" && currency.trim() ? currency : "NGN";

    // Get user from token → DB
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.paystackRecipientCode) {
      return res.status(409).json({
        error: "Transfer recipient already exists for this user.",
        recipientCode: user.paystackRecipientCode,
      });
    }

    // Create transfer recipient on Paystack
    const payload = {
      type: "nuban",
      name: user.firstName + " " + user.lastName, // <- use logged-in user's name
      bank_code: bankCode,
      account_number: accountNumber,
      currency,
      metadata: { userId: user._id },
    };

    const psResp = await axios.post(
      "https://api.paystack.co/transferrecipient",
      payload,
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // save recipient_code to user for future transfers
    const recipientCode = psResp?.data?.data?.recipient_code;
    if (recipientCode) {
      await User.findByIdAndUpdate(user._id, {
        $set: { paystackRecipientCode: recipientCode },
      });
    }

    return res.json(psResp.data);
  } catch (error) {
    const msg = error?.response?.data || error.message;
    console.error("Error creating transfer recipient:", msg);
    // Bubble Paystack error when available
    return res
      .status(502)
      .json({ error: "Failed to create transfer recipient", detail: msg });
  }
});

// Register User
app.post("/register", async (req, res) => {
  try {
    // Ensure content type is JSON
    if (!req.is("application/json")) {
      return res.status(415).json({
        status: false,
        error: "Unsupported Media Type. Please use 'application/json'.",
      });
    }
    const { firstName, lastName, email, phone, password } = req.body;
    // Validate name
    if (typeof firstName !== "string" || firstName.trim() === "") {
      return res.status(400).json({
        status: false,
        error: "Invalid input. 'firstName' must be a non-empty string.",
      });
    }

    if (typeof lastName !== "string" || lastName.trim() === "") {
      return res.status(400).json({
        status: false,
        error: "Invalid input. 'lastName' must be a non-empty string.",
      });
    }

    // Validate email
    if (typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({
        status: false,
        error: "Invalid input. 'email' must be a non-empty string.",
      });
    }
    const emailNormalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({
        status: false,
        error: "Invalid email format.",
      });
    }

    // Validate phone (string of digits)
    if (typeof phone !== "string" || phone.trim() === "") {
      return res.status(400).json({
        status: false,
        error: "Invalid input. 'phone' must be a non-empty string.",
      });
    }
    const phoneClean = phone.trim();
    if (!/^\d+$/.test(phoneClean)) {
      return res.status(400).json({
        status: false,
        error: "Invalid phone. Only digits are allowed.",
      });
    }

    // Validate password (min 8 chars; add rules as needed)
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        status: false,
        error: "Password must be at least 8 characters long.",
      });
    }

    // Check if user already exists by email or phone
    const existing = await User.findOne({
      $or: [{ email: emailNormalized }, { phone: phoneClean }],
    }).lean();

    if (existing) {
      // Identify which field is duplicated
      const which = existing.email === emailNormalized ? "Email" : "Phone";
      return res.status(409).json({
        status: false,
        error: `${which} already registered.`,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const created = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: emailNormalized,
      phone: phoneClean,
      passwordHash,
      balance: 0,
    });

    // Shape response (omit passwordHash)
    const {
      _id,
      name: rName,
      email: rEmail,
      phone: rPhone,
      createdAt,
      balance: rBalance,
    } = created;

    return res.json({
      status: true,
      message: "User registered successfully",
      data: {
        id: _id,
        name: rName,
        email: rEmail,
        phone: rPhone,
        createdAt,
        balance: rBalance,
      },
    });
  } catch (error) {
    // Handle duplicate key race (in case of concurrent requests)
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "Field";
      return res.status(409).json({
        status: false,
        error: `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } already registered.`,
      });
    }

    console.error(error);
    return res.status(500).json({ status: false, error: "Error saving user" });
  }
});

app.post("/payment", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    const userId = await User.findOne({ email: req.user.email }).select("_id");
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: req.user.email,
        amount: amount * 100,
        currency: "NGN",
        metadata: {
          userId: userId._id,
        },
        channels: ["card", "bank", "bank_transfer", "apple_pay"],
      },
      { headers: { Authorization: `Bearer ${SECRET_KEY}` } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error initializing transaction:", error);
    res.status(500).json({ error: "Failed to initialize transaction" });
  }
});

// Withdraw funds
app.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const recipient = user.paystackRecipientCode;
    if (!recipient) {
      return res.status(400).json({ error: "No bank account linked. Please add a bank account first." });
    }

    const balance = user.balance || 0;

    // Check if user has sufficient balance
    if (balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Call Paystack API to initiate withdrawal
    const response = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        amount: amount * 100,
        recipient,
        reference: `withdrawal_${userId}_${Date.now()}`,
        reason: "User withdrawal",
      },
      { headers: { Authorization: `Bearer ${SECRET_KEY}` } }
    );

    // If Paystack accepted the request, reduce user balance
    if (response.data && response.data.status) {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { balance: -amount } }, // subtract amount from balance
        { new: true }
      );
    }

    res.json(response.data);
  } catch (error) {
    console.error("Error initializing withdrawal:", error?.response?.data || error.message);
    res.status(500).json({ error: "Failed to initialize withdrawal" });
  }
});

// Create dedicated virtual account
app.post("/create-dedicated-account", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.DVA_Number) {
      return res
        .status(409)
        .json({
          error: "Dedicated virtual account already exists for this user.",
          dvaAccountNum: user.DVA_Number,
        });
    }

    const preferredBank = req.body?.preferredBank || "test-bank"; // fallback

    const response = await axios.post(
      "https://api.paystack.co/dedicated_account/assign",
      {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        phone: user.phone,
        preferredBank,
        country: "NG",
      },
      { headers: { Authorization: `Bearer ${SECRET_KEY}` } }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error creating dedicated account:",
      error?.response?.data || error
    );
    res.status(500).json({ error: "Failed to create dedicated account" });
  }
});

// fetch bank providers
app.get("/bank-providers", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.paystack.co/dedicated_account/available_providers",
      {
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      }
    );

    const keyMode = SECRET_KEY.startsWith("sk_live") ? "live" : "test";

    res.json({
      status: true,
      message: "Dedicated account providers retrieved",
      data: response.data.data,
      keyMode,
    });
  } catch (err) {
    console.error("Error fetching bank providers:", err);
    res.status(500).json({ error: "Failed to fetch bank providers" });
  }
});

app.use(express.json());

const PORT = process.env.PORT || 80;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Webhook listener at http://localhost:${PORT}`);
});

connectToDb();
