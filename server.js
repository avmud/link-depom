const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- VERİTABANI ---
const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Veritabanı Aktif!"))
    .catch(err => console.error("❌ Veritabanı Hatası:", err));

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
    beğeniler: [mongoose.Schema.Types.ObjectId],
    tarih: { type: Date, default: Date.now }
});

// --- API ROTALARI ---

const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userData = decoded;
        next();
    } catch (e) { return res.status(401).json({ error: "Yetkisiz" }); }
};

app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, username });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Hata! Kullanıcı adı veya e-posta alınmış olabilir." }); }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Hatalı giriş!" });
    }
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username });
});

// TAKİP ETME
app.post('/user/follow/:id', auth, async (req, res) => {
    try {
        const targetId = req.params.id;
        const myId = req.userData.userId;
        if (targetId === myId) return res.status(400).json({ error: "Kendini takip edemezsin" });
        await User.findByIdAndUpdate(myId, { $addToSet: { takipEdilenler: targetId } });
        await User.findByIdAndUpdate(targetId, { $addToSet: { takipciler: myId } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

// LİSTE OLUŞTURMA
app.post('/lists', auth, async (req, res) => {
    try {
        const { isim, aciklama } = req.body;
        const newList = new LinkList({ isim, aciklama, olusturan: req.userData.userId, olusturanAd: req.userData.username });
        await newList.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

app.get('/lists', auth, async (req, res) => {
    const lists = await LinkList.find({ olusturan: req.userData.userId });
    res.json({ lists });
});

// VERİ KAYDETME
app.post('/data', auth, async (req, res) => {
    try {
        const { baslik, url, aciklama, domain, etiketler, listeId } = req.body;
        const newLink = new Link({ 
            baslik, url, aciklama, domain, 
            etiketler: etiketler ? etiketler.split(',').map(e => e.trim()) : [],
            userId: req.userData.userId,
            userName: req.userData.username,
            listeId: listeId || null
        });
        await newLink.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

// VERİ GETİRME (Filtreli)
app.get('/data', async (req, res) => {
    try {
        const { mod, user } = req.query;
        let query = {};
        
        if (mod === 'takip' && user) {
            const userData = await User.findById(user);
            query = { userId: { $in: userData.takipEdilenler } };
        }
        
        const links = await Link.find(query).sort({ tarih: -1 }).limit(50);
        res.json({ links });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

app.use(express.static(__dirname));
app.get('/google2907470659972352.html', (req, res) => { res.sendFile('google2907470659972352.html', { root: __dirname }); });
app.get('/', (req, res) => { res.sendFile('index.html', { root: __dirname }); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => { console.log(`🚀 Sunucu Hazır!`); });