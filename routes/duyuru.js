const express = require('express');
const router = express.Router();
const Duyuru = require('../models/Duyuru');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminKontrol = require('../middleware/adminKontrol');

// Görsel yükleme ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/duyurular';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'duyuru-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Hata: Sadece resim dosyaları yüklenebilir!');
        }
    }
});

// Admin - Duyuru Listesi
router.get('/admin/liste', adminKontrol, async (req, res) => {
    try {
        const duyurular = await Duyuru.find()
            .populate('ekleyenAdmin', 'isim soyisim')
            .sort({ createdAt: -1 });

        res.render('admin/duyuru_liste', {
            title: 'Duyuru Yönetimi',
            user: req.session.user,
            duyurular: duyurular
        });
    } catch (error) {
        console.error('Duyuru listesi hatası:', error);
        req.flash('error', 'Duyurular yüklenirken bir hata oluştu');
        res.redirect('/duyurular');
    }
});

// Admin - Duyuru Ekleme Sayfası
router.get('/admin/ekle', adminKontrol, (req, res) => {
    try {
        res.render('admin/duyuru_ekle', {
            title: 'Yeni Duyuru Ekle',
            user: req.session.user
        });
    } catch (error) {
        console.error('Duyuru ekleme sayfası hatası:', error);
        req.flash('error', 'Sayfa yüklenirken bir hata oluştu');
        res.redirect('/duyurular/admin/liste');
    }
});

// Admin - Duyuru Ekleme İşlemi
router.post('/admin/ekle', adminKontrol, async (req, res) => {
    try {
        console.log('Duyuru ekleme isteği:', req.body);
        console.log('Session kullanıcısı:', req.session.user);

        if (!req.session.user || !req.session.user.id) {
            console.error('Kullanıcı ID bulunamadı');
            req.flash('error', 'Oturum bilgilerinizde bir sorun var. Lütfen tekrar giriş yapın.');
            return res.redirect('/giris');
        }

        const { baslik, icerik } = req.body;

        const duyuru = new Duyuru({
            baslik: baslik.trim(),
            icerik: icerik.trim(),
            ekleyenAdmin: req.session.user.id
        });

        const kaydedilenDuyuru = await duyuru.save();
        console.log('Kaydedilen duyuru:', kaydedilenDuyuru);

        req.flash('success', 'Duyuru başarıyla eklendi');
        res.redirect('/duyurular/admin/liste');
    } catch (error) {
        console.error('Duyuru ekleme hatası:', error);
        console.error('Session bilgisi:', req.session.user);
        req.flash('error', 'Duyuru eklenirken bir hata oluştu: ' + error.message);
        res.redirect('/duyurular/admin/ekle');
    }
});

// Admin - Duyuru Düzenleme Sayfası
router.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const duyuru = await Duyuru.findById(req.params.id);
        if (!duyuru) {
            req.flash('error', 'Duyuru bulunamadı');
            return res.redirect('/duyurular/admin/liste');
        }
        res.render('admin/duyuru_duzenle', {
            title: 'Duyuru Düzenle',
            user: req.session.user,
            duyuru: duyuru
        });
    } catch (error) {
        console.error('Duyuru düzenleme sayfası hatası:', error);
        req.flash('error', 'Duyuru yüklenirken bir hata oluştu');
        res.redirect('/duyurular/admin/liste');
    }
});

// Admin - Duyuru Düzenleme İşlemi
router.post('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const duyuru = await Duyuru.findById(req.params.id);
        if (!duyuru) {
            req.flash('error', 'Duyuru bulunamadı');
            return res.redirect('/duyurular/admin/liste');
        }

        duyuru.baslik = req.body.baslik.trim();
        duyuru.icerik = req.body.icerik.trim();

        await duyuru.save();
        req.flash('success', 'Duyuru başarıyla güncellendi');
        res.redirect('/duyurular/admin/liste');
    } catch (error) {
        console.error('Duyuru güncelleme hatası:', error);
        req.flash('error', 'Duyuru güncellenirken bir hata oluştu');
        res.redirect('/duyurular/admin/duzenle/' + req.params.id);
    }
});

// Admin - Duyuru Silme
router.post('/admin/sil/:id', adminKontrol, async (req, res) => {
    try {
        const duyuru = await Duyuru.findById(req.params.id);
        if (!duyuru) {
            req.flash('error', 'Duyuru bulunamadı');
            return res.redirect('/duyurular/admin/liste');
        }

        await duyuru.deleteOne();
        req.flash('success', 'Duyuru başarıyla silindi');
        res.redirect('/duyurular/admin/liste');
    } catch (error) {
        console.error('Duyuru silme hatası:', error);
        req.flash('error', 'Duyuru silinirken bir hata oluştu');
        res.redirect('/duyurular/admin/liste');
    }
});

// Tüm Duyurular Sayfası (Herkes erişebilir)
router.get('/', async (req, res) => {
    try {
        const duyurular = await Duyuru.find()
            .populate('ekleyenAdmin', 'isim soyisim')
            .sort({ createdAt: -1 });

        res.render('duyurular/liste', {
            title: 'Duyurular',
            user: req.session.user,
            duyurular: duyurular
        });
    } catch (error) {
        console.error('Duyuru listesi hatası:', error);
        req.flash('error', 'Duyurular yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Duyuru Detay Sayfası (Herkes erişebilir)
router.get('/:id', async (req, res) => {
    try {
        const duyuru = await Duyuru.findById(req.params.id)
            .populate('ekleyenAdmin', 'isim soyisim');

        if (!duyuru) {
            req.flash('error', 'Duyuru bulunamadı');
            return res.redirect('/duyurular');
        }

        res.render('duyurular/detay', {
            title: duyuru.baslik,
            user: req.session.user,
            duyuru: duyuru
        });
    } catch (error) {
        console.error('Duyuru detay hatası:', error);
        req.flash('error', 'Duyuru yüklenirken bir hata oluştu');
        res.redirect('/duyurular');
    }
});

module.exports = router; 