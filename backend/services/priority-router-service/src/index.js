import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "priority-router-service", status: "running" });
});

// Priority queues
const queues = {
  urgent: [],
  high: [],
  medium: [],
  low: []
};

// Delay to slow down queue processing
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to process queues in order of urgency
async function processQueues() {
  for (const level of ['urgent', 'high', 'medium', 'low']) {
    while (queues[level].length > 0) {
      const request = queues[level].shift();
      const { request_id, authHeader } = request;

      console.log(`Processing ${level.toUpperCase()} request ${request_id}...`);

      try {
        // Get available helpers from matching-service
        const availableHelpers = await axios.get(
          `${process.env.MATCHING_SERVICE_URL}/helpers/available`,
          {
            headers: {
              Authorization: authHeader
            }
          }
        );

        const helpers = availableHelpers.data;

        if (!helpers || helpers.length === 0) {
          console.warn(`No available helpers for request ${request_id}. Requeuing...`);
          // Put it back in queue
          queues[level].push(request); 
          // Delay 2 seconds before retry
          await delay(2000); 
          continue;
        }

        // Randomly pick a helper
        const assignedHelper = helpers[Math.floor(Math.random() * helpers.length)];

        // Assign the helper to the request
        await axios.post(
          `${process.env.MATCHING_SERVICE_URL}/matches/assign`,
          {
            request_id,
            helper_id: assignedHelper.id
          },
          {
            headers: {
              Authorization: authHeader
            }
          }
        );

        console.log(`Assigned helper ${assignedHelper.id} to request ${request_id}`);

      } catch (err) {
        console.error(`Error processing request ${request_id}: ${err.message}`);
      }

      // Small delay between assignments
      await delay(500);
    }
  }
}

// Route to receive new request from request service
app.post("/route", async (req, res) => {
    const { request_id, urgency } = req.body;

  if (!request_id || !urgency || !queues.hasOwnProperty(urgency)) {
    return res.status(400).json({ error: 'Invalid request_id or urgency' });
  }

  // Save request in the appropriate queue along with auth header
  queues[urgency].push({ request_id, authHeader: req.headers.authorization });

  console.log(`Queued request ${request_id} with urgency ${urgency}`);

  processQueues();

  res.json({ success: true, message: `Request ${request_id} queued with urgency ${urgency}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Priority Router service running on port ${PORT}`);
});