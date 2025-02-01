const express = require('express');
const router = express.Router();
const Etkinlik = require('../models/Etkinlik');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware - Admin kontrolü
const adminKontrol = (req, res, next) => {
    if (req.session.user && req.session.user.rol === 'admin') {
        next();
    } else {
        req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
        res.redirect('/');
    }
};

// Görsel yükleme ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/etkinlikler';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'etkinlik-' + uniqueSuffix + path.extname(file.originalname));
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

// Etkinlik Listesi
router.get('/', async (req, res) => {
    try {
        const etkinlikler = await Etkinlik.find({ durum: 'aktif' })
            .populate('olusturanId', 'isim soyisim');

        res.render('etkinlikler', {
            title: 'Etkinlikler',
            user: req.session.user,
            etkinlikler: etkinlikler
        });
    } catch (error) {
        req.flash('error', 'Etkinlikler yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Admin - Etkinlik Listesi
router.get('/admin/liste', adminKontrol, async (req, res) => {
    try {
        const etkinlikler = await Etkinlik.find()
            .populate('olusturanId', 'isim soyisim');

        res.render('admin/etkinlik_liste', {
            title: 'Etkinlik Yönetimi',
            user: req.session.user,
            etkinlikler: etkinlikler
        });
    } catch (error) {
        req.flash('error', 'Etkinlikler yüklenirken bir hata oluştu');
        res.redirect('/admin');
    }
});

// Admin - Etkinlik Ekleme Sayfası
router.get('/admin/ekle', adminKontrol, (req, res) => {
    res.render('admin/etkinlik_ekle', {
        title: 'Yeni Etkinlik Ekle',
        user: req.session.user
    });
});

// Admin - Etkinlik Ekleme İşlemi
router.post('/admin/ekle', adminKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const etkinlik = new Etkinlik({
            baslik: req.body.baslik,
            aciklama: req.body.aciklama,
            tarih: req.body.tarih,
            saat: req.body.saat,
            yer: req.body.yer,
            durum: req.body.durum,
            olusturanId: req.session.user._id
        });

        if (req.file) {
            etkinlik.gorsel = '/uploads/etkinlikler/' + req.file.filename;
        }

        await etkinlik.save();
        req.flash('success', 'Etkinlik başarıyla eklendi');
        res.redirect('/etkinlikler/admin/liste');
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error', 'Etkinlik eklenirken bir hata oluştu');
        res.redirect('/etkinlikler/admin/ekle');
    }
});

// Admin - Etkinlik Düzenleme Sayfası
router.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id);
        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler/admin/liste');
        }

        res.render('admin/etkinlik_duzenle', {
            title: 'Etkinlik Düzenle',
            user: req.session.user,
            etkinlik: etkinlik
        });
    } catch (error) {
        req.flash('error', 'Etkinlik yüklenirken bir hata oluştu');
        res.redirect('/etkinlikler/admin/liste');
    }
});

// Admin - Etkinlik Düzenleme İşlemi
router.post('/admin/duzenle/:id', adminKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id);
        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler/admin/liste');
        }

        etkinlik.baslik = req.body.baslik;
        etkinlik.aciklama = req.body.aciklama;
        etkinlik.tarih = req.body.tarih;
        etkinlik.saat = req.body.saat;
        etkinlik.yer = req.body.yer;
        etkinlik.durum = req.body.durum;

        if (req.body.gorselSil === 'on' && etkinlik.gorsel) {
            const eskiGorselYolu = path.join(__dirname, '../public', etkinlik.gorsel);
            if (fs.existsSync(eskiGorselYolu)) {
                fs.unlinkSync(eskiGorselYolu);
            }
            etkinlik.gorsel = undefined;
        }

        if (req.file) {
            if (etkinlik.gorsel) {
                const eskiGorselYolu = path.join(__dirname, '../public', etkinlik.gorsel);
                if (fs.existsSync(eskiGorselYolu)) {
                    fs.unlinkSync(eskiGorselYolu);
                }
            }
            etkinlik.gorsel = '/uploads/etkinlikler/' + req.file.filename;
        }

        await etkinlik.save();
        req.flash('success', 'Etkinlik başarıyla güncellendi');
        res.redirect('/etkinlikler/admin/liste');
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error', 'Etkinlik güncellenirken bir hata oluştu');
        res.redirect('/etkinlikler/admin/duzenle/' + req.params.id);
    }
});

// Admin - Etkinlik Silme
router.post('/admin/sil/:id', adminKontrol, async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id);
        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler/admin/liste');
        }

        if (etkinlik.gorsel) {
            const gorselYolu = path.join(__dirname, '../public', etkinlik.gorsel);
            if (fs.existsSync(gorselYolu)) {
                fs.unlinkSync(gorselYolu);
            }
        }

        await etkinlik.deleteOne();
        req.flash('success', 'Etkinlik başarıyla silindi');
        res.redirect('/etkinlikler/admin/liste');
    } catch (error) {
        req.flash('error', 'Etkinlik silinirken bir hata oluştu');
        res.redirect('/etkinlikler/admin/liste');
    }
});

// Etkinlik Detay Sayfası
router.get('/:id', async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id)
            .populate('olusturanId', 'isim soyisim');

        if (!etkinlik || etkinlik.durum !== 'aktif') {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler');
        }

        res.render('etkinlik_detay', {
            title: etkinlik.baslik,
            user: req.session.user,
            etkinlik: etkinlik
        });
    } catch (error) {
        req.flash('error', 'Etkinlik yüklenirken bir hata oluştu');
        res.redirect('/etkinlikler');
    }
});

module.exports = router; 