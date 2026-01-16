const mongoose = require('mongoose');

const smtpConfigSchema = new mongoose.Schema({
    host: {
        type: String,
        required: true,
        default: 'smtp.gmail.com'
    },
    port: {
        type: Number,
        required: true,
        default: 587
    },
    secure: {
        type: Boolean,
        default: false
    },
    user: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    from: {
        type: String,
        required: true
    },
    fromName: {
        type: String,
        default: 'Cantine'
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index unique pour s'assurer qu'il n'y a qu'une seule configuration active
smtpConfigSchema.index({ active: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.model('SMTPConfig', smtpConfigSchema);
