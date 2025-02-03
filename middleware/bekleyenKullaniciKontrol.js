module.exports = (req, res, next) => {
    if (req.session.user && req.session.user.rol !== 'beklemede') {
        next();
    } else if (req.session.user && req.session.user.rol === 'beklemede') {
        req.flash('warning', 'Bu sayfaya erişmek için hesabınızın onaylanması gerekiyor. Lütfen yönetici onayını bekleyin.');
        res.redirect('/');
    } else {
        req.flash('error', 'Bu sayfayı görüntülemek için giriş yapmalısınız');
        res.redirect('/auth/giris');
    }
}; 