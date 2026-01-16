const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        cost: {
            type: Number,
            required: true,
            min: 0
        },
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        finalPrice: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    date: {
        type: Date,
        default: Date.now
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    originalTotal: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    coupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    profit: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['cash', 'card']
    },
    amountReceived: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Sale', saleSchema); 