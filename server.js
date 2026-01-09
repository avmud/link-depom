const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI).then(() => console.log("🚀 Veritabanı Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    takipciler: [mongoose.Schema.Types.ObjectId],
    takipEdilenler: [mongoose.Schema.Types.ObjectId]
});

const LinkList = mongoose.model('LinkList', {
    isim: String,
    aciklama: String,
    olusturan: mongoose.Schema.Types.ObjectId,
    olusturanAd: String,
    ortaklar: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // YENİ: Ortak yazarlar
    tarih: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', {
    baslik: String, 
    url: String, 
    aciklama: String, 
    domain: String,
    etiketler: [String],
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    listeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    beğeniler: { type: [mongoose.Schema.Types.ObjectId], default: [] },
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

// --- ROTALAR ---

// AUTH
app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ email, password: hashedPassword, username }).save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Hata!" }); }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Hatalı!" });
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username, userId: user._id });
});

// BEĞENİ
app.post('/like/:id', auth, async (req, res) => {
    const link = await Link.findById(req.params.id);
    const userId = req.userData.userId;
    if (link.beğeniler.includes(userId)) {
        link.beğeniler = link.beğeniler.filter(id => id.toString() !== userId.toString());
    } else {
        link.beğeniler.push(userId);
    }
    await link.save();
    res.json({ count: link.beğeniler.length });
});

// LİSTEYE KOPYALAMA
app.post('/data/copy', auth, async (req, res) => {
    try {
        const { linkId, listeId } = req.body;
        const originalLink = await Link.findById(linkId);
        const newLink = new Link({
            ...originalLink._doc,
            _id: new mongoose.Types.ObjectId(),
            userId: req.userData.userId,
            userName: req.userData.username,
            listeId: listeId,
            beğeniler: [],
            tarih: Date.now()
        });
        await newLink.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Eklenemedi" }); }
});

// TAKİP
app.post('/user/follow/:id', auth, async (req, res) => {
    const targetId = req.params.id;
    const myId = req.userData.userId;
    await User.findByIdAndUpdate(myId, { $addToSet: { takipEdilenler: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { takipciler: myId } });
    res.json({ success: true });
});

// LİSTELER
app.post('/lists', auth, async (req, res) => {
    const { isim, aciklama } = req.body;
    await new LinkList({ isim, aciklama, olusturan: req.userData.userId, olusturanAd: req.userData.username }).save();
    res.json({ success: true });
});

// YENİ: Ortak olunan ve kendi listelerimi getir
app.get('/lists', auth, async (req, res) => {
    const lists = await LinkList.find({ 
        $or: [
            { olusturan: req.userData.userId },
            { ortaklar: req.userData.userId }
        ]
    });
    res.json({ lists });
});

// YENİ: Ortak yazar ekle
app.post('/lists/:id/add-collaborator', auth, async (req, res) => {
    try {
        const { username } = req.body;
        const targetUser = await User.findOne({ username });
        if (!targetUser) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
        
        await LinkList.findByIdAndUpdate(req.params.id, { 
            $addToSet: { ortaklar: targetUser._id } 
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

// VERİ EKLEME
app.post('/data', auth, async (req, res) => {
    const { baslik, url, aciklama, domain, etiketler } = req.body;
    await new Link({ 
        baslik, url, aciklama, domain, 
        etiketler: etiketler ? etiketler.split(',').map(e => e.trim()) : [],
        userId: req.userData.userId,
        userName: req.userData.username
    }).save();
    res.json({ success: true });
});

// VERİ ÇEKME (Filtreleme desteğiyle)
app.get('/data', async (req, res) => {
    const { mod, user, listId } = req.query;
    let query = {};

    if (mod === 'takip' && user) {
        const u = await User.findById(user);
        query = { userId: { $in: u.takipEdilenler } };
    } else if (mod === 'liste' && listId) {
        query = { listeId: listId };
    }
    
    const links = await Link.find(query).sort({ tarih: -1 });
    res.json({ links });
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile('index.html', { root: __dirname }));
app.listen(process.env.PORT || 10000, "0.0.0.0");