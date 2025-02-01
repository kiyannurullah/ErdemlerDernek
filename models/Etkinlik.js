const mongoose = require('mongoose');

const etkinlikSchema = new mongoose.Schema({
    baslik: {
        type: String,
        required: [true, 'Başlık zorunludur'],
        trim: true
    },
    aciklama: {
        type: String,
        required: [true, 'Açıklama zorunludur']
    },
    tarih: {
        type: Date,
        required: [true, 'Tarih zorunludur']
    },
    saat: {
        type: String,
        required: [true, 'Saat zorunludur'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Geçerli bir saat giriniz (HH:MM)']
    },
    yer: {
        type: String,
        required: [true, 'Yer bilgisi zorunludur'],
        trim: true
    },
    gorsel: {
        type: String,
        required: false
    },
    durum: {
        type: String,
        enum: ['aktif', 'pasif'],
        default: 'aktif'
    },
    olusturanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    olusturmaTarihi: {
        type: Date,
        default: Date.now
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