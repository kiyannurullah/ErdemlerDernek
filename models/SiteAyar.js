const mongoose = require('mongoose');

const siteAyarSchema = new mongoose.Schema({
    siteBaslik: {
        type: String,
        required: [true, 'Site başlığı zorunludur'],
        default: 'Erdemler Köyü'
    },
    siteAciklama: {
        type: String,
        default: 'Erdemler Köyü Resmi Web Sitesi'
    },
    iletisimEmail: {
        type: String,
        required: [true, 'İletişim e-postası zorunludur']
    },
    iletisimTelefon: {
        type: String
    },
    adres: {
        type: String
    },
    sosyalMedya: {
        facebook: String,
        twitter: String,
        instagram: String,
        youtube: String
    },
    metaverseAktif: {
        type: Boolean,
        default: true
    },
    kayitAktif: {
        type: Boolean,
        default: true
    },
    duyuruAktif: {
        type: Boolean,
        default: true
    },
    etkinlikAktif: {
        type: Boolean,
        default: true
    },
    anilarAktif: {
        type: Boolean,
        default: true
    },
    logo: {
        data: Buffer,
        contentType: String,
        base64: String
    },
    favicon: {
        data: Buffer,
        contentType: String,
        base64: String
    }
}, {
    timestamps: true
});

// Varsayılan ayarları oluştur
siteAyarSchema.statics.varsayilanAyarlariOlustur = async function() {
    const ayarSayisi = await this.countDocuments();
    if (ayarSayisi === 0) {
        await this.create({
            siteBaslik: 'Erdemler Köyü',
            siteAciklama: 'Erdemler Köyü Resmi Web Sitesi',
            iletisimEmail: 'info@erdemlerkoy.com'
        });
    }
};

const SiteAyar = mongoose.model('SiteAyar', siteAyarSchema);

module.exports = SiteAyar; 