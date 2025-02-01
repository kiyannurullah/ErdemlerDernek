const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const User = require('./models/User');
require('dotenv').config();

const app = express();

// View engine ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'erdemler-dernegi-gizli-anahtar',
    resave: true,
    saveUninitialized: true
}));
app.use(flash());

// Global değişkenler
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = {
        success: req.flash('success'),
        error: req.flash('error')
    };
    next();
});

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/erdemler-dernegi')
    .then(() => console.log('MongoDB bağlantısı başarılı'))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

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

// Routes
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Ana sayfa route'u
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Ana Sayfa',
        user: req.session.user
    });
});

// Profil sayfası
app.get('/profil', girisKontrol, async (req, res) => {
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

// Profil düzenleme sayfası
app.get('/profil/duzenle', girisKontrol, async (req, res) => {
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

// Şifre değiştirme sayfası
app.get('/profil/sifre-degistir', girisKontrol, (req, res) => {
    res.render('sifre_degistir', {
        title: 'Şifre Değiştir',
        user: req.session.user
    });
});

// Admin panel
app.get('/admin/panel', adminKontrol, (req, res) => {
    res.render('admin/panel', {
        title: 'Admin Paneli',
        user: req.session.user
    });
});

// Çıkış işlemi
app.post('/cikis', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Oturum sonlandırılırken hata oluştu:', err);
        }
        res.redirect('/');
    });
});

// Server başlatma
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 