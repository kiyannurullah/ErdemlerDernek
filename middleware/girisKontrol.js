module.exports = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Bu sayfaya erişmek için giriş yapmalısınız');
        return res.redirect('/giris');
    }
    next();
}; 