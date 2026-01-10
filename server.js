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
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, etiketler: [String],
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
    userId: mongoose.Schema.Types.ObjectId, userName: String,
    clicks: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

// --- ROTALAR ---

// 1. Google Doğrulama (KESİN ÇÖZÜM)
app.get('/google2907470659972352.html', (req, res) => {
    res.send('google-site-verification: google2907470659972352.html');
});

// 2. API Rotaları
app.get('/api/data', async (req, res) => {
    const { page = 1 } = req.query;
    const links = await Link.find().sort({ tarih: -1 }).skip((page - 1) * 10).limit(10).lean();
    res.json(links);
});

app.post('/api/links/add', async (req, res) => {
    const link = new Link(req.body);
    await link.save();
    res.json(link);
});

app.delete('/api/links/:id', async (req, res) => {
    await Link.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.get('/api/user/stats/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id) || { username: 'Misafir', avatar: '' };
        const links = await Link.find({ userId: req.params.id });
        const totalClicks = links.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
        res.json({ 
            username: user.username, avatar: user.avatar,
            linkCount: links.length, totalClicks, 
            addedByOthers: user.addedCount || 0,
            followers: user.followers?.length || 0,
            following: user.following?.length || 0
        });
    } catch (e) { res.status(404).json({error: "Kullanıcı bulunamadı"}); }
});

app.get('/api/my-folders', async (req, res) => {
    const lists = await List.find({ userId: req.query.userId }).lean();
    res.json(lists);
});

// 3. Statik Dosyalar ve Catch-all (Hiyerarşi Önemli)
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).send();
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 LinkUp v26 Yayında`));