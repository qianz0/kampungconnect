let pool;
try {
  pool = new Pool({
    host: process.env.DB_HOST || "db",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "admin123",
    database: process.env.DB_NAME || "kampungconnect",
  });

  pool.on("connect", () => {
    console.log("Request-service connected to Postgres");
  });

  pool.on("error", (err) => {
    console.error("Unexpected DB error", err);
  });
} catch (err) {
  console.error("Failed to init DB pool:", err);
}

module.exports = pool;