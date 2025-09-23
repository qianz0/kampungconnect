const express = require('express');
const { stat } = require('fs');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "request-service", status: "running" });
});

//sample endpoints
app.post('/postRequest', (req, res) => {
    const { userId, category, description, type } = req.body;
    res.json({ msessage: "Request posted", userId, category, description, type });
});

app.post('/panicRequest', (req, res) => {
    const { userId, description } = req.body;
    res.json({ message: "Panic request received", userId, description });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Request service running on port ${PORT}`);
});