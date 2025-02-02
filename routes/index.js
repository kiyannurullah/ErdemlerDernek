const express = require('express');
const router = express.Router();
const Duyuru = require('../models/Duyuru');
const Etkinlik = require('../models/Etkinlik');

// Ana sayfa
router.get('/', async (req, res) => {
    try {
        const sonDuyurular = await Duyuru.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('ekleyenAdmin', 'isim soyisim');

        const sonEtkinlikler = await Etkinlik.find({ 
            tarih: { $gte: new Date() } 
        })
            .sort({ tarih: 1 })
            .limit(5)
            .populate('ekleyenAdmin', 'isim soyisim');

        res.render('index', {
            title: 'Ana Sayfa',
            user: req.session.user,
            sonDuyurular,
            sonEtkinlikler
        });
    } catch (err) {
        console.error('Ana sayfa yüklenirken hata:', err);
        res.render('index', {
            title: 'Ana Sayfa',
            user: req.session.user,
            sonDuyurular: [],
            sonEtkinlikler: []
        });
    }
});

module.exports = router; 