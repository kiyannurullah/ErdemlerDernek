const mongoose = require('mongoose');

const aidatSchema = new mongoose.Schema({
    uye: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ay: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    yil: {
        type: Number,
        required: true
    },
    tutar: {
        type: Number,
        required: true,
        min: 0
    },
    durum: {
        type: String,
        enum: ['Ödendi', 'Ödenmedi'],
        default: 'Ödenmedi'
    },
    odemeTarihi: {
        type: Date
    },
    ekleyenAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    aciklama: {
        type: String
    }
}, {
    timestamps: true
});

// Aynı ay ve yıl için mükerrer kayıt olmaması için index
aidatSchema.index({ uye: 1, yil: 1, ay: 1 }, { unique: true });

module.exports = mongoose.model('Aidat', aidatSchema); 