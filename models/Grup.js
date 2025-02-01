const mongoose = require('mongoose');

const grupSchema = new mongoose.Schema({
    isim: {
        type: String,
        required: true,
        unique: true
    },
    aciklama: {
        type: String
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
});

module.exports = mongoose.model('Grup', grupSchema); 