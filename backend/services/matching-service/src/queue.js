// src/queue.js
const amqp = require("amqplib");

let channel;
let connection;
let isConnecting = false;
let onConnectedCallback = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

/**
 * Connect to RabbitMQ (with automatic reconnects)
 */
async function connectQueue() {
  if (isConnecting || channel) return;
  isConnecting = true;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("✅ [matching-service] Connected to RabbitMQ");

    isConnecting = false;

    // re-register consumer if needed
    if (onConnectedCallback) {
      console.log("🔄 [matching-service] Re-registering consumer...");
      await onConnectedCallback(channel);
    }

    connection.on("close", () => {
      console.warn("⚠️ [matching-service] RabbitMQ connection closed. Reconnecting...");
      channel = null;
      isConnecting = false;
      setTimeout(connectQueue, 5000);
    });

    connection.on("error", (err) => {
      console.error("❌ [matching-service] RabbitMQ error:", err.message);
    });
  } catch (err) {
    console.error("❌ [matching-service] RabbitMQ connection failed:", err.message);
    channel = null;
    isConnecting = false;
    setTimeout(connectQueue, 5000);
  }
}

/**
 * Publish message to a queue
 */
async function publishMessage(queueName, message) {
  try {
    if (!channel) await connectQueue();
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    console.log(`📤 [matching-service] Sent message to queue: ${queueName}`);
  } catch (err) {
    console.error("❌ [matching-service] Failed to publish message:", err);
  }
}

/**
 * Consume messages from a queue
 */
async function consumeQueue(queueName, callback) {
  // this inner function is async, so awaits are legal
  onConnectedCallback = async (ch) => {
    await ch.assertQueue(queueName, { durable: true });
    console.log(`👂 [matching-service] Listening on queue: ${queueName}`);

    ch.consume(queueName, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        await callback(data);
        ch.ack(msg);
      } catch (err) {
        console.error("❌ [matching-service] Error handling message:", err);
      }
    });
  };

  if (channel) {
    await onConnectedCallback(channel);
  } else {
    console.warn("⚠️ [matching-service] Channel not ready yet, will listen after connect.");
  }
}

module.exports = { connectQueue, publishMessage, consumeQueue };
