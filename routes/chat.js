const express = require('express');
const router = express.Router();
const { isAuthenticated, trackSession } = require('../middleware');
const User = require('../models/UserModel');
const ChatModel = require('../models/ChatModel');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');

router.use(trackSession);

router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const currentUser = req.user;
        console.log(`Dashboard accessed by user: ${currentUser.username} (ID: ${currentUser._id})`);

        const chatSessions = await ChatModel.find({
            participants: currentUser._id
        }).populate('participants', 'username');

        console.log(`Found ${chatSessions.length} chat sessions for user ${currentUser.username}`);

        res.render('../views/index.ejs', { user: currentUser, chatSessions });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Error loading dashboard. Please try again.');
    }
});

router.post('/create-chat', isAuthenticated, async (req, res) => {
    try {
        const { username } = req.body;
        const currentUser = req.user;

        // Validate input
        if (!username || username.trim() === '') {
            return res.status(400).json({ success: false, message: 'Username is required.' });
        }

        // Check if user is trying to chat with themselves
        if (username.trim() === currentUser.username) {
            return res.status(400).json({ success: false, message: "You cannot create a chat with yourself." });
        }

        // Find the target user
        const targetUser = await User.findOne({ username: username.trim() });
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found. Please check the username and try again.' });
        }

        // Check if a chat session already exists between these users
        const existingChat = await ChatModel.findOne({
            participants: { $all: [currentUser._id, targetUser._id] }
        });

        if (existingChat) {
            // Chat already exists, redirect to existing chat
            console.log(`Redirecting to existing chat: ${existingChat._id}`);
            return res.redirect(`/chat/${existingChat._id}`);
        }

        // Create new chat session
        const chatSession = new ChatModel({
            participants: [currentUser._id, targetUser._id],
            messages: []
        });
        
        await chatSession.save();
        console.log(`New chat created: ${chatSession._id} between ${currentUser.username} and ${targetUser.username}`);

        res.redirect(`/chat/${chatSession._id}`);
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({ success: false, message: 'An error occurred while creating the chat. Please try again.' });
    }
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
    const { message, messageType = 'text' } = req.body; // Default to text messages
    const currentUser = req.user;

    try {
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
            message: messageType === 'text' ? message : undefined,
            mediaUrl: messageType === 'meme' ? message : undefined, // Store meme URL if messageType is 'meme'
            messageType: messageType, // Store the type of the message
        };

        // Push the new message to the chat session's messages array
        chatSession.messages.push(newMessage);

        // Save the updated chat session
        await chatSession.save();

        // Respond with success and the updated messages
        res.status(200).json({ message: 'Message sent successfully.', chatSession });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Error sending message.');
    }
});

router.post('/recommend-meme/:chatSessionId', async (req, res) => {
    const { chatSessionId } = req.params;
    const { currentMessage } = req.body;

    console.log('Chat Session ID:', chatSessionId);
    console.log('Current Message:', currentMessage);

    if (!mongoose.Types.ObjectId.isValid(chatSessionId)) {
        return res.status(400).json({ error: 'Invalid chat session ID' });
    }

    try {
        // Validate the chat session exists
        const chatSession = await ChatModel.findById(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({ error: 'Chat session not found' });
        }

        // Use Reddit search API with the current message as the query
        const REDDIT_SEARCH_URL = `https://www.reddit.com/r/memes/search.json?q=${encodeURIComponent(currentMessage)}&restrict_sr=1&sort=relevance`;
        const headers = { "User-Agent": "MemeFetcher/0.1" };

        const response = await axios.get(REDDIT_SEARCH_URL, { headers });

        if (response.status === 200) {
            const children = response.data.data.children;

            // Extract up to 5 valid image URLs
            const memeUrls = children
                .filter(post => post.data.post_hint === 'image') // Only image posts
                .map(post => post.data.url) // Extract URLs
                .slice(0, 5); // Limit to 5 memes

            if (memeUrls.length === 0) {
                return res.status(404).json({ error: 'No memes found for your message' });
            }

            console.log(memeUrls);
            // Return the array of meme URLs
            return res.json({ memeUrls });
        } else {
            console.error(`Error fetching memes: ${response.status}`);
            return res.status(500).json({ error: 'Error fetching memes' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
