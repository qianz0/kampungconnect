const express = require('express');
const { stat } = require('fs');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ service: "auth-service", status: "running" });
});

//sample endpoints
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    res.json({ message: "User registered", name, email });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    res.json({ message: "User logged in", email });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Auth service running on port ${PORT}`);
});