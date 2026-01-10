const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors()); app.use(express.json());

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI);

// --- GELİŞMİŞ MODELLER ---

// Klasör ve Liste Hiyerarşisi
const List = mongoose.model('List', {
    baslik: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'List', default: null }, // Klasörleme için
    userId: mongoose.Schema.Types.ObjectId,
    authorizedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Yetkilendirme
    isFolder: { type: Boolean, default: false },
    tarih: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, etiketler: [String],
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
    userId: mongoose.Schema.Types.ObjectId, userName: String,
    beğeniler: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tarih: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', {
    targetId: mongoose.Schema.Types.ObjectId,
    type: String, // 'link' veya 'list'
    reason: String,
    reporterId: mongoose.Schema.Types.ObjectId
});

const User = mongoose.model('User', {
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: { type: String },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

// --- ROTALAR ---

// Yetkilendirme Sistemi (Liste Güncelleme Yetkisi Verme)
app.post('/lists/:id/authorize', async (req, res) => {
    const { targetUserId } = req.body;
    await List.findByIdAndUpdate(req.params.id, { $addToSet: { authorizedUsers: targetUserId } });
    res.json({ success: true });
});

// Hiyerarşik Klasör/Liste Getirme
app.get('/my-folders', async (req, res) => {
    const lists = await List.find({ userId: req.query.userId }).lean();
    res.json(lists);
});

// Sakıncalı İçerik Bildir
app.post('/report', async (req, res) => {
    await new Report(req.body).save();
    res.json({ success: true });
});

// Link Beğenme ve Kendi Listesine Ekleme
app.post('/links/:id/like', async (req, res) => {
    await Link.findByIdAndUpdate(req.params.id, { $addToSet: { beğeniler: req.body.userId } });
    res.json({ success: true });
});

app.post('/links/copy', async (req, res) => {
    const original = await Link.findById(req.body.linkId);
    const copy = new Link({
        ...original._doc,
        _id: new mongoose.Types.ObjectId(),
        userId: req.body.newUserId,
        listId: req.body.targetListId
    });
    await copy.save();
    res.json({ success: true });
});

app.listen(process.env.PORT || 10000);