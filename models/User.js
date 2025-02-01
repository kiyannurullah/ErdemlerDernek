const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    isim: {
        type: String,
        required: [true, 'İsim alanı zorunludur']
    },
    soyisim: {
        type: String,
        required: [true, 'Soyisim alanı zorunludur']
    },
    tcNo: {
        type: String,
        required: [true, 'TC Kimlik No alanı zorunludur'],
        unique: true,
        validate: {
            validator: function(v) {
                return /^[0-9]{11}$/.test(v);
            },
            message: 'Geçerli bir TC Kimlik No giriniz'
        }
    },
    email: {
        type: String,
        required: [true, 'E-posta alanı zorunludur'],
        unique: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: 'Geçerli bir e-posta adresi giriniz'
        }
    },
    aileLakabi: {
        type: String,
        required: [true, 'Aile lakabı alanı zorunludur']
    },
    sifre: {
        type: String,
        required: [true, 'Şifre alanı zorunludur'],
        minlength: [6, 'Şifre en az 6 karakter olmalıdır']
    },
    rol: {
        type: String,
        enum: ['aktif_uye', 'pasif_uye', 'admin', 'beklemede'],
        default: 'beklemede'
    },
    kayitTarihi: {
        type: Date,
        default: Date.now
    }
});

// Şifreyi hashleme
userSchema.pre('save', async function(next) {
    if (!this.isModified('sifre')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.sifre = await bcrypt.hash(this.sifre, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Şifre kontrolü için metod
userSchema.methods.sifreKontrol = async function(girilenSifre) {
    return await bcrypt.compare(girilenSifre, this.sifre);
};

module.exports = mongoose.model('User', userSchema); 