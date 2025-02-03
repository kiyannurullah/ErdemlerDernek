const express = require('express');
const router = express.Router();
const User = require('../models/User');
const girisKontrol = require('../middleware/girisKontrol');

// Metaverse erişim kontrolü middleware
const metaverseErisimKontrol = (req, res, next) => {
    console.log('Metaverse erişim kontrolü - Kullanıcı:', {
        id: req.session.user?.id,
        email: req.session.user?.email,
        rol: req.session.user?.rol
    });

    if (!req.session.user || (req.session.user.rol !== 'admin' && req.session.user.rol !== 'aktif_uye')) {
        console.log('Metaverse erişimi reddedildi - Yetersiz yetki');
        req.flash('error', 'Metaverse\'e erişim için aktif üye veya admin olmalısınız');
        return res.redirect('/');
    }
    next();
};

// Metaverse Ana Sayfa - Giriş ve erişim kontrolü gerekli
router.get('/', girisKontrol, metaverseErisimKontrol, (req, res) => {
    // Eğer metaverse oturumu yoksa giriş sayfasına yönlendir
    if (!req.session.metaverseUser) {
        return res.render('metaverse/giris', {
            title: 'Metaverse Giriş',
            user: req.session.user
        });
    }
    
    // Metaverse ana sayfasına yönlendir
    res.render('metaverse/anasayfa', {
        title: 'Metaverse Ana Sayfa',
        user: req.session.user,
        metaverseUser: req.session.metaverseUser
    });
});

// Metaverse Giriş İşlemi
router.post('/giris', girisKontrol, metaverseErisimKontrol, async (req, res) => {
    try {
        const { email, sifre } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            req.flash('error', 'E-posta veya şifre hatalı');
            return res.redirect('/metaverse');
        }

        const sifreDogruMu = await user.sifreKontrol(sifre);
        if (!sifreDogruMu) {
            req.flash('error', 'E-posta veya şifre hatalı');
            return res.redirect('/metaverse');
        }

        // Metaverse oturumunu başlat
        req.session.metaverseUser = {
            id: user._id,
            email: user.email,
            isim: user.isim,
            soyisim: user.soyisim
        };

        req.flash('success', 'Metaverse\'e başarıyla giriş yaptınız');
        res.redirect('/metaverse');
    } catch (error) {
        console.error('Metaverse giriş hatası:', error);
        req.flash('error', 'Giriş yapılırken bir hata oluştu');
        res.redirect('/metaverse');
    }
});

// Metaverse Çıkış İşlemi
router.get('/cikis', girisKontrol, metaverseErisimKontrol, (req, res) => {
    delete req.session.metaverseUser;
    req.flash('success', 'Metaverse\'den başarıyla çıkış yaptınız');
    res.redirect('/metaverse');
});

module.exports = router; 