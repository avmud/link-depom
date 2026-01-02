const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

let db = {
    users: { "royal": { username: "royal", joinDate: "02.01.2026", bio: "Link koleksiyoncusu." } },
    links: [],
    listeler: ["Favoriler", "Okunacaklar", "Teknoloji"]
};

// ANALİZ: Sadece resim ve öneri başlık çekmek için
app.post('/on-analiz', async (req, res) => {
    try {
        const response = await axios.get(req.body.url, { timeout: 3000 });
        const $ = cheerio.load(response.data);
        const baslik = $('title').text().trim();
        const resim = $('meta[property="og:image"]').attr('content') || "https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=500";
        res.json({ baslik, resim });
    } catch (e) {
        res.json({ baslik: "", resim: "https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=500" });
    }
});

// TAM KAYIT
app.post('/kaydet', (req, res) => {
    const { url, baslik, etiketler, secilenListe } = req.body;
    const yeniLink = {
        id: Date.now(),
        url, baslik, etiketler,
        liste: secilenListe || "Genel",
        resim: req.body.resim || "https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=500",
        creator: "royal",
        date: new Date().toLocaleString()
    };
    db.links.push(yeniLink);
    res.json({ success: true, yeniLink });
});

app.get('/data', (req, res) => {
    res.json({
        sonLinkler: db.links.slice(-10).reverse(),
        listeler: db.listeler,
        linkler: db.links
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));