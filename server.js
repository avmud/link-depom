const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

// Veri Yapısı
let veritabanı = {
    linkler: [],
    listeler: ["Favoriler", "Okunacaklar"] // Varsayılan listeler
};

// LİSTELERİ GETİR
app.get('/listeler', (req, res) => res.json(veritabanı.listeler));

// YENİ LİSTE OLUŞTUR
app.post('/liste-olustur', (req, res) => {
    const { listeAdi } = req.body;
    if (listeAdi && !veritabanı.listeler.includes(listeAdi)) {
        veritabanı.listeler.push(listeAdi);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, mesaj: "Liste zaten var veya geçersiz." });
    }
});

// LİNKLERİ GETİR
app.get('/linkler', (req, res) => res.json(veritabanı.linkler));

// ANALİZ VE EKLEME
app.post('/analiz', async (req, res) => {
    const { linkUrl, etiketler } = req.body;
    try {
        const response = await axios.get(linkUrl, { timeout: 5000 });
        const $ = cheerio.load(response.data);
        const baslik = $('title').text() || linkUrl;
        const resim = $('meta[property="og:image"]').attr('content') || "";
        const yeniLink = { baslik, link: linkUrl, resim, etiketler, listeler: [], tiklama: 0 };
        veritabanı.linkler.push(yeniLink);
        res.json(yeniLink);
    } catch (error) {
        const hataLink = { baslik: linkUrl, link: linkUrl, resim: "", etiketler, listeler: [], tiklama: 0 };
        veritabanı.linkler.push(hataLink);
        res.json(hataLink);
    }
});

// LİNKİ LİSTEYE EKLE
app.patch('/link-listeye-ekle/:id', (req, res) => {
    const id = req.params.id;
    const { listeAdi } = req.body;
    if (veritabanı.linkler[id]) {
        if (!veritabanı.linkler[id].listeler) veritabanı.linkler[id].listeler = [];
        if (!veritabanı.linkler[id].listeler.includes(listeAdi)) {
            veritabanı.linkler[id].listeler.push(listeAdi);
        }
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.delete('/sil/:id', (req, res) => {
    veritabanı.linkler.splice(req.params.id, 1);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));