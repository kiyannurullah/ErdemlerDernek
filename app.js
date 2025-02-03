require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const User = require('./models/User');
const Aidat = require('./models/Aidat');

const app = express();

// MongoDB Bağlantısı
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB bağlantısı başarılı');
}).catch((err) => {
    console.error('MongoDB bağlantı hatası:', err);
});

// Session Ayarları
app.use(session({
    secret: process.env.SESSION_SECRET || 'gizli-anahtar',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60, // 14 gün
        autoRemove: 'native',
        touchAfter: 24 * 3600 // 24 saat
    }),
    cookie: {
        secure: false, // Development ortamında false olmalı
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 gün
        sameSite: 'lax',
        path: '/'
    },
    name: 'erdemlerSession'
}));

// Flash mesajları
app.use(flash());

// View engine ayarları
app.set('view engine', 'ejs');
app.use(expressLayouts);

// Statik dosyalar
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Global middleware - session ve flash mesajları
app.use((req, res, next) => {
    // Session kontrolü
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    
    // Session bilgilerini logla
    if (req.session.user) {
        console.log('Session aktif:', {
            id: req.session.user.id,
            email: req.session.user.email,
            rol: req.session.user.rol,
            isAuthenticated: res.locals.isAuthenticated,
            locals_user: res.locals.user ? 'var' : 'yok'
        });
    }

    // Flash mesajları
    res.locals.messages = {
        success: req.flash('success'),
        error: req.flash('error')
    };

    next();
});

// Rotalar
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const aniRoutes = require('./routes/ani');
const etkinlikRoutes = require('./routes/etkinlik');
const duyuruRoutes = require('./routes/duyuru');
const aidatRoutes = require('./routes/aidat');
const grupRoutes = require('./routes/grup');
const indexRoutes = require('./routes/index');
const metaverseRouter = require('./routes/metaverse');

// Route tanımlamaları
app.use('/', indexRoutes);
app.use('/', authRoutes); // Auth route'larını ana path'e taşıdık
app.use('/admin', adminRoutes);
app.use('/anilar', aniRoutes);
app.use('/etkinlikler', etkinlikRoutes);
app.use('/duyurular', duyuruRoutes);
app.use('/aidat', aidatRoutes);
app.use('/grup', grupRoutes);
app.use('/metaverse', metaverseRouter);

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
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 