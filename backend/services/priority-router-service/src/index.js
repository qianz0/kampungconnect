const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "priority-router-service", status: "running" });
});

//sample endpoints


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Priority Router service running on port ${PORT}`);
});