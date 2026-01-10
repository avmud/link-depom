const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB Bağlandı - LinkUp v20"));

// --- MODELLER ---
const User = mongoose.model('User', {
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: { type: String },
    avatar: { type: String, default: "" },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    addedCount: { type: Number, default: 0 }
});

const List = mongoose.model('List', {
    baslik: String,
    userId: mongoose.Schema.Types.ObjectId,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'List', default: null },
    isFolder: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    password: { type: String },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, etiketler: [String],
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
    userId: mongoose.Schema.Types.ObjectId, userName: String,
    aiSummary: String,
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tarih: { type: Date, default: Date.now }
});

// --- ROTALAR ---

// 1. Ana Sayfa ve Statik Dosyalar (HATA ÇÖZÜMÜ)
app.use(express.static(__dirname));

// 2. Auth Sistemleri
app.post('/auth/register', async (req, res) => {
    const hashed = await bcrypt.hash(req.body.password, 10);
    const user = new User({...req.body, password: hashed});
    await user.save();
    res.json({ success: true });
});

app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) 
        return res.status(401).json({ error: "Hatalı giriş" });
    const token = jwt.sign({ userId: user._id }, SECRET_KEY);
    res.json({ token, userId: user._id, username: user.username, avatar: user.avatar });
});

// 3. AI Özetleme
app.post('/links/summarize', async (req, res) => {
    const link = await Link.findById(req.body.linkId);
    if (!link.aiSummary) {
        link.aiSummary = `AI Analizi (${link.url}): Bu içerik kullanıcı için otomatik olarak özetlenmiştir.`;
        await link.save();
    }
    res.json({ summary: link.aiSummary });
});

// 4. Veri ve Sonsuz Akış
app.get('/data', async (req, res) => {
    const { page = 1 } = req.query;
    const links = await Link.find().sort({ tarih: -1 }).skip((page - 1) * 10).limit(10).lean();
    res.json(links);
});

// 5. Klasör ve Takım Çalışması
app.get('/my-folders', async (req, res) => {
    const lists = await List.find({ 
        $or: [{ userId: req.query.userId }, { collaborators: req.query.userId }] 
    }).lean();
    res.json(lists);
});

app.post('/lists/add-collaborator', async (req, res) => {
    const user = await User.findOne({ username: req.body.collaboratorUsername });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    await List.findByIdAndUpdate(req.body.listId, { $addToSet: { collaborators: user._id } });
    res.json({ success: true });
});

// 6. Profil ve İstatistik
app.get('/user/stats/:id', async (req, res) => {
    const uid = req.params.id;
    const user = await User.findById(uid);
    const linkCount = await Link.countDocuments({ userId: uid });
    const listCount = await List.countDocuments({ userId: uid });
    res.json({ 
        username: user.username, avatar: user.avatar,
        linkCount, listCount, addedByOthers: user.addedCount,
        following: user.following.length, followers: user.followers.length
    });
});

app.post('/user/update-avatar', async (req, res) => {
    await User.findByIdAndUpdate(req.body.userId, { avatar: req.body.avatar });
    res.json({ success: true });
});

// 7. Silme ve İşlemler
app.delete('/delete/:type/:id', async (req, res) => {
    if(req.params.type === 'link') await Link.findByIdAndDelete(req.params.id);
    else await List.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// HER ŞEYİ ANA SAYFAYA YÖNLENDİR
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 LinkUp v20 aktif port: ${PORT}`));