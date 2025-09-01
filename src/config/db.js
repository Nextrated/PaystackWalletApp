import mongoose from "mongoose";
import { config } from "./env.js";

const MONGO_URI = `mongodb+srv://${encodeURIComponent(
  config.db.username
)}:${encodeURIComponent(config.db.password)}@${config.db.host}/${config.db.name
}?retryWrites=true&w=majority&appName=${config.db.name}`;

export async function connectToDb() {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(MONGO_URI, { dbName: config.db.name });
    console.log("MongoDB connected:", conn.connection.host);
  } catch (err) {
    console.error("MongoDB connection error!", err);
    process.exit(1);
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
