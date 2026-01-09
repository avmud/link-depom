const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Yeni
const cheerio = require('cheerio'); // Yeni
const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI);

const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, 
    listeler: [String], domain: String, tarih: { type: Date, default: Date.now }
});

// 1. ADIM: SITEMAP (Google Botları İçin)
app.get('/sitemap.xml', async (req, res) => {
    const links = await Link.find();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://seninsiten.onrender.com/</loc></url>`;
    links.forEach(l => {
        xml += `<url><loc>https://seninsiten.onrender.com/link/${l._id}</loc></url>`;
    });
    xml += `</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

// 2. ADIM: OTOMATİK BİLGİ ÇEKME (Linkin başlığını ve açıklamasını bulur)
app.post('/fetch-info', async (req, res) => {
    try {
        const { url } = req.body;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const info = {
            title: $('title').text() || "Başlık bulunamadı",
            description: $('meta[name="description"]').attr('content') || "Açıklama bulunamadı"
        };
        res.json(info);
    } catch (e) { res.status(500).send("Bilgi çekilemedi"); }
});

// Link Kaydetme Rotası (Aynı kalıyor)
app.post('/kaydet', async (req, res) => {
    const { url, baslik, aciklama, secilenListeler } = req.body;
    const domain = new URL(url).hostname.replace('www.', '');
    const yeniLink = new Link({ baslik, url, aciklama, listeler: secilenListeler, domain });
    await yeniLink.save();
    res.json({ success: true });
});

app.get('/data', async (req, res) => {
    const links = await Link.find().sort({ tarih: -1 });
    res.json({ links, user: { username: "Uğur", stats: { totalLinks: links.length, totalLists: 32 } } });
});

app.listen(process.env.PORT || 3000);