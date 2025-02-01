const mongoose = require('mongoose');

const duyuruSchema = new mongoose.Schema({
    baslik: {
        type: String,
        required: [true, 'Başlık zorunludur'],
        trim: true
    },
    icerik: {
        type: String,
        required: [true, 'İçerik zorunludur']
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
    onemDurumu: {
        type: String,
        enum: ['normal', 'onemli', 'acil'],
        default: 'normal'
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

// Duyuruları tarihe göre sıralama (en yeniden en eskiye)
duyuruSchema.pre('find', function() {
    this.sort({ olusturmaTarihi: -1 });
});

const Duyuru = mongoose.model('Duyuru', duyuruSchema);

module.exports = Duyuru; 