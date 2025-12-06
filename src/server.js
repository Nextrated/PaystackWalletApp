import open from "open";
import { app } from "./app.js";
import { connectToDb, disconnectDb } from "./config/db.js";
import { config } from "./config/env.js";

const server = app.listen(config.port, "0.0.0.0", async () => {
  await connectToDb();
  const url = `http://localhost:${config.port}/`;
  console.log(`Server running at ${url}`);

  // Automatically open browser
  await open(url);
});

async function shutdown(sig) {
  console.log(`\n${sig} received. Closing server...`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}

["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => shutdown(sig)));
