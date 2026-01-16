const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    isWinner: {
        type: Boolean,
        default: false
    },
    winnerDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card'],
        default: 'cash'
    },
    status: {
        type: String,
        enum: ['active', 'used', 'expired', 'cancelled'],
        default: 'active'
    },
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancellationReason: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index pour faciliter les recherches
ticketSchema.index({ email: 1, purchaseDate: -1 });
ticketSchema.index({ isWinner: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
