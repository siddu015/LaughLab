// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to allow CORS
app.use(cors());
app.use(express.json());

// Example API route
app.get('/api/data', (req, res) => {
    const data = { message: 'Hello from Express!' };
    res.json(data);
});

// Serve React app in production (after building)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
    });
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
