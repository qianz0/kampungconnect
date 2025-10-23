// queue.js (for matching-service)
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
    console.log("✅ [matching-service] Connected to RabbitMQ");

    connection.on("close", () => {
      console.warn("⚠️ [matching-service] RabbitMQ connection closed. Reconnecting...");
      channel = null;
      isConnecting = false;
      setTimeout(connectQueue, 5000);
    });
  } catch (err) {
    console.error("❌ [matching-service] RabbitMQ connection error:", err);
    isConnecting = false;
    setTimeout(connectQueue, 5000); // retry every 5 seconds
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
