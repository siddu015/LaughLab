const express = require('express');
const router = express.Router();
const { isAuthenticated, trackSession } = require('../middleware');

// Mock database of users
const users = [
    { username: 'john_doe', id: 1 },
    { username: 'jane_smith', id: 2 },
];

router.use(trackSession); // Logs session info for all routes

router.get('/dashboard', isAuthenticated, (req, res) => {
    res.render('../views/index.ejs');
});

router.post('/create-chat', isAuthenticated, (req, res) => {
    const { username } = req.body;

    const user = users.find(u => u.username === username);

    if (user) {
        return res.json({ success: true, chatSessionId: `session_${user.id}` });
    } else {
        return res.json({ success: false, message: 'No user found' });
    }
});

module.exports = router;
