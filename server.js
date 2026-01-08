const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- MONGODB BAĞLANTISI ---
const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Veritabanı Aktif!"))
    .catch(err => console.error("❌ Hata:", err));

// --- VERİ MODELLERİ ---
const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, 
    listeler: [String], domain: String, likes: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

const Platform = mongoose.model('Platform', {
    domain: String, count: { type: Number, default: 1 }, isVerified: { type: Boolean, default: false }
});

// --- API ROTALARI ---
app.get('/data', async (req, res) => {
    try {
        const links = await Link.find().sort({ tarih: -1 });
        const platforms = await Platform.find({ isVerified: true });
        res.json({ 
            links, platforms,
            user: { username: "Uğur", stats: { totalLinks: links.length, totalLists: 32, linkLikes: 512, followers: 8 } },
            listeler: [
                { ad: "YouTube Listelerim", parent: null },
                { ad: "Instagram Listelerim", parent: null },
                { ad: "Ders Videolarım", parent: null },
                { ad: "Fransızca Şarkılar", parent: "YouTube Listelerim" },
                { ad: "Müslüm Gürses", parent: "YouTube Listelerim" }
            ]
        });
    } catch (e) { res.status(500).json(e); }
});

app.post('/kaydet', async (req, res) => {
    const { url, baslik, aciklama, secilenListeler } = req.body;
    const domain = new URL(url).hostname.replace('www.', '');
    const yeniLink = new Link({ baslik, url, aciklama, listeler: secilenListeler, domain });
    await yeniLink.save();

    let plat = await Platform.findOne({ domain });
    if (plat) {
        plat.count += 1;
        if (plat.count >= 100) plat.isVerified = true;
        await plat.save();
    } else { await Platform.create({ domain }); }
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log("Backend Hazır!"));