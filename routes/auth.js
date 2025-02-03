const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Aidat = require('../models/Aidat');
const mongoose = require('mongoose');

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
        let borcToplam = 0;
        let sonOdeme = null;
        let aylikAidat = 0;

        if (kullanici.rol === 'admin' || kullanici.rol === 'aktif_uye') {
            // Toplam borç hesaplama
            const borcSonuc = await Aidat.find({
                uye: new mongoose.Types.ObjectId(req.session.user.id),
                durum: 'Ödenmedi'
            });

            if (borcSonuc && borcSonuc.length > 0) {
                borcToplam = borcSonuc.reduce((toplam, aidat) => toplam + aidat.tutar, 0);
            }

            // Son ödeme bilgisi
            const sonOdenenAidat = await Aidat.findOne({
                uye: new mongoose.Types.ObjectId(req.session.user.id),
                durum: 'Ödendi'
            }).sort('-odemeTarihi');

            if (sonOdenenAidat && sonOdenenAidat.odemeTarihi) {
                sonOdeme = sonOdenenAidat.odemeTarihi;
            }

            // En son eklenen aidatın tutarını bul
            const enSonAidat = await Aidat.findOne({
                uye: new mongoose.Types.ObjectId(req.session.user.id)
            }).sort('-yil -ay');

            if (enSonAidat) {
                aylikAidat = enSonAidat.tutar;
            }
        }

        console.log('Aidat Bilgileri:', {
            borcToplam,
            sonOdeme: sonOdeme ? sonOdeme.toLocaleDateString('tr-TR') : '-',
            aylikAidat
        });

        res.render('profil', {
            title: 'Profilim',
            user: req.session.user,
            kullanici,
            borcToplam,
            sonOdeme,
            aylikAidat
        });
    } catch (error) {
        console.error('Profil bilgileri yüklenirken hata:', error);
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

// Kayıt Sayfası
router.get('/kayit', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/kayit', {
        title: 'Üye Ol',
        user: req.session.user
    });
});

// Kayıt İşlemi
router.post('/kayit', async (req, res) => {
    try {
        const { isim, soyisim, tcNo, email, aileLakabi, sifre, sifreTekrar } = req.body;

        // Tüm alanların dolu olduğunu kontrol et
        if (!isim || !soyisim || !tcNo || !email || !aileLakabi || !sifre || !sifreTekrar) {
            req.flash('error', 'Lütfen tüm alanları doldurun');
            return res.redirect('/kayit');
        }

        // TC No formatını kontrol et
        if (!/^[0-9]{11}$/.test(tcNo)) {
            req.flash('error', 'TC Kimlik No 11 haneli olmalıdır');
            return res.redirect('/kayit');
        }

        // Şifre kontrolü
        if (sifre !== sifreTekrar) {
            req.flash('error', 'Şifreler eşleşmiyor');
            return res.redirect('/kayit');
        }

        // Şifre uzunluğu kontrolü
        if (sifre.length < 6) {
            req.flash('error', 'Şifre en az 6 karakter olmalıdır');
            return res.redirect('/kayit');
        }

        // E-posta formatını kontrol et
        if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            req.flash('error', 'Geçerli bir e-posta adresi giriniz');
            return res.redirect('/kayit');
        }

        // E-posta kontrolü
        const mailKontrol = await User.findOne({ email });
        if (mailKontrol) {
            req.flash('error', 'Bu e-posta adresi zaten kullanımda');
            return res.redirect('/kayit');
        }

        // TC No kontrolü
        const tcKontrol = await User.findOne({ tcNo });
        if (tcKontrol) {
            req.flash('error', 'Bu TC Kimlik No zaten kayıtlı');
            return res.redirect('/kayit');
        }

        // Yeni üye oluştur
        const yeniUye = new User({
            isim,
            soyisim,
            tcNo,
            email,
            aileLakabi,
            sifre, // Model içinde otomatik hashlenecek
            rol: 'beklemede'
        });

        await yeniUye.save();
        
        req.flash('success', 'Kaydınız başarıyla oluşturuldu. Yönetici onayından sonra giriş yapabilirsiniz.');
        res.redirect('/giris');
    } catch (error) {
        console.error('Kayıt hatası:', error);
        req.flash('error', 'Kayıt olurken bir hata oluştu. Lütfen tüm bilgileri kontrol edip tekrar deneyin.');
        res.redirect('/kayit');
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

        const user = await User.findOne({ email });
        if (!user) {
            console.log('Kullanıcı bulunamadı:', email);
            req.flash('error', 'E-posta veya şifre hatalı');
            return res.redirect('/giris');
        }

        const sifreDogruMu = await bcrypt.compare(sifre, user.sifre);
        if (!sifreDogruMu) {
            console.log('Hatalı şifre denemesi:', email);
            req.flash('error', 'E-posta veya şifre hatalı');
            return res.redirect('/giris');
        }

        // Session'a kullanıcı bilgilerini ekle
        req.session.user = {
            id: user._id,
            email: user.email,
            isim: user.isim,
            soyisim: user.soyisim,
            rol: user.rol
        };

        // Session'ı kaydet
        req.session.save((err) => {
            if (err) {
                console.error('Session kayıt hatası:', err);
                req.flash('error', 'Giriş yapılırken bir hata oluştu');
                return res.redirect('/giris');
            }
            
            console.log('Başarılı giriş:', {
                id: user._id,
                email: user.email,
                rol: user.rol
            });
            
            if (user.rol === 'beklemede') {
                req.flash('warning', 'Hesabınız henüz onaylanmamış. Sınırlı erişiminiz var. Lütfen yönetici onayını bekleyin.');
            } else {
                req.flash('success', 'Başarıyla giriş yaptınız');
            }
            res.redirect('/');
        });

    } catch (error) {
        console.error('Giriş hatası:', error);
        req.flash('error', 'Giriş yapılırken bir hata oluştu');
        res.redirect('/giris');
    }
});

// Admin Ekleme Sayfası
router.get('/admin/kullanici-ekle', adminKontrol, (req, res) => {
    res.render('admin/admin_ekle', {
        title: 'Admin Ekle',
        user: req.session.user
    });
});

// Admin Ekleme İşlemi
router.post('/admin/kullanici-ekle', adminKontrol, async (req, res) => {
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
        res.redirect('/admin/kullanici-ekle');
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

// Üye Listesi
router.get('/admin/uyeler', adminKontrol, async (req, res) => {
    try {
        const kullanicilar = await User.find().sort({ kayitTarihi: -1 });
        res.render('admin/uyeler', {
            title: 'Üye Yönetimi',
            user: req.session.user,
            kullanicilar: kullanicilar
        });
    } catch (error) {
        console.error('Üye listesi hatası:', error);
        req.flash('error', 'Üyeler yüklenirken bir hata oluştu');
        res.redirect('/admin/panel');
    }
});

// Üye Durum Değiştirme
router.post('/admin/uye-durum-degistir/:id/:yeniDurum', adminKontrol, async (req, res) => {
    try {
        const uye = await User.findById(req.params.id);
        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        // Admin'in durumu değiştirilmeye çalışılıyorsa engelle
        if (uye.rol === 'admin') {
            req.flash('error', 'Admin kullanıcısının durumu değiştirilemez');
            return res.redirect('/admin/uyeler');
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
        res.redirect('/admin/uyeler');
    } catch (error) {
        console.error('Üye durum değiştirme hatası:', error);
        req.flash('error', 'Üye durumu değiştirilirken bir hata oluştu');
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

// Üye Silme
router.post('/admin/uye-sil/:id', adminKontrol, async (req, res) => {
    try {
        const uye = await User.findById(req.params.id);
        
        if (!uye) {
            req.flash('error', 'Üye bulunamadı');
            return res.redirect('/admin/uyeler');
        }

        // Admin kullanıcısının silinmesini engelle
        if (uye.rol === 'admin') {
            req.flash('error', 'Admin kullanıcısı silinemez');
            return res.redirect('/admin/uyeler');
        }

        await User.findByIdAndDelete(req.params.id);
        req.flash('success', 'Üye başarıyla silindi');
        res.redirect('/admin/uyeler');
    } catch (error) {
        console.error('Üye silme hatası:', error);
        req.flash('error', 'Üye silinirken bir hata oluştu');
        res.redirect('/admin/uyeler');
    }
});

module.exports = router; 