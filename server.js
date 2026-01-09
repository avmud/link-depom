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

let feedCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 30000;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'linkup.destek@gmail.com',
        pass: 'uygulama_sifresi_buraya' 
    }
});

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v12: İstatistik Paneli Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    tarih: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, domain: String,
    etiketler: [String], kategori: { type: String, default: "Genel" },
    userId: mongoose.Schema.Types.ObjectId, userName: String, userAvatar: String,
    beğeniSayisi: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

// --- AUTH MIDDLEWARE ---
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.userData = jwt.verify(token, SECRET_KEY);
        next();
    } catch (e) { return res.status(401).json({ error: "Oturum geçersiz" }); }
};

// --- YENİ: İSTATİSTİK ROTASI ---
app.get('/user/stats', auth, async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.userData.userId);
    
    const stats = await Link.aggregate([
        { $match: { userId: userId } },
        { $group: {
            _id: null,
            toplamPaylasim: { $sum: 1 },
            toplamBegeni: { $sum: "$beğeniSayisi" },
            kategoriler: { $addToSet: "$kategori" }
        }}
    ]);

    const user = await User.findById(userId);
    
    res.json(stats[0] || { toplamPaylasim: 0, toplamBegeni: 0, kategoriler: [] });
});

// --- DİĞER ROTALAR ---
app.get('/data', async (req, res) => {
    const { q, tag, kategori } = req.query;
    if (!q && !tag && (!kategori || kategori === "Hepsi")) {
        if (feedCache && (Date.now() - lastCacheTime < CACHE_DURATION)) return res.json({ links: feedCache });
    }
    let query = {};
    if (q) query.baslik = { $regex: q, $options: 'i' };
    if (tag) query.etiketler = tag.toLowerCase();
    if (kategori && kategori !== "Hepsi") query.kategori = kategori;

    const links = await Link.find(query).sort({ tarih: -1 }).limit(50).lean();
    if (!q && !tag) { feedCache = links; lastCacheTime = Date.now(); }
    res.json({ links });
});

app.post('/data', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const { baslik, url, aciklama, etiketler, kategori } = req.body;
    const link = new Link({
        baslik, url, aciklama, kategori,
        domain: new URL(url).hostname.replace('www.', ''),
        etiketler: etiketler ? etiketler.split(',').map(e => e.trim().toLowerCase()) : [],
        userId: req.userData.userId, userName: req.userData.username,
        userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`
    });
    await link.save();
    feedCache = null;
    res.json({ success: true });
});

app.post('/auth/register', async (req, res) => {
    const { email, password, username } = req.body;
    const vToken = Math.random().toString(36).substring(2, 15);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, username, verificationToken: vToken });
    await user.save();
    res.json({ success: true });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Hatalı!" });
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}` });
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));