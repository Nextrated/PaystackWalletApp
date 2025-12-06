export function notFound(_req, res) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err, _req, res, _next) {
  console.error("Unhandled error:", err?.response?.data || err);
  const status = err?.response?.status || err?.status || 500;
  const msg = err?.response?.data?.error || err?.message || "Server error";
  res.status(status).json({ error: msg });
}
