const express = require('express');
const router = express.Router();

// Ana sayfa
router.get('/', (req, res) => {
    res.render('index', {
        title: 'Ana Sayfa',
        user: req.session.user
    });
});

module.exports = router; 