const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

// GELİŞMİŞ VERİ YAPISI
let db = {
    users: {
        "royal": {
            username: "royal",
            joinDate: "02.01.2026",
            bio: "Link koleksiyoncusu ve teknoloji meraklısı.",
            lists: ["Favoriler"]
        }
    },
    links: [],
    lists: [
        { id: 1, ad: "Favoriler", creator: "royal", public: true, likes: 0, views: 0, savedBy: 0, items: [] }
    ]
};

// 1. LİNK ANALİZ VE EKLEME
app.post('/analiz', async (req, res) => {
    const { linkUrl, etiketler, creator = "royal", isPublic = true } = req.body;
    try {
        const response = await axios.get(linkUrl, { timeout: 3000 });
        const $ = cheerio.load(response.data);
        const baslik = $('title').text().trim() || linkUrl;
        const resim = $('meta[property="og:image"]').attr('content') || "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=500";
        
        const yeniLink = { 
            id: Date.now(),
            baslik, link: linkUrl, resim, etiketler, 
            creator, public: isPublic, tiklama: 0, likes: 0, date: new Date().toLocaleString()
        };
        db.links.push(yeniLink);
        res.json(yeniLink);
    } catch (e) {
        const hataLink = { id: Date.now(), baslik: linkUrl, link: linkUrl, resim: "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=500", etiketler, creator, public: isPublic, tiklama: 0, likes: 0, date: new Date().toLocaleString() };
        db.links.push(hataLink);
        res.json(hataLink);
    }
});

// 2. TÜM VERİLERİ GETİR (Home & Search)
app.get('/data', (req, res) => {
    res.json({
        sonLinkler: db.links.filter(l => l.public).slice(-10).reverse(),
        populerListeler: db.lists.filter(l => l.public),
        user: db.users["royal"]
    });
});

app.delete('/sil/:id', (req, res) => {
    db.links = db.links.filter(l => l.id != req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkUp Engine Aktif: ${PORT}`));