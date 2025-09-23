const express = require('express');
const { stat } = require('fs');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "notifcation-service", status: "running" });
});

//sample endpoints
app.post('/notify', (req, res) => {
    const { userId, message } = req.body;
    res.json({ message: "Notification sent", userId, message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Notification service running on port ${PORT}`);
});