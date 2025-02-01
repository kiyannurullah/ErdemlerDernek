const mongoose = require('mongoose');

const grupSchema = new mongoose.Schema({
    isim: {
        type: String,
        required: [true, 'Grup adı zorunludur'],
        unique: true
    },
    aciklama: {
        type: String,
        required: [true, 'Grup açıklaması zorunludur']
    },
    uyeler: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    olusturanAdmin: {
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

module.exports = mongoose.model('Grup', grupSchema); 