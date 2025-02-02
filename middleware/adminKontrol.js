module.exports = (req, res, next) => {
    console.log('Admin kontrol middleware çalıştı');
    console.log('Session:', req.session);
    console.log('Kullanıcı:', req.session.user);

    // Session kontrolü
    if (!req.session || !req.session.user) {
        console.log('Oturum bulunamadı');
        req.flash('error', 'Bu sayfaya erişmek için giriş yapmalısınız');
        return res.redirect('/giris');
    }

    // Admin rolü kontrolü
    if (req.session.user.rol !== 'admin') {
        console.log('Kullanıcı admin değil:', req.session.user.rol);
        req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
        return res.redirect('/');
    }

    console.log('Admin erişimi onaylandı');
    next();
}; 