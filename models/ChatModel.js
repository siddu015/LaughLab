const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        unique: true,  // Each message should have a unique ID
    },
    senderId: {
        type: String,
        required: true,
        ref: 'User',  // Reference to the User model (sender)
    },
    receiverId: {
        type: String,
        required: true,
        ref: 'User',  // Reference to the User model (receiver)
    },
    message: {
        type: String,
        required: true,  // Content of the message
    },
    timestamp: {
        type: Date,
        default: Date.now,  // Automatically set to current timestamp
    },
    readStatus: {
        type: Boolean,
        default: false,  // Initially set to false (message unread)
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'meme'],  // Types of messages
        default: 'text',  // Default message type is 'text'
    },
});

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
