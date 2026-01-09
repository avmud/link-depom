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

mongoose.connect(MONGO_URI).then(() => console.log("🚀 LinkUp v6 Aktif!"));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true },
    takipciler: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    takipEdilenler: { type: [mongoose.Schema.Types.ObjectId], default: [] }
});

// YENİ: Bildirim Modeli
const Notification = mongoose.model('Notification', {
    aliciId: mongoose.Schema.Types.ObjectId,
    gonderenAd: String,
    mesaj: String,
    tip: String, // 'beğeni', 'takip', 'ortaklik'
    okundu: { type: Boolean, default: false },
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
    etiketler: [String], userId: mongoose.Schema.Types.ObjectId, userName: String,
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

// --- BİLDİRİM ROTALARI ---
app.get('/notifications', auth, async (req, res) => {
    const notifs = await Notification.find({ aliciId: req.userData.userId }).sort({ tarih: -1 }).limit(20);
    res.json(notifs);
});

app.post('/notifications/read', auth, async (req, res) => {
    await Notification.updateMany({ aliciId: req.userData.userId }, { okundu: true });
    res.json({ success: true });
});

// --- DİĞER ROTALAR (BİLDİRİM ENTEGRELİ) ---

app.post('/like/:id', auth, async (req, res) => {
    const link = await Link.findById(req.params.id);
    const userId = req.userData.userId;
    const isLiking = !link.beğeniler.includes(userId);

    if (isLiking) {
        link.beğeniler.push(userId);
        // Bildirim Gönder (Kendisi değilse)
        if (link.userId.toString() !== userId.toString()) {
            await new Notification({
                aliciId: link.userId,
                gonderenAd: req.userData.username,
                mesaj: "bir linkini beğendi!",
                tip: "beğeni"
            }).save();
        }
    } else {
        link.beğeniler = link.beğeniler.filter(id => id.toString() !== userId.toString());
    }
    link.beğeniSayisi = link.beğeniler.length;
    await link.save();
    res.json({ count: link.beğeniler.length });
});

app.post('/user/follow/:id', auth, async (req, res) => {
    const targetId = req.params.id;
    const myId = req.userData.userId;
    if(targetId === myId) return res.status(400).json({error: "Kendini takip edemezsin"});
    
    await User.findByIdAndUpdate(myId, { $addToSet: { takipEdilenler: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { takipciler: myId } });
    
    await new Notification({
        aliciId: targetId,
        gonderenAd: req.userData.username,
        mesaj: "seni takip etmeye başladı!",
        tip: "takip"
    }).save();

    res.json({ success: true });
});

app.get('/data', async (req, res) => {
    const { mod, user, listId, q } = req.query;
    let query = {}; let sort = { tarih: -1 };
    if (q) {
        query = { $or: [ { baslik: { $regex: q, $options: 'i' } }, { etiketler: { $in: [new RegExp(q, 'i')] } }, { domain: { $regex: q, $options: 'i' } } ] };
    }
    if (mod === 'takip' && user) {
        const u = await User.findById(user);
        query.userId = { $in: u.takipEdilenler };
    } else if (mod === 'liste' && listId) { query.listeId = listId; }
    else if (mod === 'trend') { sort = { beğeniSayisi: -1, tarih: -1 }; }
    const links = await Link.find(query).sort(sort).limit(50);
    res.json({ links });
});

// ... (Auth, Profil ve Liste rotaları v5 ile aynı kalsın) ...
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

app.get('/user/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        const lists = await LinkList.find({ olusturan: user._id });
        const linksCount = await Link.countDocuments({ userId: user._id });
        res.json({ user: { id: user._id, username: user.username, followers: user.takipciler.length, following: user.takipEdilenler.length }, lists, linksCount });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

app.post('/data', auth, async (req, res) => {
    const { baslik, url, aciklama, domain, etiketler } = req.body;
    await new Link({ baslik, url, aciklama, domain, etiketler: etiketler ? etiketler.split(',').map(e => e.trim()) : [], userId: req.userData.userId, userName: req.userData.username }).save();
    res.json({ success: true });
});

app.post('/lists', auth, async (req, res) => {
    const { isim, aciklama } = req.body;
    await new LinkList({ isim, aciklama, olusturan: req.userData.userId, olusturanAd: req.userData.username }).save();
    res.json({ success: true });
});

app.get('/lists', auth, async (req, res) => {
    const lists = await LinkList.find({ $or: [ { olusturan: req.userData.userId }, { ortaklar: req.userData.userId } ] });
    res.json({ lists });
});

app.post('/data/copy', auth, async (req, res) => {
    try {
        const { linkId, listeId } = req.body;
        const originalLink = await Link.findById(linkId);
        await new Link({ ...originalLink._doc, _id: new mongoose.Types.ObjectId(), userId: req.userData.userId, userName: req.userData.username, listeId: listeId, beğeniler: [], beğeniSayisi: 0, tarih: Date.now() }).save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Hata" }); }
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile('index.html', { root: __dirname }));
app.listen(process.env.PORT || 10000, "0.0.0.0");