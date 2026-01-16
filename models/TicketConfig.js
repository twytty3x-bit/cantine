const mongoose = require('mongoose');

const ticketConfigSchema = new mongoose.Schema({
    basePrice: {
        type: Number,
        required: true,
        min: 0,
        default: 0.50
    },
    quantityOffers: [{
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index unique pour s'assurer qu'il n'y a qu'une seule configuration active
ticketConfigSchema.index({ active: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.model('TicketConfig', ticketConfigSchema);
