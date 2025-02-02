const mongoose = require('mongoose');

const duyuruSchema = new mongoose.Schema({
    baslik: {
        type: String,
        required: [true, 'Duyuru başlığı zorunludur']
    },
    icerik: {
        type: String,
        required: [true, 'Duyuru içeriği zorunludur']
    },
    ekleyenAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Duyuruları tarihe göre sıralama (en yeniden en eskiye)
duyuruSchema.pre('find', function() {
    this.sort({ createdAt: -1 });
});

const Duyuru = mongoose.model('Duyuru', duyuruSchema);

module.exports = Duyuru; 