const express = require('express');
const router = express.Router();
const { isAuthenticated, trackSession } = require('../middleware');
const User = require('../models/UserModel');
const ChatModel = require('../models/ChatModel');

router.use(trackSession);

router.get('/dashboard', isAuthenticated, async (req, res) => {
    const currentUser = req.user;

    const chatSessions = await ChatModel.find({
        participants: currentUser._id
    }).populate('participants', 'username');

    res.render('../views/index.ejs', { user: currentUser, chatSessions });
});

router.post('/create-chat', isAuthenticated, async (req, res) => {
    const { username } = req.body;
    const currentUser = req.user;

    if (username === currentUser.username) {
        return res.json({ success: false, message: "You cannot create a chat with yourself." });
    }

    const targetUser = await User.findOne({ username });
    if (!targetUser) {
        return res.json({ success: false, message: 'User not found.' });
    }

    const chatSession = new ChatModel({
        participants: [currentUser._id, targetUser._id],
        messages: []
    });
    await chatSession.save();

    res.redirect(`/chat/${chatSession._id}`);
});

router.get('/chat/:chatSessionId', isAuthenticated, async (req, res) => {
    const { chatSessionId } = req.params;
    const chatSession = await ChatModel.findById(chatSessionId).populate('participants');

    if (!chatSession) {
        return res.status(404).send('Chat session not found.');
    }

    if (!chatSession.participants.some(user => user._id.toString() === req.user._id.toString())) {
        return res.status(403).send('You are not authorized to view this chat.');
    }

    // Ensure 'user' is passed to the template
    res.render('chat', {
        chatSession,
        user: req.user // Always pass the 'user' object
    });
});

router.post('/send-message/:chatSessionId', isAuthenticated, async (req, res) => {
    const { chatSessionId } = req.params;
    const { message } = req.body;
    const currentUser = req.user;

    const chatSession = await ChatModel.findById(chatSessionId).populate('participants');
    if (!chatSession) {
        return res.status(404).send('Chat session not found.');
    }

    if (!chatSession.participants.some(user => user._id.toString() === currentUser._id.toString())) {
        return res.status(403).send('You are not authorized to send a message in this chat.');
    }

    const newMessage = {
        senderId: currentUser._id,
        receiverId: chatSession.participants.find(user => user._id.toString() !== currentUser._id.toString())._id,
        message: message,
        messageType: 'text'
    };

    chatSession.messages.push(newMessage);
    await chatSession.save();

    // Ensure 'user' is passed to the template when rendering after sending the message
    res.render('chat', {
        chatSession: chatSession,
        user: currentUser // Make sure user is passed to the template
    });
});

module.exports = router;
