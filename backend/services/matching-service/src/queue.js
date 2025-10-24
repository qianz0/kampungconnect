// queue.js (for matching-service)
const amqp = require("amqplib");

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
    retryCount = 0; // Reset retry count on successful connection
    console.log("✅ [matching-service] Connected to RabbitMQ");

    connection.on("close", () => {
      console.warn("⚠️ [matching-service] RabbitMQ connection closed. Reconnecting...");
      channel = null;
      isConnecting = false;
      setTimeout(connectQueue, 5000);
    });

    connection.on("error", (err) => {
      console.error("❌ [matching-service] RabbitMQ connection error:", err);
    });
  } catch (err) {
    console.error(`❌ [matching-service] RabbitMQ connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err.message);
    isConnecting = false;
    retryCount++;
    
    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(5000, INITIAL_DELAY * Math.pow(1.5, retryCount - 1));
      console.log(`⏳ [matching-service] Retrying in ${delay}ms...`);
      setTimeout(connectQueue, delay);
    } else {
      console.error("❌ [matching-service] Max retries reached. Stopping retry attempts.");
    }
  }
}

async function publishMessage(queueName, message) {
  try {
    if (!channel) {
      console.warn("⚠️ [matching-service] No channel yet, retrying...");
      await connectQueue();
      if (!channel) {
        console.error("❌ [matching-service] Channel still not ready. Message dropped.");
        return;
      }
    }

    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    console.log(`📤 [matching-service] Sent message to queue: ${queueName}`);
  } catch (err) {
    console.error("❌ [matching-service] Failed to publish message:", err);
  }
}

async function consumeQueue(queueName, callback) {
  try {
    if (!channel) {
      console.warn("⚠️ [matching-service] No channel yet, retrying consume setup...");
      await connectQueue();
      if (!channel) {
        console.error("❌ [matching-service] Channel still not ready to consume.");
        return;
      }
    }

    await channel.assertQueue(queueName, { durable: true });
    console.log(`👂 [matching-service] Listening on queue: ${queueName}`);

    channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          await callback(data);
          channel.ack(msg);
        } catch (err) {
          console.error("❌ [matching-service] Error handling message:", err);
          // don't ack message so it can be retried
        }
      }
    });
  } catch (err) {
    console.error("❌ [matching-service] Failed to consume queue:", err);
  }
}

module.exports = { connectQueue, consumeQueue, publishMessage };
