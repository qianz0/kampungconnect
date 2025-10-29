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

    // Declare the main priority queue + DLQ once
    await assertQueueWithDLQ(channel, "request_created", {
      "x-max-priority": 10, // <-- Priority support
    });

    await setupRetryQueue(channel);

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

// 👉 DLQ helper
async function assertQueueWithDLQ(ch, queueName, extraArgs = {}) {
  await ch.assertQueue(`${queueName}.dlq`, { durable: true });
  await ch.assertQueue(queueName, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": `${queueName}.dlq`,
      ...extraArgs, // <-- merge in custom arguments like x-max-priority
    },
  });
}

async function setupRetryQueue(ch) {
  await ch.assertQueue("request_retry", {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": "request_created",
      "x-message-ttl": 5000, // 5 seconds retry (for testing)
    },
  });
}

/**
 * Publish message with optional priority
 */
async function publishMessage(queueName, message, priority = 1) {
  try {
    if (!channel) await connectQueue();

    // Skip reasserting retry queue
    if (queueName !== "request_retry") {
      await assertQueueWithDLQ(channel, queueName, {
        "x-max-priority": 10,
      });
    }

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      priority, // 👈 Priority support
    });

    console.log(`📤 [matching-service] Sent message to queue: ${queueName} (priority=${priority})`);
  } catch (err) {
    console.error("❌ [matching-service] Failed to publish message:", err);
  }
}

/**
 * Consume messages normally — RabbitMQ auto-prioritizes delivery
 */
async function consumeQueue(queueName, callback) {
  onConnectedCallback = async (ch) => {
    await assertQueueWithDLQ(ch, queueName, { "x-max-priority": 10 });
    console.log(`👂 [matching-service] Listening on queue: ${queueName}`);

    ch.consume(
      queueName,
      async (msg) => {
        if (!msg) return;

        try {
          const data = JSON.parse(msg.content.toString());
          await callback(data);
          ch.ack(msg);
        } catch (err) {
          console.error("❌ Error handling message:", err);
          ch.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  };

  if (channel) {
    await onConnectedCallback(channel);
  } else {
    console.warn("⚠️ Channel not ready yet, will listen after connect.");
  }
}

module.exports = { connectQueue, publishMessage, consumeQueue };
