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

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v14: Yorumlar & Takip Akışı Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, 
    etiketler: [String], kategori: { type: String, default: "Genel" },
    userId: mongoose.Schema.Types.ObjectId, userName: String, userAvatar: String,
    beğeniSayisi: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', {
    linkId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    avatar: String,
    icerik: String,
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

// --- ROTALAR ---

// Akıllı Akış (Genel ve Takip Edilenler)
app.get('/data', async (req, res) => {
    const { q, followOnly, userId } = req.query;
    let query = {};

    if (followOnly === 'true' && userId) {
        const user = await User.findById(userId);
        query.userId = { $in: user.following };
    } else if (q) {
        query = { $or: [{ baslik: { $regex: q, $options: 'i' } }, { etiketler: { $in: [q.toLowerCase()] } }] };
    }

    const links = await Link.find(query).sort({ tarih: -1 }).limit(40).lean();
    res.json({ links });
});

// Yorum İşlemleri
app.post('/comments', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const comment = new Comment({
        linkId: req.body.linkId,
        userId: req.userData.userId,
        userName: req.userData.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`,
        icerik: req.body.icerik
    });
    await comment.save();
    res.json({ success: true, comment });
});

app.get('/comments/:linkId', async (req, res) => {
    const comments = await Comment.find({ linkId: req.params.linkId }).sort({ tarih: 1 }).lean();
    res.json(comments);
});

// Takip Sistemi
app.post('/user/follow/:id', auth, async (req, res) => {
    const me = await User.findById(req.userData.userId);
    if (me.following.includes(req.params.id)) {
        me.following.pull(req.params.id);
    } else {
        me.following.push(req.params.id);
    }
    await me.save();
    res.json({ success: true, following: me.following });
});

// Diğer Kayıt/Giriş ve Paylaşım Rotaları (v13 ile aynı)
app.post('/data', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const link = new Link({
        ...req.body,
        userId: req.userData.userId,
        userName: req.userData.username,
        userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`,
        etiketler: req.body.etiketler ? req.body.etiketler.split(',').map(e => e.trim().toLowerCase()) : []
    });
    await link.save();
    res.json({ success: true });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Hata" });
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id, following: user.following });
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));