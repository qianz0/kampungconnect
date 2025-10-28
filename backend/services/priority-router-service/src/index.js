import express from "express";
import cors from "cors";
import pool from "./db.js";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        service: "priority-router-service", 
        status: "running",
        queueStatus: {
            urgent: queues.urgent.length,
            high: queues.high.length,
            medium: queues.medium.length,
            low: queues.low.length
        }
    });
});

// Priority queues
const queues = {
    urgent: [],
    high: [],
    medium: [],
    low: []
};

let isProcessing = false;

// Delay to slow down queue processing
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to process queues in order of urgency
async function processQueues() {
    if (isProcessing) {
        console.log("Queue processing already in progress...");
        return;
    }

    isProcessing = true;
    console.log("\nStarting queue processing cycle...");

    try {
        // Priority order: urgent, high, medium, low
        for (const level of ['urgent', 'high', 'medium', 'low']) {
            while (queues[level].length > 0) {
                const request = queues[level].shift();
                const { request_id, authHeader, urgency } = request;

                console.log(`\nProcessing ${level.toUpperCase()} request ${request_id}...`);

                try {
                    // Get available helpers
                    const availableHelpers = await axios.get(
                        `${process.env.MATCHING_SERVICE_URL}/helpers/available`,
                        {
                            headers: { Authorization: authHeader }
                        }
                    );

                    const helpers = availableHelpers.data;

                    if (!helpers || helpers.length === 0) {
                        console.warn(`No available helpers for request ${request_id}`);
                        
                        // Re-queue based on urgency
                        if (level === 'urgent') {
                            console.log(`URGENT: Re-queuing to front (retry in 3s)...`);
                            await delay(3000);
                            // Add to front of queue
                            queues[level].unshift(request); 
                        } else {
                            console.log(`Re-queuing to back of queue...`);
                            // Add to back
                            queues[level].push(request); 
                            await delay(1000);
                        }
                        continue;
                    }

                    // Select helper based on urgency
                    let assignedHelper;
                    
                    if (level === 'urgent') {
                        // URGENT: Best rated helper
                        assignedHelper = helpers.reduce((best, helper) => 
                            helper.rating > best.rating ? helper : best
                        );
                        console.log(`URGENT: Assigned BEST helper: ${assignedHelper.firstName} (rating: ${assignedHelper.rating})`);
                    } else if (level === 'high') {
                        // HIGH: Top 3
                        const top3 = helpers.slice(0, Math.min(3, helpers.length));
                        assignedHelper = top3[Math.floor(Math.random() * top3.length)];
                        console.log(`HIGH: Assigned from top 3: ${assignedHelper.firstName} (rating: ${assignedHelper.rating})`);
                    } else {
                        // MEDIUM/LOW: Random
                        assignedHelper = helpers[Math.floor(Math.random() * helpers.length)];
                        console.log(`${level.toUpperCase()}: Random helper: ${assignedHelper.firstName} (rating: ${assignedHelper.rating})`);
                    }

                    // Assign the helper
                    await axios.post(
                        `${process.env.MATCHING_SERVICE_URL}/matches/assign`,
                        {
                            request_id,
                            helper_id: assignedHelper.id
                        },
                        {
                            headers: { Authorization: authHeader }
                        }
                    );

                    console.log(`Match created: Request ${request_id} → Helper ${assignedHelper.id}`);
                } catch (err) {
                    console.error(`Error processing request ${request_id}:`, err.message);
                    
                    // Re-queue on error
                    console.log(`Re-queuing due to error...`);
                    queues[level].push(request);
                    await delay(2000);
                }
                // Delay between requests (urgent gets faster processing)
                await delay(level === 'urgent' ? 300 : 800);
            }
        }
        console.log("\nQueue processing cycle complete");
    } finally {
        isProcessing = false;
        
        // Check if more requests exist
        const totalRequests = Object.values(queues).reduce((sum, q) => sum + q.length, 0);
        if (totalRequests > 0) {
            console.log(`${totalRequests} requests still queued. Restarting...`);
            setTimeout(processQueues, 500);
        }
    }
}

// Route to receive new request from request service
app.post("/route", async (req, res) => {
    const { request_id, urgency } = req.body;

    if (!request_id || !urgency) {
        return res.status(400).json({ error: 'Missing request_id or urgency' });
    }

    if (!queues.hasOwnProperty(urgency)) {
        return res.status(400).json({ 
            error: 'Invalid urgency level. Must be: urgent, high, medium, or low' 
        });
    }

    // URGENT requests skip the queue
    if (urgency === 'urgent') {
        console.log(`\nURGENT request ${request_id} received - Processing IMMEDIATELY (bypassing queue)`);
        
        // Process urgent request
        processUrgentRequest({
            request_id,
            urgency,
            authHeader: req.headers.authorization,
            timestamp: new Date().toISOString()
        });

        return res.json({ 
            success: true, 
            message: `URGENT request ${request_id} is being processed immediately`,
            processingType: 'immediate',
            queueSkipped: true
        });
    }

    // HIGH, MEDIUM, LOW requests go into queue
    queues[urgency].push({ 
        request_id, 
        urgency,
        authHeader: req.headers.authorization,
        timestamp: new Date().toISOString()
    });

    console.log(`\nQueued ${urgency.toUpperCase()} request ${request_id}`);
    console.log(`Queue status:`, {
        urgent: queues.urgent.length,
        high: queues.high.length,
        medium: queues.medium.length,
        low: queues.low.length,
        total: Object.values(queues).reduce((sum, q) => sum + q.length, 0)
    });

    // Start processing if not running
    if (!isProcessing) {
        processQueues().catch(err => {
            console.error("Error in processQueues:", err);
        });
    }

    res.json({ 
        success: true, 
        message: `Request ${request_id} added to ${urgency} priority queue`,
        processingType: 'queued',
        queuePosition: queues[urgency].length,
        estimatedWaitTime: urgency === 'high' ? '1-2 minutes' :
                          urgency === 'medium' ? '3-5 minutes' :
                          '5-10 minutes'
    });
});

// Function to process URGENT case
async function processUrgentRequest(request) {
    const { request_id, authHeader } = request;

    try {
        console.log(`Processing URGENT request ${request_id} immediately...`);

        // Get available helpers
        const availableHelpers = await axios.get(
            `${process.env.MATCHING_SERVICE_URL}/helpers/available`,
            { headers: { Authorization: authHeader } }
        );

        const helpers = availableHelpers.data;

        if (!helpers || helpers.length === 0) {
            console.warn(`No helpers available for URGENT request ${request_id}`);
            console.log(`Adding to URGENT queue for retry...`);
            // Add to front of urgent queue
            queues.urgent.unshift(request); 
            
            // Trigger queue processing
            if (!isProcessing) {
                processQueues();
            }
            return;
        }

        // Get BEST helper for urgent request
        const bestHelper = helpers.reduce((best, helper) => 
            helper.rating > best.rating ? helper : best
        );

        console.log(`Assigning BEST helper: ${bestHelper.firstName} (rating: ${bestHelper.rating})`);

        // Create match
        await axios.post(
            `${process.env.MATCHING_SERVICE_URL}/matches/assign`,
            {
                request_id,
                helper_id: bestHelper.id
            },
            { headers: { Authorization: authHeader } }
        );

        console.log(`URGENT match created: Request ${request_id} → Helper ${bestHelper.id}`);

    } catch (err) {
        console.error(`Error processing URGENT request ${request_id}:`, err.message);
        console.log(`Adding to URGENT queue for retry...`);
        queues.urgent.unshift(request);
        
        if (!isProcessing) {
            setTimeout(() => processQueues(), 2000);
        }
    }
}

// GET queue status
app.get("/queue/status", (req, res) => {
    const status = {
        isProcessing,
        queues: {
            urgent: {
                count: queues.urgent.length,
                requests: queues.urgent.map(r => ({ 
                    id: r.request_id, 
                    timestamp: r.timestamp 
                }))
            },
            high: {
                count: queues.high.length,
                requests: queues.high.map(r => ({ 
                    id: r.request_id, 
                    timestamp: r.timestamp 
                }))
            },
            medium: {
                count: queues.medium.length,
                requests: queues.medium.map(r => ({ 
                    id: r.request_id, 
                    timestamp: r.timestamp 
                }))
            },
            low: {
                count: queues.low.length,
                requests: queues.low.map(r => ({ 
                    id: r.request_id, 
                    timestamp: r.timestamp 
                }))
            }
        },
        totalInQueue: Object.values(queues).reduce((sum, q) => sum + q.length, 0)
    };

    res.json(status);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Priority Router service running on port ${PORT}`);
});