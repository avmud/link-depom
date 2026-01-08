const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

let db = {
    user: {
        username: "royal",
        joinDate: "02.01.2026",
        bio: "Link koleksiyoncusu ve teknoloji meraklısı.",
        followers: 128,
        following: 45
    },
    links: [],
    listeler: [
        { ad: "Favoriler", etiketler: "özel", likes: 12, savedBy: 4 },
        { ad: "Okunacaklar", etiketler: "eğitim", likes: 8, savedBy: 2 },
        { ad: "Teknoloji", etiketler: "tech", likes: 5, savedBy: 1 }
    ]
};

// OTOMATİK ANALİZ (Başlık ve Resim Çeker)
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

// TAM KAYIT
app.post('/kaydet', (req, res) => {
    const { url, baslik, etiketler, secilenListeler, yeniListeAdi, resim, aciklama } = req.body;
    let finalLists = Array.isArray(secilenListeler) ? [...secilenListeler] : [];
    
    if (yeniListeAdi) {
        const tAd = yeniListeAdi.trim();
        if (!db.listeler.find(l => l.ad === tAd)) {
            db.listeler.push({ ad: tAd, etiketler: "", likes: 0, savedBy: 0 });
        }
        finalLists.push(tAd);
    }

    db.links.push({
        id: Date.now(), url, baslik, etiketler, resim,
        aciklama: aciklama || "Bu bağlantı için henüz bir açıklama girilmemiş.",
        listeler: finalLists, creator: "royal", likes: 0, date: new Date().toLocaleDateString()
    });
    res.json({ success: true });
});

app.get('/data', (req, res) => res.json(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkUp Engine Active on ${PORT}`));