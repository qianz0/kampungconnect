const amqp = require("amqplib");
const client = require('prom-client');

let channel;
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 20;
const INITIAL_DELAY = 2000; // 2 seconds initial delay

async function connectQueue() {
  if (isConnecting || channel) return;
  isConnecting = true;

  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672"
    );
    channel = await connection.createChannel();
    retryCount = 0;
    console.log("✅ [request-service] Connected to RabbitMQ");

    connection.on("close", () => {
      console.warn("⚠️ [request-service] RabbitMQ connection closed. Reconnecting...");
      channel = null;
      isConnecting = false;
      setTimeout(connectQueue, 5000);
    });

    connection.on("error", (err) => {
      console.error("❌ [request-service] RabbitMQ connection error:", err);
    });
  } catch (err) {
    console.error(`❌ [request-service] RabbitMQ connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err.message);
    isConnecting = false;
    retryCount++;

    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(5000, INITIAL_DELAY * Math.pow(1.5, retryCount - 1));
      console.log(`⏳ [request-service] Retrying in ${delay}ms...`);
      setTimeout(connectQueue, delay);
    } else {
      console.error("❌ [request-service] Max retries reached. Stopping retry attempts.");
    }
  }
}

// 🧩 DLQ + priority helper
async function assertQueueWithDLQ(ch, queueName, extraArgs = {}) {
  await ch.assertQueue(`${queueName}.dlq`, { durable: true });
  await ch.assertQueue(queueName, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": `${queueName}.dlq`,
      "x-max-priority": 10, // 👈 add priority support here
      ...extraArgs,
    },
  });
}

// 📨 Publish messages with priority based on urgency
async function publishMessage(queueName, message) {
  try {
    if (!channel) {
      console.warn("⚠️ [request-service] No channel yet, retrying...");
      await connectQueue();
      if (!channel) {
        console.error("❌ [request-service] Channel still not ready. Message dropped.");
        return;
      }
    }

    await assertQueueWithDLQ(channel, queueName);

    // Map urgency → priority
    const priorityMap = { low: 1, medium: 3, high: 6, urgent: 9 };
    const urgency = message.urgency?.toLowerCase() || "low";
    const priority = priorityMap[urgency] || 1;

    const payload = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(queueName, payload, {
      persistent: true,
      priority, //  here
    });

    console.log(`📤 [request-service] Sent message to queue: ${queueName} (priority=${priority})`);
  } catch (err) {
    console.error("❌ [request-service] Failed to publish message:", err);
  }
}

function getChannel() {
  return channel;
}

module.exports = { connectQueue, getChannel, publishMessage };
