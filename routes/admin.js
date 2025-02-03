const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Grup = require('../models/Grup');
const adminKontrol = require('../middleware/adminKontrol');
const SiteAyar = require('../models/SiteAyar');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Görsel yükleme ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/site')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|ico/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Hata: Sadece resim dosyaları yüklenebilir!');
        }
    }
});

// Admin Panel
router.get('/panel', adminKontrol, async (req, res) => {
    try {
        const bekleyenUyeSayisi = await User.countDocuments({ rol: 'beklemede' });
        const aktifUyeSayisi = await User.countDocuments({ rol: 'aktif_uye' });
        const grupSayisi = await Grup.countDocuments();

        res.render('admin/panel', {
            title: 'Admin Panel',
            user: req.session.user,
            bekleyenUyeSayisi,
            aktifUyeSayisi,
            grupSayisi
        });
    } catch (error) {
        req.flash('error', 'Panel bilgileri yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Kullanıcı Listesi
router.get('/kullanicilar', adminKontrol, async (req, res) => {
    try {
        const kullanicilar = await User.find().sort({ kayitTarihi: -1 });
        res.render('admin/uyeler', {
            title: 'Kullanıcı Yönetimi',
            user: req.session.user,
            kullanicilar: kullanicilar
        });
    } catch (error) {
        req.flash('error', 'Kullanıcılar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Yeni Kullanıcı Ekleme Sayfası
router.get('/kullanici-ekle', adminKontrol, (req, res) => {
    res.render('admin/uye_ekle', {
        title: 'Yeni Kullanıcı Ekle',
        user: req.session.user
    });
});

// Yeni Kullanıcı Ekleme İşlemi
router.post('/kullanici-ekle', adminKontrol, async (req, res) => {
    try {
        const { email, sifre, isim, soyisim, rol } = req.body;

        // Email kontrolü
        const mevcutKullanici = await User.findOne({ email });
        if (mevcutKullanici) {
            req.flash('error', 'Bu email adresi zaten kullanılıyor');
            return res.redirect('/admin/kullanici-ekle');
        }

        // Şifre hashleme
        const hashedSifre = await bcrypt.hash(sifre, 10);

        // Yeni kullanıcı oluşturma
        const yeniKullanici = new User({
            email,
            sifre: hashedSifre,
            isim,
            soyisim,
            rol
        });

        await yeniKullanici.save();
        req.flash('success', 'Kullanıcı başarıyla eklendi');
        res.redirect('/admin/kullanicilar');
    } catch (error) {
        req.flash('error', 'Kullanıcı eklenirken bir hata oluştu');
        res.redirect('/admin/kullanici-ekle');
    }
});

// Kullanıcı Düzenleme Sayfası
router.get('/kullanici-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const kullanici = await User.findById(req.params.id);
        if (!kullanici) {
            req.flash('error', 'Kullanıcı bulunamadı');
            return res.redirect('/admin/kullanicilar');
        }

        res.render('admin/uye_duzenle', {
            title: 'Kullanıcı Düzenle',
            user: req.session.user,
            kullanici: kullanici
        });
    } catch (error) {
        req.flash('error', 'Kullanıcı yüklenirken bir hata oluştu');
        res.redirect('/admin/kullanicilar');
    }
});

// Kullanıcı Düzenleme İşlemi
router.post('/kullanici-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const { email, isim, soyisim, rol, sifre } = req.body;
        const kullanici = await User.findById(req.params.id);

        if (!kullanici) {
            req.flash('error', 'Kullanıcı bulunamadı');
            return res.redirect('/admin/kullanicilar');
        }

        // Email değişmişse kontrol et
        if (email !== kullanici.email) {
            const mevcutKullanici = await User.findOne({ email });
            if (mevcutKullanici) {
                req.flash('error', 'Bu email adresi zaten kullanılıyor');
                return res.redirect('/admin/kullanici-duzenle/' + req.params.id);
            }
        }

        kullanici.email = email;
        kullanici.isim = isim;
        kullanici.soyisim = soyisim;
        kullanici.rol = rol;

        // Şifre değiştirilmek isteniyorsa
        if (sifre) {
            kullanici.sifre = await bcrypt.hash(sifre, 10);
        }

        await kullanici.save();
        req.flash('success', 'Kullanıcı başarıyla güncellendi');
        res.redirect('/admin/kullanicilar');
    } catch (error) {
        req.flash('error', 'Kullanıcı güncellenirken bir hata oluştu');
        res.redirect('/admin/kullanici-duzenle/' + req.params.id);
    }
});

// Kullanıcı Silme
router.post('/kullanici-sil/:id', adminKontrol, async (req, res) => {
    try {
        const kullanici = await User.findById(req.params.id);
        if (!kullanici) {
            req.flash('error', 'Kullanıcı bulunamadı');
            return res.redirect('/admin/kullanicilar');
        }

        // Kendini silmeye çalışıyorsa engelle
        if (kullanici._id.toString() === req.session.user._id.toString()) {
            req.flash('error', 'Kendinizi silemezsiniz');
            return res.redirect('/admin/kullanicilar');
        }

        await kullanici.deleteOne();
        req.flash('success', 'Kullanıcı başarıyla silindi');
        res.redirect('/admin/kullanicilar');
    } catch (error) {
        req.flash('error', 'Kullanıcı silinirken bir hata oluştu');
        res.redirect('/admin/kullanicilar');
    }
});

// Üye Durum Değiştirme
router.post('/uye-durum-degistir/:id/:yeniDurum', adminKontrol, async (req, res) => {
    try {
        const uye = await User.findById(req.params.id);
        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/kullanicilar');
        }

        // Admin'in durumu değiştirilmeye çalışılıyorsa engelle
        if (uye.rol === 'admin') {
            req.flash('error', 'Admin kullanıcısının durumu değiştirilemez');
            return res.redirect('/admin/kullanicilar');
        }

        uye.rol = req.params.yeniDurum;
        await uye.save();

        let mesaj = '';
        switch(req.params.yeniDurum) {
            case 'aktif_uye':
                mesaj = 'Üye başarıyla aktifleştirildi';
                break;
            case 'pasif_uye':
                mesaj = 'Üye başarıyla pasifleştirildi';
                break;
            default:
                mesaj = 'Üye durumu güncellendi';
        }

        req.flash('success', mesaj);
        res.redirect('/admin/kullanicilar');
    } catch (error) {
        req.flash('error', 'Üye durumu değiştirilirken bir hata oluştu');
        res.redirect('/admin/kullanicilar');
    }
});

// Gruplar Listesi
router.get('/gruplar', adminKontrol, async (req, res) => {
    try {
        const gruplar = await Grup.find()
            .populate('uyeler', 'isim soyisim email')
            .populate('olusturanAdmin', 'isim soyisim')
            .sort({ isim: 1 });

        res.render('admin/gruplar', {
            title: 'Grup Yönetimi',
            user: req.session.user,
            gruplar: gruplar
        });
    } catch (error) {
        console.error('Gruplar listesi hatası:', error);
        req.flash('error', 'Gruplar yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Grup Ekleme Sayfası
router.get('/grup-ekle', adminKontrol, async (req, res) => {
    try {
        const uyeler = await User.find({ rol: 'aktif_uye' })
            .sort({ isim: 1, soyisim: 1 });

        res.render('admin/grup_ekle', {
            title: 'Yeni Grup Ekle',
            user: req.session.user,
            uyeler: uyeler
        });
    } catch (error) {
        req.flash('error', 'Sayfa yüklenirken bir hata oluştu');
        res.redirect('/admin/gruplar');
    }
});

// Grup Ekleme İşlemi
router.post('/grup-ekle', adminKontrol, async (req, res) => {
    try {
        const { isim, aciklama, uyeler } = req.body;
        
        const yeniGrup = new Grup({
            isim,
            aciklama,
            uyeler: Array.isArray(uyeler) ? uyeler : [uyeler],
            olusturanAdmin: req.session.user.id
        });

        await yeniGrup.save();
        req.flash('success', 'Grup başarıyla oluşturuldu');
        res.redirect('/admin/gruplar');
    } catch (error) {
        console.error('Grup oluşturma hatası:', error);
        req.flash('error', 'Grup oluşturulurken bir hata oluştu: ' + error.message);
        res.redirect('/admin/grup-ekle');
    }
});

// Grup Düzenleme Sayfası
router.get('/grup-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const grup = await Grup.findById(req.params.id);
        const uyeler = await User.find({ rol: 'aktif_uye' })
            .sort({ isim: 1, soyisim: 1 });

        if (!grup) {
            req.flash('error', 'Grup bulunamadı');
            return res.redirect('/admin/gruplar');
        }

        res.render('admin/grup_duzenle', {
            title: 'Grup Düzenle',
            user: req.session.user,
            grup: grup,
            uyeler: uyeler
        });
    } catch (error) {
        req.flash('error', 'Grup bilgileri yüklenirken bir hata oluştu');
        res.redirect('/admin/gruplar');
    }
});

// Grup Düzenleme İşlemi
router.post('/grup-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const { isim, aciklama, uyeler } = req.body;
        
        await Grup.findByIdAndUpdate(req.params.id, {
            isim,
            aciklama,
            uyeler: Array.isArray(uyeler) ? uyeler : [uyeler]
        });

        req.flash('success', 'Grup başarıyla güncellendi');
        res.redirect('/admin/gruplar');
    } catch (error) {
        req.flash('error', 'Grup güncellenirken bir hata oluştu');
        res.redirect(`/admin/grup-duzenle/${req.params.id}`);
    }
});

// Grup Silme İşlemi
router.post('/grup-sil/:id', adminKontrol, async (req, res) => {
    try {
        await Grup.findByIdAndDelete(req.params.id);
        req.flash('success', 'Grup başarıyla silindi');
        res.redirect('/admin/gruplar');
    } catch (error) {
        req.flash('error', 'Grup silinirken bir hata oluştu');
        res.redirect('/admin/gruplar');
    }
});

// Site Ayarları Sayfası
router.get('/ayarlar', adminKontrol, async (req, res) => {
    try {
        let ayarlar = await SiteAyar.findOne();
        if (!ayarlar) {
            await SiteAyar.varsayilanAyarlariOlustur();
            ayarlar = await SiteAyar.findOne();
        }

        res.render('admin/ayarlar', {
            title: 'Site Ayarları',
            user: req.session.user,
            ayarlar: ayarlar
        });
    } catch (error) {
        console.error('Site ayarları sayfası hatası:', error);
        req.flash('error', 'Site ayarları yüklenirken bir hata oluştu');
        res.redirect('/admin');
    }
});

// Site Ayarları Güncelleme
router.post('/ayarlar', adminKontrol, upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), async (req, res) => {
    try {
        let ayarlar = await SiteAyar.findOne();
        if (!ayarlar) {
            await SiteAyar.varsayilanAyarlariOlustur();
            ayarlar = await SiteAyar.findOne();
        }

        // Temel bilgileri güncelle
        ayarlar.siteBaslik = req.body.siteBaslik;
        ayarlar.siteAciklama = req.body.siteAciklama;
        ayarlar.iletisimEmail = req.body.iletisimEmail;
        ayarlar.iletisimTelefon = req.body.iletisimTelefon;
        ayarlar.adres = req.body.adres;

        // Sosyal medya bilgilerini güncelle
        ayarlar.sosyalMedya = {
            facebook: req.body.facebook,
            twitter: req.body.twitter,
            instagram: req.body.instagram,
            youtube: req.body.youtube
        };

        // Modül durumlarını güncelle
        ayarlar.metaverseAktif = req.body.metaverseAktif === 'on';
        ayarlar.kayitAktif = req.body.kayitAktif === 'on';
        ayarlar.duyuruAktif = req.body.duyuruAktif === 'on';
        ayarlar.etkinlikAktif = req.body.etkinlikAktif === 'on';
        ayarlar.anilarAktif = req.body.anilarAktif === 'on';

        // Logo yüklendiyse güncelle
        if (req.files.logo) {
            const logoData = fs.readFileSync(req.files.logo[0].path);
            ayarlar.logo = {
                data: logoData,
                contentType: req.files.logo[0].mimetype,
                base64: `data:${req.files.logo[0].mimetype};base64,${logoData.toString('base64')}`
            };
            fs.unlinkSync(req.files.logo[0].path);
        }

        // Favicon yüklendiyse güncelle
        if (req.files.favicon) {
            const faviconData = fs.readFileSync(req.files.favicon[0].path);
            ayarlar.favicon = {
                data: faviconData,
                contentType: req.files.favicon[0].mimetype,
                base64: `data:${req.files.favicon[0].mimetype};base64,${faviconData.toString('base64')}`
            };
            fs.unlinkSync(req.files.favicon[0].path);
        }

        await ayarlar.save();
        req.flash('success', 'Site ayarları başarıyla güncellendi');
        res.redirect('/admin/ayarlar');
    } catch (error) {
        console.error('Site ayarları güncelleme hatası:', error);
        req.flash('error', 'Site ayarları güncellenirken bir hata oluştu');
        res.redirect('/admin/ayarlar');
    }
});

module.exports = router; 