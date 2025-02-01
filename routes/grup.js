const express = require('express');
const router = express.Router();
const Grup = require('../models/Grup');
const User = require('../models/User');

// Middleware - Admin kontrolü
const adminKontrol = (req, res, next) => {
    if (req.session.user && req.session.user.rol === 'admin') {
        next();
    } else {
        req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
        res.redirect('/');
    }
};

// Grup Listesi
router.get('/admin/gruplar', adminKontrol, async (req, res) => {
    try {
        const gruplar = await Grup.find().populate('uyeler', 'isim soyisim rol');
        res.render('admin/gruplar', {
            title: 'Grup Yönetimi',
            user: req.session.user,
            gruplar: gruplar
        });
    } catch (error) {
        console.error('Grup listesi hatası:', error);
        req.flash('error', 'Gruplar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Grup Ekleme Sayfası
router.get('/admin/grup-ekle', adminKontrol, async (req, res) => {
    try {
        const kullanicilar = await User.find({ rol: { $ne: 'beklemede' } }).sort({ isim: 1 });
        res.render('admin/grup_ekle', {
            title: 'Yeni Grup Oluştur',
            user: req.session.user,
            kullanicilar: kullanicilar
        });
    } catch (error) {
        req.flash('error', 'Sayfa yüklenirken bir hata oluştu');
        res.redirect('/admin/gruplar');
    }
});

// Grup Ekleme İşlemi
router.post('/admin/grup-ekle', adminKontrol, async (req, res) => {
    try {
        const { isim, aciklama, uyeler } = req.body;

        const yeniGrup = new Grup({
            isim,
            aciklama,
            uyeler: uyeler || [],
            olusturanAdmin: req.session.user.id
        });

        await yeniGrup.save();
        req.flash('success', 'Grup başarıyla oluşturuldu');
        res.redirect('/admin/gruplar');
    } catch (error) {
        console.error('Grup ekleme hatası:', error);
        req.flash('error', 'Grup oluşturulurken bir hata oluştu');
        res.redirect('/admin/grup-ekle');
    }
});

// Grup Düzenleme Sayfası
router.get('/admin/grup-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const grup = await Grup.findById(req.params.id);
        if (!grup) {
            req.flash('error', 'Grup bulunamadı');
            return res.redirect('/admin/gruplar');
        }

        const kullanicilar = await User.find({ rol: { $ne: 'beklemede' } }).sort({ isim: 1 });
        
        res.render('admin/grup_duzenle', {
            title: 'Grup Düzenle',
            user: req.session.user,
            grup: grup,
            kullanicilar: kullanicilar
        });
    } catch (error) {
        req.flash('error', 'Grup bilgileri yüklenirken bir hata oluştu');
        res.redirect('/admin/gruplar');
    }
});

// Grup Düzenleme İşlemi
router.post('/admin/grup-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const { isim, aciklama, uyeler } = req.body;
        
        const grup = await Grup.findById(req.params.id);
        if (!grup) {
            req.flash('error', 'Grup bulunamadı');
            return res.redirect('/admin/gruplar');
        }

        grup.isim = isim;
        grup.aciklama = aciklama;
        grup.uyeler = uyeler || [];

        await grup.save();
        req.flash('success', 'Grup başarıyla güncellendi');
        res.redirect('/admin/gruplar');
    } catch (error) {
        console.error('Grup güncelleme hatası:', error);
        req.flash('error', 'Grup güncellenirken bir hata oluştu');
        res.redirect(`/admin/grup-duzenle/${req.params.id}`);
    }
});

// Grup Silme İşlemi
router.post('/admin/grup-sil/:id', adminKontrol, async (req, res) => {
    try {
        await Grup.findByIdAndDelete(req.params.id);
        req.flash('success', 'Grup başarıyla silindi');
        res.redirect('/admin/gruplar');
    } catch (error) {
        console.error('Grup silme hatası:', error);
        req.flash('error', 'Grup silinirken bir hata oluştu');
        res.redirect('/admin/gruplar');
    }
});

module.exports = router; 