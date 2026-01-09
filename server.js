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

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v13: Sosyal Ağ & Akıllı Arama Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    avatarSeed: { type: String, default: () => Math.random().toString(36).substring(7) },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Takip edilenler
    followersCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false }
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, 
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

// --- AKILLI ARAMA ALGORİTMASI ---
app.get('/data', async (req, res) => {
    const { q, tag } = req.query;
    let query = {};
    
    if (q) {
        // Hem başlıkta hem etiketlerde ara
        query = {
            $or: [
                { baslik: { $regex: q, $options: 'i' } },
                { etiketler: { $in: [q.toLowerCase()] } }
            ]
        };
    } else if (tag) {
        query = { etiketler: tag.toLowerCase() };
    }

    // Akıllı Sıralama: Önce beğeni sayısı (popülerlik), sonra tarih
    const links = await Link.find(query)
        .sort({ beğeniSayisi: -1, tarih: -1 })
        .limit(40)
        .lean();
    
    res.json({ links });
});

// --- TAKİP SİSTEMİ ROTALARI ---
app.post('/user/follow/:id', auth, async (req, res) => {
    const targetId = req.params.id;
    const myId = req.userData.userId;

    if (targetId === myId) return res.status(400).json({ error: "Kendini takip edemezsin" });

    const me = await User.findById(myId);
    if (me.following.includes(targetId)) {
        // Takibi bırak
        me.following.pull(targetId);
        await User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } });
    } else {
        // Takip et
        me.following.push(targetId);
        await User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } });
    }
    await me.save();
    res.json({ success: true, following: me.following });
});

// --- DİĞER STANDART ROTALAR ---
app.post('/data', auth, async (req, res) => {
    const user = await User.findById(req.userData.userId);
    const { baslik, url, etiketler, kategori } = req.body;
    const link = new Link({
        baslik, url, kategori,
        etiketler: etiketler ? etiketler.split(',').map(e => e.trim().toLowerCase()) : [],
        userId: req.userData.userId, userName: req.userData.username,
        userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`
    });
    await link.save();
    res.json({ success: true });
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
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Hata" });
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`, following: user.following });
});

app.listen(process.env.PORT || 10000);
app.use(express.static(__dirname));