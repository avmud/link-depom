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

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v15: Bildirimler & Bülten Aktif!"));

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
    linkId: mongoose.Schema.Types.ObjectId, userId: mongoose.Schema.Types.ObjectId,
    userName: String, icerik: String, tarih: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', {
    targetUserId: mongoose.Schema.Types.ObjectId, // Bildirimi alan
    fromUserName: String, // Bildirimi tetikleyen
    type: String, // 'follow', 'comment'
    message: String,
    isRead: { type: Boolean, default: false },
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

// --- BİLDİRİM ROTALARI ---
app.get('/notifications', auth, async (req, res) => {
    const notes = await Notification.find({ targetUserId: req.userData.userId }).sort({ tarih: -1 }).limit(20);
    res.json(notes);
});

app.post('/notifications/read', auth, async (req, res) => {
    await Notification.updateMany({ targetUserId: req.userData.userId }, { isRead: true });
    res.json({ success: true });
});

// --- POPÜLER BÜLTEN ROTASI ---
app.get('/newsletter/popular', async (req, res) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const popularLinks = await Link.find({ tarih: { $gte: oneWeekAgo } })
        .sort({ beğeniSayisi: -1 })
        .limit(5)
        .lean();
    res.json(popularLinks);
});

// --- YORUM VE TAKİP (BİLDİRİM ENTEGRELİ) ---
app.post('/comments', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const comment = new Comment({ ...req.body, userId: req.userData.userId, userName: req.userData.username });
    await comment.save();

    // Bildirim oluştur
    const link = await Link.findById(req.body.linkId);
    if (link.userId.toString() !== req.userData.userId) {
        await new Notification({
            targetUserId: link.userId,
            fromUserName: req.userData.username,
            type: 'comment',
            message: `${req.userData.username} paylaşımına yorum yaptı: "${req.body.icerik.substring(0,20)}..."`
        }).save();
    }
    res.json({ success: true });
});

app.post('/user/follow/:id', auth, async (req, res) => {
    const me = await User.findById(req.userData.userId);
    const targetId = req.params.id;
    
    if (me.following.includes(targetId)) {
        me.following.pull(targetId);
    } else {
        me.following.push(targetId);
        // Takip Bildirimi
        await new Notification({
            targetUserId: targetId,
            fromUserName: req.userData.username,
            type: 'follow',
            message: `${req.userData.username} seni takip etmeye başladı!`
        }).save();
    }
    await me.save();
    res.json({ success: true, following: me.following });
});

// Standart veri ve auth rotaları (v14 ile aynı)
app.get('/data', async (req, res) => {
    const { followOnly, userId } = req.query;
    let query = {};
    if (followOnly === 'true' && userId) {
        const user = await User.findById(userId);
        query.userId = { $in: user.following };
    }
    const links = await Link.find(query).sort({ tarih: -1 }).limit(40).lean();
    res.json({ links });
});

app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ error: "Hata" });
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id, following: user.following });
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));