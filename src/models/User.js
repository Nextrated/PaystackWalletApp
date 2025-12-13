import mongoose from "mongoose";

// Define the User schema
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
    DVA_bankName: { type: String, default: null },
    DVA_accountName: { type: String, default: null },
    isWithdrawing: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
