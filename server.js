const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

// GELİŞMİŞ VERİ TABANI
let db = {
    user: {
        username: "royal",
        joinDate: "02.01.2026",
        bio: "Link koleksiyoncusu ve teknoloji meraklısı.",
        stats: { likes: 0, saved: 0 }
    },
    links: [],
    listeler: [
        { ad: "Favoriler", etiketler: "özel, seçilmiş", likes: 0, savedBy: 0, public: true },
        { ad: "Okunacaklar", etiketler: "eğitim", likes: 0, savedBy: 0, public: true },
        { ad: "Teknoloji", etiketler: "tech, yazılım", likes: 0, savedBy: 0, public: true }
    ]
};

// ANALİZ
app.post('/on-analiz', async (req, res) => {
    try {
        const response = await axios.get(req.body.url, { timeout: 3000 });
        const $ = cheerio.load(response.data);
        res.json({ 
            baslik: $('title').text().trim(), 
            resim: $('meta[property="og:image"]').attr('content') || "https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=500" 
        });
    } catch (e) {
        res.json({ baslik: "", resim: "https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=500" });
    }
});

// BAĞLANTI EKLE
app.post('/kaydet', (req, res) => {
    const { url, baslik, etiketler, secilenListeler, yeniListeAdi, resim } = req.body;
    let finalLists = [...secilenListeler];
    
    if (yeniListeAdi && yeniListeAdi.trim() !== "") {
        const tAd = yeniListeAdi.trim();
        if (!db.listeler.find(l => l.ad === tAd)) db.listeler.push({ ad: tAd, etiketler: "", likes: 0, savedBy: 0, public: true });
        finalLists.push(tAd);
    }

    const yeniLink = {
        id: Date.now(),
        url, baslik, etiketler, resim,
        listeler: finalLists,
        creator: "royal",
        likes: 0,
        views: 0,
        date: new Date().toLocaleDateString()
    };
    db.links.push(yeniLink);
    res.json({ success: true });
});

app.get('/data', (req, res) => res.json(db));

// BEĞENİ VE ETKİLEŞİM
app.post('/like/:id', (req, res) => {
    const link = db.links.find(l => l.id == req.params.id);
    if(link) link.likes++;
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkUp Server 2.0 running on ${PORT}`));