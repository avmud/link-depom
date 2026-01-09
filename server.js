const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v8: Profil & Etiket Bulutu Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) }, // Profil fotosu için
    takipciler: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    takipEdilenler: { type: [mongoose.Schema.Types.ObjectId], default: [] }
});

const Notification = mongoose.model('Notification', {
    aliciId: mongoose.Schema.Types.ObjectId,
    gonderenAd: String,
    mesaj: String,
    tip: String,
    okundu: { type: Boolean, default: false },
    tarih: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', {
    kisayolId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    avatar: String,
    icerik: String,
    tarih: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, domain: String,
    etiketler: [String],
    kategori: { type: String, default: "Genel" },
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userAvatar: String, // Kısayolda avatar saklama
    beğeniler: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    beğeniSayisi: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

// --- AUTH MIDDLEWARE ---
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.userData = jwt.verify(token, SECRET_KEY);
        next();
    } catch (e) { return res.status(401).json({ error: "Yetkisiz" }); }
};

// --- YENİ: ETİKET BULUTU ROTA ---
app.get('/tags/popular', async (req, res) => {
    const links = await Link.find({}, 'etiketler');
    const tagCounts = {};
    links.forEach(l => {
        l.etiketler.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(t => t[0]);
    res.json(sortedTags);
});

// --- DİĞER ROTALAR (GÜNCELLENMİŞ) ---
app.post('/data', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const { baslik, url, aciklama, etiketler, kategori } = req.body;
    const domain = new URL(url).hostname.replace('www.', '');
    const link = new Link({
        baslik, url, aciklama, domain, kategori,
        etiketler: etiketler ? etiketler.split(',').map(e => e.trim().toLowerCase()) : [],
        userId: req.userData.userId,
        userName: req.userData.username,
        userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`
    });
    await link.save();
    res.json({ success: true });
});

app.get('/data', async (req, res) => {
    const { mod, q, kategori, tag } = req.query;
    let query = {};
    if (q) query.$or = [{ baslik: { $regex: q, $options: 'i' } }];
    if (tag) query.etiketler = tag.toLowerCase();
    if (kategori && kategori !== "Hepsi") query.kategori = kategori;
    
    const links = await Link.find(query).sort({ tarih: -1 }).limit(50);
    res.json({ links });
});

app.post('/auth/register', async (req, res) => {
    const { email, password, username } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ email, password: hashedPassword, username }).save();
    res.json({ success: true });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Hatalı!" });
    const token = jwt.sign({ userId: user._id, username: user.username, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}` }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}` });
});

app.get('/comments/:id', async (req, res) => {
    const comments = await Comment.find({ kisayolId: req.params.id }).sort({ tarih: 1 });
    res.json(comments);
});

app.post('/comments', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const comment = new Comment({
        kisayolId: req.body.kisayolId,
        icerik: req.body.icerik,
        userId: req.userData.userId,
        userName: req.userData.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`
    });
    await comment.save();
    res.json(comment);
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));