const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

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

// --- ROTALAR ---

// Google Doğrulama Dosyası İçin Özel Ayar (DOĞRULAMA HATASINI ÇÖZER)
app.get('/google2907470659972352.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'google2907470659972352.html'));
});

// Statik Dosyalar
app.use(express.static(path.join(__dirname)));

// API Rotaları (Çakışmayı önlemek için /api/ ön ekiyle)
app.post('/api/links/click/:id', async (req, res) => {
    try {
        const today = new Date().setHours(0,0,0,0);
        const link = await Link.findById(req.params.id);
        if(!link) return res.status(404).send();
        link.clicks = (link.clicks || 0) + 1;
        let historyIndex = link.clickHistory.findIndex(h => h.date && h.date.getTime() === today);
        if(historyIndex > -1) link.clickHistory[historyIndex].count += 1;
        else link.clickHistory.push({ date: new Date(today), count: 1 });
        await link.save();
        res.json({ success: true, clicks: link.clicks });
    } catch (e) { res.status(500).json(e); }
});

app.get('/api/data', async (req, res) => {
    const { page = 1 } = req.query;
    const links = await Link.find().sort({ tarih: -1 }).skip((page - 1) * 10).limit(10).lean();
    res.json(links);
});

app.get('/api/user/stats/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    const links = await Link.find({ userId: req.params.id });
    const totalClicks = links.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
    res.json({ 
        username: user?.username, avatar: user?.avatar,
        linkCount: links.length, totalClicks, addedByOthers: user?.addedCount || 0,
        followers: user?.followers?.length || 0, following: user?.following?.length || 0
    });
});

// Hiyerarşi Getirme
app.get('/api/my-folders', async (req, res) => {
    const lists = await List.find({ $or: [{ userId: req.query.userId }, { collaborators: req.query.userId }] }).lean();
    res.json(lists);
});

// Catch-all: API dışındaki her şeyi index.html'e yönlendir
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).send('API bulunamadı');
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 LinkUp v23 Hazır: Port ${PORT}`));