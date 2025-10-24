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

async function publishMessage(queueName, message) {
  try {
    if (!channel) {
      console.warn("⚠️ [request-service] No channel yet, retrying...");
      await connectQueue(); // try to reconnect
      if (!channel) {
        console.error("❌ [request-service] Channel still not ready. Message dropped.");
        return;
      }
    }

    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    console.log(`📤 [request-service] Sent message to queue: ${queueName}`);
  } catch (err) {
    console.error("❌ [request-service] Failed to publish message:", err);
  }
}

module.exports = { connectQueue, publishMessage };
