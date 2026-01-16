const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    costPrice: {
        type: Number,
        required: true,
        min: 0
    },
    barcode: {
        type: String
    },
    image: {
        type: String,
        default: '/uploads/products/default.jpg'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema); 