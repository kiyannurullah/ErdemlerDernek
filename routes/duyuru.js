const express = require('express');
const router = express.Router();
const Duyuru = require('../models/Duyuru');
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

// Duyuru Listesi
router.get('/', async (req, res) => {
    try {
        const duyurular = await Duyuru.find({ durum: 'aktif' })
            .populate('olusturanId', 'isim soyisim');
        res.render('duyurular', {
            title: 'Duyurular',
            user: req.session.user,
            duyurular: duyurular
        });
    } catch (error) {
        req.flash('error', 'Duyurular yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Admin - Duyuru Listesi
router.get('/admin/liste', adminKontrol, async (req, res) => {
    try {
        const duyurular = await Duyuru.find()
            .populate('olusturanId', 'isim soyisim');
        res.render('admin/duyuru_liste', {
            title: 'Duyuru Yönetimi',
            user: req.session.user,
            duyurular: duyurular
        });
    } catch (error) {
        req.flash('error', 'Duyurular yüklenirken bir hata oluştu');
        res.redirect('/admin');
    }
});

// Admin - Duyuru Ekleme Sayfası
router.get('/admin/ekle', adminKontrol, (req, res) => {
    res.render('admin/duyuru_ekle', {
        title: 'Yeni Duyuru Ekle',
        user: req.session.user
    });
});

// Admin - Duyuru Ekleme İşlemi
router.post('/admin/ekle', adminKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const duyuru = new Duyuru({
            baslik: req.body.baslik,
            icerik: req.body.icerik,
            durum: req.body.durum,
            onemDurumu: req.body.onemDurumu,
            olusturanId: req.session.user._id
        });

        if (req.file) {
            duyuru.gorsel = '/uploads/duyurular/' + req.file.filename;
        }

        await duyuru.save();
        req.flash('success', 'Duyuru başarıyla eklendi');
        res.redirect('/duyurular/admin/liste');
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error', 'Duyuru eklenirken bir hata oluştu');
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
        req.flash('error', 'Duyuru yüklenirken bir hata oluştu');
        res.redirect('/duyurular/admin/liste');
    }
});

// Admin - Duyuru Düzenleme İşlemi
router.post('/admin/duzenle/:id', adminKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const duyuru = await Duyuru.findById(req.params.id);
        if (!duyuru) {
            req.flash('error', 'Duyuru bulunamadı');
            return res.redirect('/duyurular/admin/liste');
        }

        duyuru.baslik = req.body.baslik;
        duyuru.icerik = req.body.icerik;
        duyuru.durum = req.body.durum;
        duyuru.onemDurumu = req.body.onemDurumu;

        if (req.body.gorselSil === 'on' && duyuru.gorsel) {
            const eskiGorselYolu = path.join(__dirname, '../public', duyuru.gorsel);
            if (fs.existsSync(eskiGorselYolu)) {
                fs.unlinkSync(eskiGorselYolu);
            }
            duyuru.gorsel = undefined;
        }

        if (req.file) {
            if (duyuru.gorsel) {
                const eskiGorselYolu = path.join(__dirname, '../public', duyuru.gorsel);
                if (fs.existsSync(eskiGorselYolu)) {
                    fs.unlinkSync(eskiGorselYolu);
                }
            }
            duyuru.gorsel = '/uploads/duyurular/' + req.file.filename;
        }

        await duyuru.save();
        req.flash('success', 'Duyuru başarıyla güncellendi');
        res.redirect('/duyurular/admin/liste');
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
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

        if (duyuru.gorsel) {
            const gorselYolu = path.join(__dirname, '../public', duyuru.gorsel);
            if (fs.existsSync(gorselYolu)) {
                fs.unlinkSync(gorselYolu);
            }
        }

        await duyuru.deleteOne();
        req.flash('success', 'Duyuru başarıyla silindi');
        res.redirect('/duyurular/admin/liste');
    } catch (error) {
        req.flash('error', 'Duyuru silinirken bir hata oluştu');
        res.redirect('/duyurular/admin/liste');
    }
});

// Duyuru Detay Sayfası
router.get('/:id', async (req, res) => {
    try {
        const duyuru = await Duyuru.findById(req.params.id)
            .populate('olusturanId', 'isim soyisim');
        
        if (!duyuru || duyuru.durum !== 'aktif') {
            req.flash('error', 'Duyuru bulunamadı');
            return res.redirect('/duyurular');
        }

        res.render('duyuru_detay', {
            title: duyuru.baslik,
            user: req.session.user,
            duyuru: duyuru
        });
    } catch (error) {
        req.flash('error', 'Duyuru yüklenirken bir hata oluştu');
        res.redirect('/duyurular');
    }
});

module.exports = router; 