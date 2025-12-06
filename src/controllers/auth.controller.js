import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { config } from "../config/env.js";

export const me = async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  res.json({ user });
};

export const register = async (req, res) => {
  // exact validation/logic preserved
  if (!req.is("application/json")) {
    return res.status(415).json({
      status: false,
      error: "Unsupported Media Type. Please use 'application/json'.",
    });
  }

  const { firstName, lastName, email, phone, password } = req.body;

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
  if (typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({
      status: false,
      error: "Invalid input. 'email' must be a non-empty string.",
    });
  }
  const emailNormalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailNormalized)) {
    return res.status(400).json({ status: false, error: "Invalid email format." });
  }

  if (typeof phone !== "string" || phone.trim() === "") {
    return res.status(400).json({
      status: false,
      error: "Invalid input. 'phone' must be a non-empty string.",
    });
  }
  const phoneClean = phone.trim();
  if (!/^\d+$/.test(phoneClean)) {
    return res.status(400).json({ status: false, error: "Invalid phone. Only digits are allowed." });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      status: false,
      error: "Password must be at least 8 characters long.",
    });
  }

  const existing = await User.findOne({
    $or: [{ email: emailNormalized }, { phone: phoneClean }],
  }).lean();

  if (existing) {
    const which = existing.email === emailNormalized ? "Email" : "Phone";
    return res.status(409).json({ status: false, error: `${which} already registered.` });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: emailNormalized,
    phone: phoneClean,
    passwordHash,
    balance: 0,
  });

  const { _id, name: rName, email: rEmail, phone: rPhone, createdAt, balance: rBalance } = created;

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
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) return res.status(401).json({ error: "Invalid email or password." });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ error: "Invalid email or password." });

  const token = jwt.sign(
    { id: user._id, email: user.email },
    config.jwtSecret,
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
};

export const logout = async (req, res) => {
  req.user = null; // stateless JWT; client should drop token
  res.json({ message: "Logout successful" });
};
