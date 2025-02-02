const express = require('express');
const router = express.Router();
const Etkinlik = require('../models/Etkinlik');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminKontrol = require('../middleware/adminKontrol');

// Görsel yükleme ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/etkinlikler')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Hata: Sadece resim dosyaları yüklenebilir!');
        }
    }
});

// Etkinlikler Sayfası
router.get('/', async (req, res) => {
    try {
        const etkinlikler = await Etkinlik.find()
            .sort({ tarih: 1 }) // Yaklaşan etkinlikler önce
            .populate('ekleyenAdmin', 'isim soyisim');

        res.render('etkinlikler/liste', {
            title: 'Etkinlikler',
            user: req.session.user,
            etkinlikler: etkinlikler
        });
    } catch (error) {
        console.error('Etkinlik listesi hatası:', error);
        req.flash('error', 'Etkinlikler yüklenirken bir hata oluştu');
        res.redirect('/');
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
        const { baslik, aciklama, tarih, saat, konum } = req.body;

        const etkinlik = new Etkinlik({
            baslik,
            aciklama,
            tarih: new Date(tarih + 'T' + saat),
            konum,
            ekleyenAdmin: req.session.user.id
        });

        // Eğer görsel yüklendiyse
        if (req.file) {
            const gorselData = fs.readFileSync(req.file.path);
            etkinlik.gorsel = {
                data: gorselData,
                contentType: req.file.mimetype,
                base64: `data:${req.file.mimetype};base64,${gorselData.toString('base64')}`
            };
            // Geçici dosyayı sil
            fs.unlinkSync(req.file.path);
        }

        await etkinlik.save();
        req.flash('success', 'Etkinlik başarıyla eklendi');
        res.redirect('/etkinlikler');
    } catch (error) {
        console.error('Etkinlik ekleme hatası:', error);
        req.flash('error', 'Etkinlik eklenirken bir hata oluştu: ' + error.message);
        res.redirect('/etkinlikler/admin/ekle');
    }
});

// Etkinlik Detay Sayfası
router.get('/:id', async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id)
            .populate('ekleyenAdmin', 'isim soyisim');

        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler');
        }

        res.render('etkinlikler/detay', {
            title: etkinlik.baslik,
            user: req.session.user,
            etkinlik: etkinlik
        });
    } catch (error) {
        console.error('Etkinlik detay hatası:', error);
        req.flash('error', 'Etkinlik yüklenirken bir hata oluştu');
        res.redirect('/etkinlikler');
    }
});

// Admin - Etkinlik Düzenleme Sayfası
router.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id);
        
        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler');
        }

        res.render('admin/etkinlik_duzenle', {
            title: 'Etkinlik Düzenle',
            user: req.session.user,
            etkinlik: etkinlik
        });
    } catch (error) {
        console.error('Etkinlik düzenleme sayfası hatası:', error);
        req.flash('error', 'Etkinlik bilgileri yüklenirken bir hata oluştu');
        res.redirect('/etkinlikler');
    }
});

// Admin - Etkinlik Düzenleme İşlemi
router.post('/admin/duzenle/:id', adminKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const { baslik, aciklama, tarih, saat, konum, gorselSil } = req.body;
        const etkinlik = await Etkinlik.findById(req.params.id);

        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler');
        }

        etkinlik.baslik = baslik;
        etkinlik.aciklama = aciklama;
        etkinlik.konum = konum;
        
        // Tarih ve saat birleştirme
        try {
            const tarihSaat = new Date(tarih + 'T' + saat);
            if (isNaN(tarihSaat.getTime())) {
                throw new Error('Geçersiz tarih veya saat');
            }
            etkinlik.tarih = tarihSaat;
        } catch (err) {
            console.error('Tarih dönüştürme hatası:', err);
            req.flash('error', 'Geçersiz tarih veya saat formatı');
            return res.redirect(`/etkinlikler/admin/duzenle/${req.params.id}`);
        }

        // Görsel silme işlemi
        if (gorselSil === 'on') {
            etkinlik.gorsel = undefined;
        }

        // Yeni görsel yükleme işlemi
        if (req.file) {
            const gorselData = fs.readFileSync(req.file.path);
            etkinlik.gorsel = {
                data: gorselData,
                contentType: req.file.mimetype,
                base64: `data:${req.file.mimetype};base64,${gorselData.toString('base64')}`
            };
            // Geçici dosyayı sil
            fs.unlinkSync(req.file.path);
        }

        await etkinlik.save();
        req.flash('success', 'Etkinlik başarıyla güncellendi');
        res.redirect('/etkinlikler');
    } catch (error) {
        console.error('Etkinlik güncelleme hatası:', error);
        req.flash('error', 'Etkinlik güncellenirken bir hata oluştu: ' + error.message);
        res.redirect(`/etkinlikler/admin/duzenle/${req.params.id}`);
    }
});

// Admin - Etkinlik Silme
router.post('/admin/sil/:id', adminKontrol, async (req, res) => {
    try {
        const etkinlik = await Etkinlik.findById(req.params.id);
        if (!etkinlik) {
            req.flash('error', 'Etkinlik bulunamadı');
            return res.redirect('/etkinlikler');
        }

        // Görsel varsa sil
        if (etkinlik.gorsel) {
            const gorselYolu = path.join(__dirname, '../public', etkinlik.gorsel);
            if (fs.existsSync(gorselYolu)) {
                fs.unlinkSync(gorselYolu);
            }
        }

        await etkinlik.deleteOne();
        req.flash('success', 'Etkinlik başarıyla silindi');
        res.redirect('/etkinlikler');
    } catch (error) {
        console.error('Etkinlik silme hatası:', error);
        req.flash('error', 'Etkinlik silinirken bir hata oluştu');
        res.redirect('/etkinlikler');
    }
});

// Admin - Etkinlik Listesi
router.get('/admin/liste', adminKontrol, async (req, res) => {
    try {
        const etkinlikler = await Etkinlik.find()
            .populate('ekleyenAdmin', 'isim soyisim')
            .sort({ tarih: -1 });

        res.render('admin/etkinlik_liste', {
            title: 'Etkinlik Yönetimi',
            user: req.session.user,
            etkinlikler: etkinlikler
        });
    } catch (error) {
        console.error('Admin etkinlik listesi hatası:', error);
        req.flash('error', 'Etkinlikler yüklenirken bir hata oluştu');
        res.redirect('/etkinlikler');
    }
});

module.exports = router; 