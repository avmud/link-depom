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

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v7: Kısayol ve Yorumlar Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
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

// YENİ: Yorum Modeli
const Comment = mongoose.model('Comment', {
    kisayolId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    icerik: String,
    tarih: { type: Date, default: Date.now }
});

const LinkList = mongoose.model('LinkList', {
    isim: String,
    aciklama: String,
    olusturan: mongoose.Schema.Types.ObjectId,
    olusturanAd: String,
    ortaklar: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    tarih: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, domain: String,
    etiketler: [String],
    kategori: { type: String, default: "Genel" }, // YENİ: Kategori Alanı
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    listeId: { type: mongoose.Schema.Types.ObjectId, default: null },
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

// --- YORUM ROTALARI ---
app.get('/comments/:id', async (req, res) => {
    const comments = await Comment.find({ kisayolId: req.params.id }).sort({ tarih: 1 });
    res.json(comments);
});

app.post('/comments', auth, async (req, res) => {
    const { kisayolId, icerik } = req.body;
    const comment = new Comment({
        kisayolId, icerik,
        userId: req.userData.userId,
        userName: req.userData.username
    });
    await comment.save();

    // Kısayol sahibine bildirim gönder
    const target = await Link.findById(kisayolId);
    if(target.userId.toString() !== req.userData.userId.toString()) {
        await new Notification({
            aliciId: target.userId,
            gonderenAd: req.userData.username,
            mesaj: "kısayoluna yorum yaptı.",
            tip: "yorum"
        }).save();
    }
    res.json(comment);
});

// --- VERİ ROTALARI (GÜNCELLENDİ) ---
app.post('/data', auth, async (req, res) => {
    const { baslik, url, aciklama, etiketler, kategori } = req.body;
    const domain = new URL(url).hostname.replace('www.', '');
    const link = new Link({
        baslik, url, aciklama, domain, kategori,
        etiketler: etiketler ? etiketler.split(',').map(e => e.trim()) : [],
        userId: req.userData.userId,
        userName: req.userData.username
    });
    await link.save();
    res.json({ success: true });
});

app.get('/data', async (req, res) => {
    const { mod, user, listId, q, kategori } = req.query;
    let query = {};
    if (q) query.$or = [{ baslik: { $regex: q, $options: 'i' } }, { etiketler: { $in: [new RegExp(q, 'i')] } }];
    if (kategori && kategori !== "Hepsi") query.kategori = kategori;
    
    if (mod === 'takip' && user) {
        const u = await User.findById(user);
        query.userId = { $in: u.takipEdilenler };
    } else if (mod === 'liste' && listId) query.listeId = listId;
    
    const sort = mod === 'trend' ? { beğeniSayisi: -1 } : { tarih: -1 };
    const links = await Link.find(query).sort(sort).limit(50);
    res.json({ links });
});

// ... (Auth, Takip, Beğeni ve Bildirim rotaları v6 ile aynı) ...
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
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id });
});
app.get('/notifications', auth, async (req, res) => {
    const notifs = await Notification.find({ aliciId: req.userData.userId }).sort({ tarih: -1 }).limit(10);
    res.json(notifs);
});
app.post('/like/:id', auth, async (req, res) => {
    const link = await Link.findById(req.params.id);
    const userId = req.userData.userId;
    if (link.beğeniler.includes(userId)) link.beğeniler = link.beğeniler.filter(id => id.toString() !== userId.toString());
    else link.beğeniler.push(userId);
    link.beğeniSayisi = link.beğeniler.length;
    await link.save();
    res.json({ count: link.beğeniSayisi });
});

app.use(express.static(__dirname));
app.listen(process.env.PORT || 10000);