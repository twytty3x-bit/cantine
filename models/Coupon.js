const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['percentage', 'fixed'], // pourcentage ou montant fixe
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        min: 0
    },
    usageCount: {
        type: Number,
        default: 0
    },
    applicationType: {
        type: String,
        required: true,
        enum: ['all', 'product', 'category'],
        default: 'all'
    },
    applicableProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    applicableCategories: [{
        type: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Coupon', couponSchema); 