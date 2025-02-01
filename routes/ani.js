const express = require('express');
const router = express.Router();
const Ani = require('../models/Ani');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

// Middleware - Aktif üye kontrolü
const aktifUyeKontrol = (req, res, next) => {
    if (req.session.user && (req.session.user.rol === 'aktif_uye' || req.session.user.rol === 'admin')) {
        next();
    } else {
        req.flash('error', 'Bu sayfaya erişim için aktif üye olmalısınız');
        res.redirect('/');
    }
};

// Görsel yükleme ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/anilar')
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
            cb('Sadece resim dosyaları yüklenebilir!');
        }
    }
});

// Anı Listesi Sayfası
router.get('/', aktifUyeKontrol, async (req, res) => {
    try {
        const anilar = await Ani.find({ onayDurumu: 'onaylandi' })
            .populate('paylasanId', 'isim soyisim')
            .sort({ paylasimTarihi: -1 });

        res.render('anilar/liste', {
            title: 'Anılar',
            user: req.session.user,
            anilar: anilar
        });
    } catch (error) {
        req.flash('error', 'Anılar yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Anı Ekleme Sayfası
router.get('/ekle', aktifUyeKontrol, (req, res) => {
    res.render('anilar/ekle', {
        title: 'Anı Ekle',
        user: req.session.user
    });
});

// Anı Ekleme İşlemi
router.post('/ekle', aktifUyeKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const { baslik, icerik } = req.body;
        const ani = new Ani({
            baslik,
            icerik,
            gorsel: req.file ? '/uploads/anilar/' + req.file.filename : null,
            paylasanId: req.session.user.id
        });

        await ani.save();
        req.flash('success', 'Anınız başarıyla eklendi ve onay için gönderildi');
        res.redirect('/anilar');
    } catch (error) {
        req.flash('error', 'Anı eklenirken bir hata oluştu: ' + error.message);
        res.redirect('/anilar/ekle');
    }
});

// Anı Detay Sayfası
router.get('/:id', aktifUyeKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id)
            .populate('paylasanId', 'isim soyisim');

        if (!ani || ani.onayDurumu !== 'onaylandi') {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar');
        }

        // Görüntüleme sayısını artır
        ani.goruntulemeSayisi += 1;
        await ani.save();

        res.render('anilar/detay', {
            title: ani.baslik,
            user: req.session.user,
            ani: ani
        });
    } catch (error) {
        req.flash('error', 'Anı yüklenirken bir hata oluştu');
        res.redirect('/anilar');
    }
});

// Admin - Bekleyen Anılar Listesi
router.get('/admin/bekleyen', aktifUyeKontrol, async (req, res) => {
    try {
        const anilar = await Ani.find({ onayDurumu: 'beklemede' })
            .populate('paylasanId', 'isim soyisim')
            .sort({ paylasimTarihi: -1 });

        res.render('admin/anilar_liste', {
            title: 'Bekleyen Anılar',
            user: req.session.user,
            anilar: anilar
        });
    } catch (error) {
        req.flash('error', 'Bekleyen anılar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Admin - Anı Onaylama
router.post('/admin/onayla/:id', aktifUyeKontrol, async (req, res) => {
    try {
        const ani = await Ani.findByIdAndUpdate(
            req.params.id,
            { onayDurumu: 'onaylandi' },
            { new: true }
        );

        req.flash('success', 'Anı başarıyla onaylandı');
        res.redirect('/anilar/admin/liste');
    } catch (error) {
        req.flash('error', 'İşlem sırasında bir hata oluştu');
        res.redirect('/anilar/admin/liste');
    }
});

// Admin - Anı Reddetme
router.post('/admin/reddet/:id', aktifUyeKontrol, async (req, res) => {
    try {
        const ani = await Ani.findByIdAndUpdate(
            req.params.id,
            { onayDurumu: 'reddedildi' },
            { new: true }
        );

        req.flash('success', 'Anı reddedildi');
        res.redirect('/anilar/admin/bekleyen');
    } catch (error) {
        req.flash('error', 'İşlem sırasında bir hata oluştu');
        res.redirect('/anilar/admin/bekleyen');
    }
});

// Admin - Tüm Anılar Listesi
router.get('/admin/liste', aktifUyeKontrol, async (req, res) => {
    try {
        const anilar = await Ani.find()
            .populate('paylasanId', 'isim soyisim')
            .sort({ paylasimTarihi: -1 });

        res.render('admin/anilar_liste', {
            title: 'Tüm Anılar',
            user: req.session.user,
            anilar: anilar
        });
    } catch (error) {
        req.flash('error', 'Anılar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Admin - Anı Düzenleme Sayfası
router.get('/admin/duzenle/:id', aktifUyeKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id);
        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/liste');
        }

        res.render('admin/ani_duzenle', {
            title: 'Anı Düzenle',
            user: req.session.user,
            ani: ani
        });
    } catch (error) {
        req.flash('error', 'Anı yüklenirken bir hata oluştu');
        res.redirect('/anilar/admin/liste');
    }
});

// Admin - Anı Düzenleme İşlemi
router.post('/admin/duzenle/:id', aktifUyeKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const { baslik, icerik, onayDurumu, gorselSil } = req.body;
        const ani = await Ani.findById(req.params.id);

        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/liste');
        }

        // Anıyı güncelle
        ani.baslik = baslik;
        ani.icerik = icerik;
        ani.onayDurumu = onayDurumu;

        // Görsel işlemleri
        if (gorselSil === 'on' && ani.gorsel) {
            // Eski görseli sil
            const fs = require('fs');
            const path = require('path');
            const gorselYolu = path.join(__dirname, '../public', ani.gorsel);
            if (fs.existsSync(gorselYolu)) {
                fs.unlinkSync(gorselYolu);
            }
            ani.gorsel = null;
        }

        if (req.file) {
            // Eski görsel varsa sil
            if (ani.gorsel) {
                const fs = require('fs');
                const path = require('path');
                const gorselYolu = path.join(__dirname, '../public', ani.gorsel);
                if (fs.existsSync(gorselYolu)) {
                    fs.unlinkSync(gorselYolu);
                }
            }
            ani.gorsel = '/uploads/anilar/' + req.file.filename;
        }

        await ani.save();
        req.flash('success', 'Anı başarıyla güncellendi');
        res.redirect('/anilar/admin/liste');
    } catch (error) {
        req.flash('error', 'Anı güncellenirken bir hata oluştu: ' + error.message);
        res.redirect(`/anilar/admin/duzenle/${req.params.id}`);
    }
});

// Admin - Anı Silme
router.post('/admin/sil/:id', aktifUyeKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id);
        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/liste');
        }

        // Görsel varsa sil
        if (ani.gorsel) {
            const fs = require('fs');
            const path = require('path');
            const gorselYolu = path.join(__dirname, '../public', ani.gorsel);
            if (fs.existsSync(gorselYolu)) {
                fs.unlinkSync(gorselYolu);
            }
        }

        await ani.deleteOne();
        req.flash('success', 'Anı başarıyla silindi');
        res.redirect('/anilar/admin/liste');
    } catch (error) {
        req.flash('error', 'Anı silinirken bir hata oluştu');
        res.redirect('/anilar/admin/liste');
    }
});

// Admin - Anıyı Pasife Al
router.post('/admin/pasif/:id', aktifUyeKontrol, async (req, res) => {
    try {
        const ani = await Ani.findByIdAndUpdate(
            req.params.id,
            { onayDurumu: 'beklemede' },
            { new: true }
        );

        req.flash('success', 'Anı pasif duruma alındı');
        res.redirect('/anilar/admin/liste');
    } catch (error) {
        req.flash('error', 'İşlem sırasında bir hata oluştu');
        res.redirect('/anilar/admin/liste');
    }
});

module.exports = router; 