const mongoose = require('mongoose');

const aniSchema = new mongoose.Schema({
    baslik: {
        type: String,
        required: [true, 'Başlık alanı zorunludur']
    },
    icerik: {
        type: String,
        required: [true, 'İçerik alanı zorunludur']
    },
    gorsel: {
        type: String, // Görsel URL'i
        required: false
    },
    paylasanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    onayDurumu: {
        type: String,
        enum: ['beklemede', 'onaylandi', 'reddedildi'],
        default: 'beklemede'
    },
    goruntulemeSayisi: {
        type: Number,
        default: 0
    },
    paylasimTarihi: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Ani', aniSchema); 