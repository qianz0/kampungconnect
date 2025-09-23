const express = require('express');
const { stat } = require('fs');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "matching-service", status: "running" });
});

//sample endpoints
app.post('/match', (req, res) => {
    const { requestId, helperId } = req.body;
    res.json({ message: "Match request created", requestId, helperId });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Matching service running on port ${PORT}`);
});