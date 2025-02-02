const mongoose = require('mongoose');

const etkinlikSchema = new mongoose.Schema({
    baslik: {
        type: String,
        required: [true, 'Etkinlik başlığı zorunludur']
    },
    aciklama: {
        type: String,
        required: [true, 'Etkinlik açıklaması zorunludur']
    },
    tarih: {
        type: Date,
        required: [true, 'Etkinlik tarihi zorunludur']
    },
    konum: {
        type: String,
        required: [true, 'Etkinlik konumu zorunludur']
    },
    gorsel: {
        data: Buffer,
        contentType: String,
        base64: String
    },
    ekleyenAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Etkinlikleri tarihe göre sıralama (yaklaşan etkinlikler önce)
etkinlikSchema.pre('find', function() {
    this.sort({ tarih: 1 });
});

// Geçmiş etkinlikleri otomatik olarak pasife alma
etkinlikSchema.pre('save', function(next) {
    if (this.tarih < new Date()) {
        this.durum = 'pasif';
    }
    next();
});

const Etkinlik = mongoose.model('Etkinlik', etkinlikSchema);

module.exports = Etkinlik; 