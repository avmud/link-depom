const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

// --- E-POSTA YAPILANDIRMASI ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'linkup.destek@gmail.com',
        pass: 'uygulama_sifresi_buraya' // Gmail uygulama şifreniz
    }
});

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v17: 2FA Güvenliği Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true },
    password: { type: String },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) },
    role: { type: String, default: 'user' },
    twoFactorCode: String, // 2FA Kodu için alan
    twoFactorExpire: Date
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, 
    etiketler: [String], kategori: String,
    userId: mongoose.Schema.Types.ObjectId, userName: String, userAvatar: String,
    tarih: { type: Date, default: Date.now }
});

// --- ROTALAR ---

// 1. ADIM: Giriş Girişimi ve 2FA Kodu Gönderme
app.post('/auth/login-step1', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "E-posta veya şifre hatalı!" });
    }

    // 6 haneli kod oluştur
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = otp;
    user.twoFactorExpire = Date.now() + 600000; // 10 dakika geçerli
    await user.save();

    // E-posta gönder
    await transporter.sendMail({
        from: '"LinkUp Güvenlik" <linkup.destek@gmail.com>',
        to: email,
        subject: "Giriş Doğrulama Kodunuz",
        html: `<h3>Güvenlik Kodu: <b>${otp}</b></h3><p>LinkUp'a giriş yapmak için bu kodu kullanın.</p>`
    });

    res.json({ success: true, message: "Doğrulama kodu gönderildi." });
});

// 2. ADIM: 2FA Kodu Doğrulama ve Token Verme
app.post('/auth/login-step2', async (req, res) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email, twoFactorCode: code });

    if (!user || user.twoFactorExpire < Date.now()) {
        return res.status(401).json({ error: "Geçersiz veya süresi dolmuş kod!" });
    }

    // Kod kullanıldı, temizle
    user.twoFactorCode = undefined;
    user.twoFactorExpire = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, SECRET_KEY);
    res.json({ 
        token, 
        username: user.username, 
        userId: user._id, 
        role: user.role, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}` 
    });
});

// Veri rotası (Profil, Admin ve Genel akış v16 ile aynı)
app.get('/data', async (req, res) => {
    const links = await Link.find().sort({ tarih: -1 }).limit(30).lean();
    res.json({ links });
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));