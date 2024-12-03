const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User', // Reference to the User model (sender)
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User', // Reference to the User model (receiver)
    },
    message: {
        type: String,
        required: function () {
            return this.messageType === 'text'; // Required only for text messages
        },
    },
    mediaUrl: {
        type: String,
        required: function () {
            return this.messageType === 'image' || this.messageType === 'meme';
        },
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'meme'], // Supported message types
        default: 'text', // Default is text
    },
    timestamp: {
        type: Date,
        default: Date.now, // Automatically set to current timestamp
    },
    readStatus: {
        type: Boolean,
        default: false, // Initially unread
    },
});

const chatSchema = new mongoose.Schema({
    participants: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Chat participants (users)
            required: true,
        },
    ],
    messages: [messageSchema], // Array of message documents
    lastMessage: {
        type: String, // Preview of the last message
        default: '',
    },
    lastUpdated: {
        type: Date,
        default: Date.now, // Automatically update whenever a new message is sent
    },
    memeRecommendation: {
        type: Boolean,
        default: false, // Toggle for meme recommendations in chat
    },
});

// Middleware to update `lastUpdated` and `lastMessage` automatically
chatSchema.pre('save', function (next) {
    if (this.messages && this.messages.length > 0) {
        const lastMsg = this.messages[this.messages.length - 1];
        this.lastMessage = lastMsg.messageType === 'text' ? lastMsg.message : `Sent a ${lastMsg.messageType}`;
        this.lastUpdated = Date.now();
    }
    next();
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
