const express = require('express');
const router = express.Router();
const Aidat = require('../models/Aidat');
const User = require('../models/User');
const adminKontrol = require('../middleware/adminKontrol');
const girisKontrol = require('../middleware/girisKontrol');

// Üye - Aidat Durumu Görüntüleme
router.get('/durum', girisKontrol, async (req, res) => {
    try {
        const yil = req.query.yil || new Date().getFullYear();
        
        // Aidat listesi
        const aidatlar = await Aidat.find({
            uye: req.session.user.id,
            ...(yil ? { yil: yil } : {})
        }).sort({ yil: -1, ay: -1 });

        // Toplam ödenmiş aidat
        const odenenToplam = await Aidat.aggregate([
            { 
                $match: { 
                    uye: req.session.user._id,
                    durum: 'Ödendi',
                    ...(yil ? { yil: parseInt(yil) } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$tutar' }
                }
            }
        ]);

        // Toplam borç
        const borcToplam = await Aidat.aggregate([
            { 
                $match: { 
                    uye: req.session.user._id,
                    durum: 'Ödenmedi',
                    ...(yil ? { yil: parseInt(yil) } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$tutar' }
                }
            }
        ]);

        // En son eklenen aidatın tutarını aylık aidat olarak kabul ediyoruz
        const sonAidat = await Aidat.findOne({ uye: req.session.user.id }).sort({ createdAt: -1 });

        res.render('aidat_durumu', {
            title: 'Aidat Durumu',
            user: req.session.user,
            aidatlar,
            yil,
            odenenToplam: odenenToplam[0]?.total || 0,
            borcToplam: borcToplam[0]?.total || 0,
            aylikAidat: sonAidat?.tutar || 0
        });
    } catch (err) {
        console.error('Aidat durumu görüntüleme hatası:', err);
        req.flash('error', 'Aidat bilgileri yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Admin - Aidat Yönetimi Sayfası
router.get('/admin/aidat', adminKontrol, async (req, res) => {
    try {
        const { uye, yil } = req.query;

        // Aktif üyeleri getir
        const uyeler = await User.find({ 
            rol: { $in: ['aktif_uye', 'admin'] }
        }).sort('isim');

        // Aidat listesi
        const aidatlar = await Aidat.find({
            ...(uye ? { uye: uye } : {}),
            ...(yil ? { yil: yil } : {})
        })
        .populate('uye', 'isim soyisim')
        .sort({ yil: -1, ay: -1 });

        res.render('admin/aidat_yonetimi', {
            title: 'Aidat Yönetimi',
            aidatlar,
            uyeler,
            secilenUye: uye,
            secilenYil: yil
        });
    } catch (err) {
        console.error('Aidat yönetimi sayfası hatası:', err);
        req.flash('error', 'Aidat bilgileri yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Admin - Yeni Aidat Ekleme
router.post('/admin/aidat/ekle', adminKontrol, async (req, res) => {
    try {
        const { uye, yil, ay, tutar, aciklama } = req.body;

        // Aynı ay için mükerrer kayıt kontrolü
        const mevcutAidat = await Aidat.findOne({ uye, yil, ay });
        if (mevcutAidat) {
            req.flash('error', 'Bu dönem için zaten aidat kaydı mevcut');
            return res.redirect('/admin/aidat');
        }

        const yeniAidat = new Aidat({
            uye,
            yil,
            ay,
            tutar,
            aciklama,
            ekleyenAdmin: req.session.user.id
        });

        await yeniAidat.save();
        req.flash('success', 'Aidat başarıyla eklendi');
        res.redirect('/admin/aidat');
    } catch (err) {
        console.error('Aidat ekleme hatası:', err);
        req.flash('error', 'Aidat eklenirken bir hata oluştu');
        res.redirect('/admin/aidat');
    }
});

// Admin - Aidat Ödeme
router.post('/admin/aidat/:id/ode', adminKontrol, async (req, res) => {
    try {
        const aidat = await Aidat.findById(req.params.id);
        if (!aidat) {
            return res.json({ success: false, message: 'Aidat bulunamadı' });
        }

        aidat.durum = 'Ödendi';
        aidat.odemeTarihi = new Date();
        await aidat.save();

        res.json({ success: true });
    } catch (err) {
        console.error('Aidat ödeme hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu' });
    }
});

// Admin - Aidat Silme
router.post('/admin/aidat/:id/sil', adminKontrol, async (req, res) => {
    try {
        await Aidat.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('Aidat silme hatası:', err);
        res.json({ success: false, message: 'Bir hata oluştu' });
    }
});

module.exports = router; 