const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors()); app.use(express.json({ limit: '10mb' }));

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI);

// --- MODELLER ---
const User = mongoose.model('User', {
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: { type: String },
    avatar: { type: String },
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
    // TAKIM ÇALIŞMASI: Düzenleme yetkisi olan diğer kullanıcılar
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, etiketler: [String],
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
    userId: mongoose.Schema.Types.ObjectId, userName: String,
    aiSummary: String, // AI Özetleme Alanı
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tarih: { type: Date, default: Date.now }
});

// --- AI ÖZETLEME SİMÜLASYONU (MOCK AI SERVICE) ---
const summarizeAI = async (url) => {
    // Burada gerçek bir AI API'si (OpenAI gibi) çağrılabilir.
    return `Bu içerik ${url} üzerinden AI tarafından analiz edildi. İçerik genel olarak teknoloji ve verimlilik odaklı bilgiler içermektedir.`;
};

// --- ROTALAR ---

// 1. AI Özetleme Talebi
app.post('/links/summarize', async (req, res) => {
    const { linkId } = req.body;
    const link = await Link.findById(linkId);
    if (!link.aiSummary) {
        link.aiSummary = await summarizeAI(link.url);
        await link.save();
    }
    res.json({ summary: link.aiSummary });
});

// 2. Takım Çalışması: Klasöre Ortak Ekleme
app.post('/lists/add-collaborator', async (req, res) => {
    const { listId, collaboratorUsername } = req.body;
    const user = await User.findOne({ username: collaboratorUsername });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    
    await List.findByIdAndUpdate(listId, { $addToSet: { collaborators: user._id } });
    res.json({ success: true });
});

// 3. Paylaşımlı ve Kişisel Klasörleri Getir
app.get('/my-folders', async (req, res) => {
    const uid = req.query.userId;
    // Hem sahibi olduğum hem de ortağı olduğum listeleri getir
    const lists = await List.find({
        $or: [{ userId: uid }, { collaborators: uid }]
    }).lean();
    res.json(lists);
});

// 4. Sonsuz Akış & İstatistik (Önceki v19 Özellikleri)
app.get('/data', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const links = await Link.find().sort({ tarih: -1 }).skip((page-1)*limit).limit(parseInt(limit));
    res.json(links);
});

// ... (Auth, Delete, Report ve Diğer v19 Rotaları Mevcut) ...

app.listen(process.env.PORT || 10000);