import axios from "axios";
import crypto from "crypto";
import { config } from "../config/env.js";

export const SECRET_KEY = config.paystackSecret;

export const paystack = axios.create({
  baseURL: "https://api.paystack.co",
  headers: { Authorization: `Bearer ${SECRET_KEY}` },
});

export function verifySignature(rawBody, signature) {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha512", SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return computed === signature;
}
