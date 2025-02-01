const express = require('express');
const router = express.Router();
const Ani = require('../models/Ani');
const User = require('../models/User');
const Grup = require('../models/Grup');
const multer = require('multer');
const path = require('path');

// Middleware - Giriş kontrolü
const girisKontrol = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.flash('error', 'Bu sayfayı görüntülemek için giriş yapmalısınız');
        res.redirect('/giris');
    }
};

// Middleware - Admin kontrolü
const adminKontrol = (req, res, next) => {
    if (req.session.user && req.session.user.rol === 'admin') {
        next();
    } else {
        req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
        res.redirect('/');
    }
};

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
            cb('Hata: Sadece resim dosyaları yüklenebilir!');
        }
    }
});

// Anılar Sayfası
router.get('/', aktifUyeKontrol, async (req, res) => {
    try {
        // Kullanıcının üye olduğu grupları bul
        const kullaniciGruplari = await Grup.find({ uyeler: req.session.user.id }).select('_id');
        const grupIdleri = kullaniciGruplari.map(grup => grup._id);

        // Görünürlük kontrolü ile anıları getir
        const anilar = await Ani.find({
            durum: 'onaylandi',
            $or: [
                { gorunurlukTipi: 'herkese_acik' },
                { gorunurlukTipi: 'secili_kullanicilar', izinVerilenKullanicilar: req.session.user.id },
                { gorunurlukTipi: 'secili_gruplar', izinVerilenGruplar: { $in: grupIdleri } }
            ]
        })
        .populate('paylasanKullanici', 'isim soyisim')
        .sort({ onayTarihi: -1 });

        res.render('anilar/liste', {
            title: 'Anılar',
            user: req.session.user,
            anilar: anilar
        });
    } catch (error) {
        console.error('Anı listesi hatası:', error);
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
            paylasanKullanici: req.session.user.id,
            durum: 'beklemede'
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
            .populate('paylasanKullanici', 'isim soyisim');

        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar');
        }

        // Görünürlük kontrolü
        if (ani.gorunurlukTipi !== 'herkese_acik') {
            const kullaniciGruplari = await Grup.find({ uyeler: req.session.user.id }).select('_id');
            const grupIdleri = kullaniciGruplari.map(grup => grup._id);

            const erisimVarMi = 
                (ani.gorunurlukTipi === 'secili_kullanicilar' && ani.izinVerilenKullanicilar.includes(req.session.user.id)) ||
                (ani.gorunurlukTipi === 'secili_gruplar' && ani.izinVerilenGruplar.some(grupId => grupIdleri.includes(grupId)));

            if (!erisimVarMi) {
                req.flash('error', 'Bu anıyı görüntüleme yetkiniz yok');
                return res.redirect('/anilar');
            }
        }

        res.render('anilar/detay', {
            title: ani.baslik,
            user: req.session.user,
            ani: ani
        });
    } catch (error) {
        console.error('Anı detay hatası:', error);
        req.flash('error', 'Anı yüklenirken bir hata oluştu');
        res.redirect('/anilar');
    }
});

// Admin - Bekleyen Anılar Sayfası
router.get('/admin/bekleyen', adminKontrol, async (req, res) => {
    try {
        const anilar = await Ani.find({ durum: 'beklemede' })
            .populate('paylasanKullanici', 'isim soyisim')
            .sort({ olusturmaTarihi: -1 });

        res.render('admin/bekleyen_anilar', {
            title: 'Bekleyen Anılar',
            user: req.session.user,
            anilar: anilar
        });
    } catch (error) {
        req.flash('error', 'Bekleyen anılar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Admin - Anı Onaylama Sayfası
router.get('/admin/onayla/:id', adminKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id)
            .populate('paylasanKullanici', 'isim soyisim');
        
        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/bekleyen');
        }

        const kullanicilar = await User.find({ rol: 'aktif_uye' })
            .sort({ isim: 1, soyisim: 1 });
        const gruplar = await Grup.find()
            .sort({ isim: 1 });

        res.render('admin/ani_onayla', {
            title: 'Anı Onaylama',
            user: req.session.user,
            ani: ani,
            kullanicilar: kullanicilar,
            gruplar: gruplar
        });
    } catch (error) {
        console.error('Anı onaylama sayfası hatası:', error);
        req.flash('error', 'Anı bilgileri yüklenirken bir hata oluştu');
        res.redirect('/anilar/admin/bekleyen');
    }
});

// Admin - Anı Onaylama İşlemi
router.post('/admin/onayla/:id', adminKontrol, async (req, res) => {
    try {
        const { durum, gorunurlukTipi, izinVerilenKullanicilar, izinVerilenGruplar } = req.body;
        const ani = await Ani.findById(req.params.id);
        
        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/bekleyen');
        }

        ani.durum = durum;
        
        if (durum === 'onaylandi') {
            ani.gorunurlukTipi = gorunurlukTipi;
            
            if (gorunurlukTipi === 'secili_kullanicilar') {
                ani.izinVerilenKullanicilar = Array.isArray(izinVerilenKullanicilar) 
                    ? izinVerilenKullanicilar 
                    : [izinVerilenKullanicilar];
            } else if (gorunurlukTipi === 'secili_gruplar') {
                ani.izinVerilenGruplar = Array.isArray(izinVerilenGruplar)
                    ? izinVerilenGruplar
                    : [izinVerilenGruplar];
            }

            ani.onayTarihi = Date.now();
            ani.onaylayanAdmin = req.session.user.id;
        }

        await ani.save();

        req.flash('success', `Anı başarıyla ${durum === 'onaylandi' ? 'onaylandı' : 'reddedildi'}`);
        res.redirect('/anilar/admin/bekleyen');
    } catch (error) {
        console.error('Anı onaylama hatası:', error);
        req.flash('error', 'Anı onaylanırken bir hata oluştu');
        res.redirect(`/anilar/admin/onayla/${req.params.id}`);
    }
});

// Admin - Anı Reddetme
router.post('/admin/reddet/:id', adminKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id);
        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/bekleyen');
        }

        ani.durum = 'reddedildi';
        await ani.save();

        req.flash('success', 'Anı reddedildi');
        res.redirect('/anilar/admin/bekleyen');
    } catch (error) {
        req.flash('error', 'Anı reddedilirken bir hata oluştu');
        res.redirect('/anilar/admin/bekleyen');
    }
});

// Admin - Anı Listesi
router.get('/admin/liste', adminKontrol, async (req, res) => {
    try {
        const anilar = await Ani.find()
            .populate('paylasanKullanici', 'isim soyisim')
            .populate('onaylayanAdmin', 'isim soyisim')
            .sort({ olusturmaTarihi: -1 });

        res.render('admin/anilar_liste', {
            title: 'Anı Yönetimi',
            user: req.session.user,
            anilar: anilar
        });
    } catch (error) {
        console.error('Admin anı listesi hatası:', error);
        req.flash('error', 'Anılar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Admin - Anı Düzenleme Sayfası
router.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id)
            .populate('paylasanKullanici', 'isim soyisim');
        
        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/liste');
        }

        const kullanicilar = await User.find({ rol: 'aktif_uye' })
            .sort({ isim: 1, soyisim: 1 });
        const gruplar = await Grup.find()
            .sort({ isim: 1 });

        res.render('admin/ani_duzenle', {
            title: 'Anı Düzenle',
            user: req.session.user,
            ani: ani,
            kullanicilar: kullanicilar,
            gruplar: gruplar
        });
    } catch (error) {
        console.error('Anı düzenleme sayfası hatası:', error);
        req.flash('error', 'Anı bilgileri yüklenirken bir hata oluştu');
        res.redirect('/anilar/admin/liste');
    }
});

// Admin - Anı Düzenleme İşlemi
router.post('/admin/duzenle/:id', adminKontrol, upload.single('gorsel'), async (req, res) => {
    try {
        const { baslik, icerik, gorunurlukTipi, izinVerilenKullanicilar, izinVerilenGruplar } = req.body;
        const ani = await Ani.findById(req.params.id);

        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/liste');
        }

        // Temel bilgileri güncelle
        ani.baslik = baslik;
        ani.icerik = icerik;

        // Görünürlük ayarlarını güncelle
        ani.gorunurlukTipi = gorunurlukTipi;
        if (gorunurlukTipi === 'secili_kullanicilar') {
            ani.izinVerilenKullanicilar = Array.isArray(izinVerilenKullanicilar) 
                ? izinVerilenKullanicilar 
                : [izinVerilenKullanicilar];
            ani.izinVerilenGruplar = [];
        } else if (gorunurlukTipi === 'secili_gruplar') {
            ani.izinVerilenGruplar = Array.isArray(izinVerilenGruplar)
                ? izinVerilenGruplar
                : [izinVerilenGruplar];
            ani.izinVerilenKullanicilar = [];
        } else {
            // herkese_acik durumunda izin listelerini temizle
            ani.izinVerilenKullanicilar = [];
            ani.izinVerilenGruplar = [];
        }

        // Yeni görsel yüklendiyse güncelle
        if (req.file) {
            ani.gorsel = '/uploads/anilar/' + req.file.filename;
        }

        await ani.save();
        req.flash('success', 'Anı başarıyla güncellendi');
        res.redirect('/anilar/admin/liste');
    } catch (error) {
        console.error('Anı güncelleme hatası:', error);
        req.flash('error', 'Anı güncellenirken bir hata oluştu');
        res.redirect(`/anilar/admin/duzenle/${req.params.id}`);
    }
});

// Admin - Anı Silme
router.post('/admin/sil/:id', adminKontrol, async (req, res) => {
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
router.post('/admin/pasif/:id', adminKontrol, async (req, res) => {
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

// Admin - Bekleyen Anı Detay Sayfası
router.get('/admin/detay/:id', adminKontrol, async (req, res) => {
    try {
        const ani = await Ani.findById(req.params.id)
            .populate('paylasanId', 'isim soyisim');

        if (!ani) {
            req.flash('error', 'Anı bulunamadı');
            return res.redirect('/anilar/admin/bekleyen');
        }

        res.render('admin/ani_detay', {
            title: 'Anı Detayı',
            user: req.session.user,
            ani: ani
        });
    } catch (error) {
        req.flash('error', 'Anı yüklenirken bir hata oluştu');
        res.redirect('/anilar/admin/bekleyen');
    }
});

module.exports = router; 