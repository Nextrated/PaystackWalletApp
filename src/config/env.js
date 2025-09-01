import dotenv from "dotenv";
dotenv.config();

const required = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env var: ${k}`);
  return v;
};

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 80,
  jwtSecret: required("JWT_SECRET"),
  paystackSecret: required("PAYSTACK_SECRET_KEY"),
  db: {
    username: required("DB_USERNAME"),
    password: required("DB_PASSWORD"),
    host: required("DB_HOST"),
    name: required("DB_NAME"),
  },
};
