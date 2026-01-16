const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema({
    ticketNumber: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: ['created', 'cancelled', 'winner_drawn'],
        required: true
    },
    email: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.action === 'cancelled';
        }
    },
    cancelledAt: {
        type: Date,
        required: function() {
            return this.action === 'cancelled';
        }
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    originalPurchaseDate: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Index pour faciliter les recherches
ticketLogSchema.index({ ticketNumber: 1, action: 1 });
ticketLogSchema.index({ email: 1 });
ticketLogSchema.index({ cancelledBy: 1 });
ticketLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TicketLog', ticketLogSchema);
