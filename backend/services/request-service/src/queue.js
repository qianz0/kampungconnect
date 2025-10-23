const amqp = require("amqplib");

let channel;
let isConnecting = false;

async function connectQueue() {
  if (isConnecting || channel) return;
  isConnecting = true;

  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672"
    );
    channel = await connection.createChannel();
    console.log("✅ [request-service] Connected to RabbitMQ");

    connection.on("close", () => {
      console.warn("⚠️ [request-service] RabbitMQ connection closed. Reconnecting...");
      channel = null;
      isConnecting = false;
      setTimeout(connectQueue, 5000);
    });
  } catch (err) {
    console.error("❌ [request-service] RabbitMQ connection error:", err);
    isConnecting = false;
    setTimeout(connectQueue, 5000); // retry every 5s
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
