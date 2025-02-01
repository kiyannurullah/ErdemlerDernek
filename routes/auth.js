const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Middleware - Admin kontrolü
const adminKontrol = (req, res, next) => {
    if (req.session.user && req.session.user.rol === 'admin') {
        next();
    } else {
        req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
        res.redirect('/');
    }
};

// Middleware - Giriş kontrolü
const girisKontrol = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.flash('error', 'Bu sayfayı görüntülemek için giriş yapmalısınız');
        res.redirect('/giris');
    }
};

// Profil Sayfası
router.get('/profil', girisKontrol, async (req, res) => {
    try {
        const kullanici = await User.findById(req.session.user.id);
        res.render('profil', {
            title: 'Profilim',
            user: req.session.user,
            kullanici: kullanici
        });
    } catch (error) {
        req.flash('error', 'Profil bilgileri yüklenirken bir hata oluştu');
        res.redirect('/');
    }
});

// Admin Panel
router.get('/admin/panel', adminKontrol, (req, res) => {
    res.render('admin/panel', {
        title: 'Admin Paneli',
        user: req.session.user
    });
});

// Üye Kayıt Sayfası
router.get('/kayit', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/kayit', {
        title: 'Kayıt Ol',
        user: req.session.user
    });
});

// Üye Kayıt İşlemi
router.post('/kayit', async (req, res) => {
    try {
        const { isim, soyisim, email, sifre, sifreTekrar } = req.body;

        // Şifre kontrolü
        if (sifre !== sifreTekrar) {
            req.flash('error', 'Şifreler eşleşmiyor');
            return res.redirect('/auth/kayit');
        }

        // E-posta kontrolü
        const uyeVarMi = await User.findOne({ email });
        if (uyeVarMi) {
            req.flash('error', 'Bu e-posta adresi zaten kullanımda');
            return res.redirect('/auth/kayit');
        }

        // Şifreyi hashle
        const hashedSifre = await bcrypt.hash(sifre, 10);

        // Yeni üye oluştur
        const yeniUye = new User({
            isim,
            soyisim,
            email,
            sifre: hashedSifre,
            rol: 'beklemede'
        });

        await yeniUye.save();
        req.flash('success', 'Kaydınız başarıyla oluşturuldu. Hesabınız onaylandıktan sonra giriş yapabilirsiniz.');
        res.redirect('/giris');
    } catch (error) {
        req.flash('error', 'Kayıt olurken bir hata oluştu: ' + error.message);
        res.redirect('/auth/kayit');
    }
});

// Giriş Sayfası
router.get('/giris', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/giris', {
        title: 'Giriş Yap',
        user: req.session.user
    });
});

// Giriş İşlemi
router.post('/giris', async (req, res) => {
    try {
        const { email, sifre } = req.body;
        const uye = await User.findOne({ email });

        if (!uye) {
            req.flash('error', 'E-posta veya şifre hatalı');
            return res.redirect('/auth/giris');
        }

        const sifreEslesti = await bcrypt.compare(sifre, uye.sifre);
        if (!sifreEslesti) {
            req.flash('error', 'E-posta veya şifre hatalı');
            return res.redirect('/auth/giris');
        }

        if (uye.rol === 'beklemede') {
            req.flash('error', 'Hesabınız henüz onaylanmamış. Lütfen onay için bekleyin.');
            return res.redirect('/auth/giris');
        }

        if (uye.rol === 'pasif') {
            req.flash('error', 'Hesabınız pasif durumda. Lütfen yönetici ile iletişime geçin.');
            return res.redirect('/auth/giris');
        }

        req.session.user = {
            id: uye._id,
            isim: uye.isim,
            soyisim: uye.soyisim,
            email: uye.email,
            rol: uye.rol
        };

        req.flash('success', 'Başarıyla giriş yaptınız');
        res.redirect('/');
    } catch (error) {
        req.flash('error', 'Giriş yapılırken bir hata oluştu');
        res.redirect('/auth/giris');
    }
});

// Admin Ekleme Sayfası
router.get('/admin/admin_ekle', adminKontrol, (req, res) => {
    res.render('admin/admin_ekle', {
        title: 'Yeni Admin Ekle',
        user: req.session.user
    });
});

// Admin Ekleme İşlemi
router.post('/admin/admin_ekle', adminKontrol, async (req, res) => {
    try {
        const { isim, soyisim, tcNo, email, aileLakabi, sifre } = req.body;
        
        const user = new User({
            isim,
            soyisim,
            tcNo,
            email,
            aileLakabi,
            sifre,
            rol: 'admin'
        });

        await user.save();
        req.flash('success', 'Admin başarıyla eklendi');
        res.redirect('/admin/panel');
    } catch (error) {
        req.flash('error', 'Admin eklenirken bir hata oluştu: ' + error.message);
        res.redirect('/admin/admin_ekle');
    }
});

// Çıkış İşlemi
router.post('/cikis', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Oturum sonlandırılırken hata oluştu:', err);
        }
        res.redirect('/');
    });
});

// Üye Yönetimi Sayfası
router.get('/admin/uyeler', adminKontrol, async (req, res) => {
    try {
        const bekleyenUyeler = await User.find({ uyelikDurumu: 'beklemede' }).sort({ kayitTarihi: -1 });
        const tumUyeler = await User.find().sort({ kayitTarihi: -1 });

        res.render('admin/uyeler', {
            title: 'Üye Yönetimi',
            user: req.session.user,
            bekleyenUyeler,
            tumUyeler
        });
    } catch (error) {
        req.flash('error', 'Üye listesi yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Üyelik Onaylama
router.post('/admin/uye-onayla/:id', adminKontrol, async (req, res) => {
    try {
        const uye = await User.findByIdAndUpdate(
            req.params.id,
            { uyelikDurumu: 'onaylandı' },
            { new: true }
        );

        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        req.flash('success', 'Üyelik başarıyla onaylandı');
        res.redirect('/admin/uyeler');
    } catch (error) {
        req.flash('error', 'Üyelik onaylanırken bir hata oluştu');
        res.redirect('/admin/uyeler');
    }
});

// Üyelik Reddetme
router.post('/admin/uye-reddet/:id', adminKontrol, async (req, res) => {
    try {
        const uye = await User.findByIdAndUpdate(
            req.params.id,
            { uyelikDurumu: 'reddedildi' },
            { new: true }
        );

        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        req.flash('success', 'Üyelik başvurusu reddedildi');
        res.redirect('/admin/uyeler');
    } catch (error) {
        req.flash('error', 'İşlem sırasında bir hata oluştu');
        res.redirect('/admin/uyeler');
    }
});

// Üye Düzenleme Sayfası
router.get('/admin/uye-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const uye = await User.findById(req.params.id);
        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        res.render('admin/uye_duzenle', {
            title: 'Üye Düzenle',
            user: req.session.user,
            uye: uye
        });
    } catch (error) {
        req.flash('error', 'Üye bilgileri yüklenirken bir hata oluştu');
        res.redirect('/admin/uyeler');
    }
});

// Üye Düzenleme İşlemi
router.post('/admin/uye-duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const { isim, soyisim, tcNo, email, aileLakabi, rol, uyelikDurumu } = req.body;
        
        const uye = await User.findById(req.params.id);
        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        // Güncelleme işlemi
        uye.isim = isim;
        uye.soyisim = soyisim;
        uye.tcNo = tcNo;
        uye.email = email;
        uye.aileLakabi = aileLakabi;
        uye.rol = rol;
        uye.uyelikDurumu = uyelikDurumu;

        await uye.save();
        req.flash('success', 'Üye bilgileri başarıyla güncellendi');
        res.redirect('/admin/uyeler');
    } catch (error) {
        req.flash('error', 'Güncelleme sırasında bir hata oluştu: ' + error.message);
        res.redirect(`/admin/uye-duzenle/${req.params.id}`);
    }
});

// Üye Durumu Değiştirme
router.post('/admin/uye-durum-degistir/:id/:yeniDurum', adminKontrol, async (req, res) => {
    try {
        const { id, yeniDurum } = req.params;
        
        // Geçerli durum kontrolü
        if (!['aktif_uye', 'pasif_uye', 'admin', 'beklemede'].includes(yeniDurum)) {
            req.flash('error', 'Geçersiz üyelik durumu');
            return res.redirect('/admin/uyeler');
        }

        const uye = await User.findById(id);
        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        // Admin'in durumu değiştirilemez kontrolü
        if (uye.rol === 'admin' && yeniDurum !== 'admin') {
            req.flash('error', 'Admin üyelerin durumu değiştirilemez');
            return res.redirect('/admin/uyeler');
        }

        uye.rol = yeniDurum;
        await uye.save();

        let mesaj = '';
        switch(yeniDurum) {
            case 'aktif_uye':
                mesaj = 'Üye başarıyla aktifleştirildi';
                break;
            case 'pasif_uye':
                mesaj = 'Üye pasif duruma alındı';
                break;
            case 'beklemede':
                mesaj = 'Üye bekleme durumuna alındı';
                break;
            case 'admin':
                mesaj = 'Kullanıcı admin olarak atandı';
                break;
        }

        req.flash('success', mesaj);
        res.redirect('/admin/uyeler');
    } catch (error) {
        req.flash('error', 'İşlem sırasında bir hata oluştu: ' + error.message);
        res.redirect('/admin/uyeler');
    }
});

// Profil Düzenleme Sayfası
router.get('/profil/duzenle', girisKontrol, async (req, res) => {
    try {
        const kullanici = await User.findById(req.session.user.id);
        res.render('profil_duzenle', {
            title: 'Profil Düzenle',
            user: req.session.user,
            kullanici: kullanici
        });
    } catch (error) {
        req.flash('error', 'Profil bilgileri yüklenirken bir hata oluştu');
        res.redirect('/profil');
    }
});

// Profil Düzenleme İşlemi
router.post('/profil/duzenle', girisKontrol, async (req, res) => {
    try {
        const { isim, soyisim, tcNo, email, aileLakabi } = req.body;
        
        // Email değişikliği varsa, başka kullanıcıda kullanılıyor mu kontrol et
        if (email !== req.session.user.email) {
            const emailKontrol = await User.findOne({ email, _id: { $ne: req.session.user.id } });
            if (emailKontrol) {
                req.flash('error', 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor');
                return res.redirect('/profil/duzenle');
            }
        }

        // TC No değişikliği varsa, başka kullanıcıda kullanılıyor mu kontrol et
        if (tcNo !== req.session.user.tcNo) {
            const tcNoKontrol = await User.findOne({ tcNo, _id: { $ne: req.session.user.id } });
            if (tcNoKontrol) {
                req.flash('error', 'Bu TC Kimlik numarası başka bir kullanıcı tarafından kullanılıyor');
                return res.redirect('/profil/duzenle');
            }
        }

        const kullanici = await User.findById(req.session.user.id);
        kullanici.isim = isim;
        kullanici.soyisim = soyisim;
        kullanici.tcNo = tcNo;
        kullanici.email = email;
        kullanici.aileLakabi = aileLakabi;

        await kullanici.save();

        // Session'ı güncelle
        req.session.user.isim = isim;
        req.session.user.email = email;

        req.flash('success', 'Profil bilgileriniz başarıyla güncellendi');
        res.redirect('/profil');
    } catch (error) {
        req.flash('error', 'Güncelleme sırasında bir hata oluştu: ' + error.message);
        res.redirect('/profil/duzenle');
    }
});

// Şifre Değiştirme Sayfası
router.get('/profil/sifre-degistir', girisKontrol, (req, res) => {
    res.render('sifre_degistir', {
        title: 'Şifre Değiştir',
        user: req.session.user
    });
});

// Şifre Değiştirme İşlemi
router.post('/profil/sifre-degistir', girisKontrol, async (req, res) => {
    try {
        const { mevcutSifre, yeniSifre, yeniSifreTekrar } = req.body;

        // Yeni şifrelerin eşleşme kontrolü
        if (yeniSifre !== yeniSifreTekrar) {
            req.flash('error', 'Yeni şifreler eşleşmiyor');
            return res.redirect('/profil/sifre-degistir');
        }

        const kullanici = await User.findById(req.session.user.id);
        
        // Mevcut şifre kontrolü
        const sifreDogruMu = await kullanici.sifreKontrol(mevcutSifre);
        if (!sifreDogruMu) {
            req.flash('error', 'Mevcut şifreniz hatalı');
            return res.redirect('/profil/sifre-degistir');
        }

        // Yeni şifre uzunluk kontrolü
        if (yeniSifre.length < 6) {
            req.flash('error', 'Yeni şifreniz en az 6 karakter olmalıdır');
            return res.redirect('/profil/sifre-degistir');
        }

        // Şifreyi güncelle
        kullanici.sifre = yeniSifre;
        await kullanici.save();

        req.flash('success', 'Şifreniz başarıyla değiştirildi');
        res.redirect('/profil');
    } catch (error) {
        req.flash('error', 'Şifre değiştirme sırasında bir hata oluştu');
        res.redirect('/profil/sifre-degistir');
    }
});

module.exports = router; 