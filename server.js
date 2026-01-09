const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // Yeni paket

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

// --- E-POSTA YAPILANDIRMASI (Gmail örneği) ---
// Not: Gerçek kullanımda 'pass' kısmında Gmail "Uygulama Şifresi" kullanılmalıdır.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'linkup.destek@gmail.com', // Buraya kendi e-postanı yazabilirsin
        pass: 'uygulama_sifresi_buraya' 
    }
});

// --- MODELLER (GÜNCELLENDİ) ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) },
    isVerified: { type: Boolean, default: false }, // Onay durumu
    verificationToken: String,
    resetToken: String,
    resetTokenExpire: Date
});

// ... Link, Comment modelleri v9 ile aynı ...

// --- AUTH MIDDLEWARE (GÜNCEL) ---
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userData = decoded;
        next();
    } catch (e) { return res.status(401).json({ error: "Oturum geçersiz" }); }
};

// --- E-POSTA ROTALARI ---

// 1. Hesap Onaylama
app.get('/auth/verify/:token', async (req, res) => {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.send("<h1>Geçersiz Onay Linki</h1>");
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.send("<h1>Hesabınız Onaylandı!</h1><p>Artık LinkUp'a giriş yapabilirsiniz.</p>");
});

// 2. Şifre Sıfırlama İsteği
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "E-posta bulunamadı" });

    const token = Math.random().toString(36).substring(2, 15);
    user.resetToken = token;
    user.resetTokenExpire = Date.now() + 3600000; // 1 saat geçerli
    await user.save();

    const mailOptions = {
        from: 'LinkUp Destek',
        to: email,
        subject: 'LinkUp Şifre Sıfırlama',
        text: `Şifrenizi sıfırlamak için bu kodu kullanın: ${token}`
    };
    
    transporter.sendMail(mailOptions);
    res.json({ success: true, message: "E-posta gönderildi" });
});

// --- KAYIT ROTASI (ONAYLI) ---
app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const vToken = Math.random().toString(36).substring(2, 15);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({ 
            email, 
            password: hashedPassword, 
            username, 
            verificationToken: vToken 
        });
        await user.save();

        // Onay maili gönder
        const verifyUrl = `https://link-depom-sunucu.onrender.com/auth/verify/${vToken}`;
        transporter.sendMail({
            from: 'LinkUp Destek',
            to: email,
            subject: 'Hesabınızı Onaylayın',
            html: `LinkUp'a hoş geldin! <a href="${verifyUrl}">Buraya tıklayarak</a> hesabını onayla.`
        });

        res.json({ success: true, message: "Onay e-postası gönderildi" });
    } catch (e) { res.status(400).json({ error: "Kayıt hatası!" }); }
});

// ... Diğer rotalar (data, delete, put) v9 ile aynı ...

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));