import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { config } from "../config/env.js";


export const register = async (req, res) => {
  try {
    // Ensure Content-Type is application/json
    if (!req.is("application/json")) {
      return res.status(415).json({
        success: false,
        message: "Unsupported Media Type. Please use 'application/json'."
      });
    }

    const { firstName, lastName, email, phone, password } = req.body;

    if (typeof firstName !== "string" || firstName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Invalid input. 'firstName' must be a non-empty string."
      });
    }
    if (typeof lastName !== "string" || lastName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Invalid input. 'lastName' must be a non-empty string."
      });
    }

    
    if (typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Invalid input. 'email' must be a non-empty string."
      });
    }

    const emailNormalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format."
      });
    }

    if (typeof phone !== "string" || phone.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Invalid input. 'phone' must be a non-empty string."
      });
    }
    const phoneClean = phone.trim();
    if (!/^\d{11}$/.test(phoneClean)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone. Phone number must be 11 digits."
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long."
      });
    }

    const existing = await User.findOne({
      $or: [{ email: emailNormalized }, { phone: phoneClean }],
    }).lean();

    if (existing) {
      const which = existing.email === emailNormalized ? "Email" : "Phone";
      return res.status(409).json({
        success: false,
        message: `${which} already registered.`
      });
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

    const { _id, firstName: rFirstName, lastName: rLastName, email: rEmail, phone: rPhone, createdAt, balance: rBalance } = created;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: _id,
        name: `${rFirstName} ${rLastName}`,  // full name
        email: rEmail,
        phone: rPhone,
        createdAt,
        balance: rBalance,
      }
    });

  } catch (error) {
    console.error("Registration error:", error);

    // Generic server error fallback (e.g. DB failure, bcrypt error, etc.)
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred during registration",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        }
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred during login",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};

export const logout = async (req, res) => {
  try {
    // Stateless JWT → no server-side session to destroy
    // We just nullify req.user for this request (mostly for middleware consistency)
    req.user = null;

    // Client should discard the JWT token from storage/localStorage/cookies

    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred during logout",
      error: {
        code: "SERVER_ERROR"
      }
    });
  }
};
