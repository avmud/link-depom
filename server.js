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

mongoose.connect(MONGO_URI);

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
    clicks: { type: Number, default: 0 },
    clickHistory: [{ date: Date, count: Number }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tarih: { type: Date, default: Date.now }
});

// --- GOOGLE DOĞRULAMA (image_8caf86.jpg Hatasını Çözer) ---
app.get('/google2907470659972352.html', (req, res) => {
    res.type('text/html');
    res.send('google-site-verification: google2907470659972352.html');
});

app.use(express.static(path.join(__dirname)));

// --- API ROTALARI ---

// Auth & Profil
app.post('/api/auth/register', async (req, res) => {
    try {
        const hashed = await bcrypt.hash(req.body.password, 10);
        const user = new User({...req.body, password: hashed});
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json(e); }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).send();
    const token = jwt.sign({ userId: user._id }, SECRET_KEY);
    res.json({ token, userId: user._id, username: user.username, avatar: user.avatar });
});

app.post('/api/user/update', async (req, res) => {
    await User.findByIdAndUpdate(req.body.userId, { avatar: req.body.avatar });
    res.json({ success: true });
});

// Takip Sistemi
app.post('/api/user/follow', async (req, res) => {
    const { myId, targetId } = req.body;
    await User.findByIdAndUpdate(myId, { $addToSet: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: myId } });
    res.json({ success: true });
});

// Link & Analitik (image_8bcd50.jpg PathError Düzeltmesi)
app.get('/api/data', async (req, res) => {
    const { page = 1 } = req.query;
    const links = await Link.find().sort({ tarih: -1 }).skip((page - 1) * 10).limit(10).lean();
    res.json(links);
});

app.post('/api/links/click/:id', async (req, res) => {
    const today = new Date().setHours(0,0,0,0);
    const link = await Link.findById(req.params.id);
    if(!link) return res.status(404).send();
    link.clicks = (link.clicks || 0) + 1;
    let historyIndex = link.clickHistory.findIndex(h => h.date && new Date(h.date).getTime() === today);
    if(historyIndex > -1) link.clickHistory[historyIndex].count += 1;
    else link.clickHistory.push({ date: new Date(today), count: 1 });
    await link.save();
    res.json({ success: true });
});

app.post('/api/links/add', async (req, res) => {
    const newLink = new Link(req.body);
    await newLink.save();
    res.json(newLink);
});

app.delete('/api/links/:id', async (req, res) => {
    await Link.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// AI & Şikayet
app.post('/api/links/summarize', async (req, res) => {
    res.json({ summary: "Bu link, teknoloji ve yazılım geliştirme üzerine güncel bilgiler içermektedir." });
});

app.post('/api/report', async (req, res) => { res.json({ success: true }); });

// Catch-all
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).send();
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 LinkUp v25 Yayında`));