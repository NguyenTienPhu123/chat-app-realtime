const Redis = require("ioredis");

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

redisClient.on("connect", () => console.log("✓ Redis connected"));
redisClient.on("error", (err) => console.error("✗ Redis error:", err.message));

module.exports = redisClient;
