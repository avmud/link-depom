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

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v16: Admin & Profil Sistemi Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true },
    password: { type: String },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) },
    role: { type: String, default: 'user' }, // 'user' veya 'admin'
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bio: { type: String, default: "LinkUp kullanıcısı" }
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, 
    etiketler: [String], kategori: String,
    userId: mongoose.Schema.Types.ObjectId, userName: String, userAvatar: String,
    beğeniSayisi: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', {
    targetUserId: mongoose.Schema.Types.ObjectId,
    fromUserName: String, message: String, isRead: { type: Boolean, default: false },
    tarih: { type: Date, default: Date.now }
});

// --- MIDDLEWARES ---
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.userData = jwt.verify(token, SECRET_KEY);
        next();
    } catch (e) { return res.status(401).json({ error: "Oturum geçersiz" }); }
};

const adminAuth = async (req, res, next) => {
    const user = await User.findById(req.userData.userId);
    if (user && user.role === 'admin') next();
    else res.status(403).json({ error: "Yetkisiz erişim" });
};

// --- ROTALAR ---

// 1. Profil Sayfası Verileri
app.get('/profile/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username }).select('-password');
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    const links = await Link.find({ userId: user._id }).sort({ tarih: -1 }).lean();
    res.json({ user, links });
});

// 2. Admin: Tüm İçerikleri Yönet
app.get('/admin/all-links', auth, adminAuth, async (req, res) => {
    const links = await Link.find().sort({ tarih: -1 }).lean();
    res.json(links);
});

app.delete('/admin/delete-link/:id', auth, adminAuth, async (req, res) => {
    await Link.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// 3. Genel Akış ve Filtreleme
app.get('/data', async (req, res) => {
    const { userId, followOnly } = req.query;
    let query = {};
    if (followOnly === 'true' && userId) {
        const user = await User.findById(userId);
        query.userId = { $in: user.following };
    }
    const links = await Link.find(query).sort({ tarih: -1 }).limit(30).lean();
    res.json({ links });
});

// Auth, Follow, Notification rotaları v15 ile aynı yapıda devam eder...
app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ error: "Hata" });
    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id, role: user.role, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}` });
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));