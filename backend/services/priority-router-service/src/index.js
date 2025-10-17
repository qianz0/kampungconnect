import express from "express";
import cors from "cors";
import pool from "./db.js";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "priority-router-service", status: "running" });
});

// Assign helper based on priority
app.post("/route", async (req, res) => {
    try {
        // Get pending requests ordered by urgency
        const { rows: requests } = await pool.query(`
            SELECT * FROM requests 
            WHERE status = 'pending'
            ORDER BY 
                CASE urgency 
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END ASC,
                created_at ASC
            LIMIT 1;
        `);
        if (requests.length === 0) {
            return res.json({ message: "No pending requests found." });
        }
        const request = requests[0];

        // Find available helpers (random available helper and fairness)
        const { rows: helpers } = await pool.query(`
            SELECT u.id
            FROM users u
            LEFT JOIN matches m 
            ON u.id = m.helper_id AND m.status = 'active'
            WHERE u.role = 'helper' AND u.is_active = TRUE
            GROUP BY u.id
            ORDER BY COUNT(m.id) ASC, RANDOM()
            LIMIT 1;
        `);
        if (helpers.length === 0) {
            return res.status(503).json({ message: "No available helpers." });
        }
        const helperId = helpers[0].id;

        // Assign and call matching service
        await pool.query(`
            INSERT INTO matches (request_id, helper_id, status)
            VALUES ($1, $2, 'active')`,
            [request.id, helperId]
        );
        await axios.post("http://matching-service:5000/createMatch", {
            request_id: request.id,
            helper_id: helperId,
        });

        // Respond
        res.json({
            message: "Request assigned successfully.",
            request_id: request.id,
            helper_id: helperId,
            urgency: request.urgency,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Priority Router service running on port ${PORT}`);
});