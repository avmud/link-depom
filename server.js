const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

let db = {
    links: [],
    listeler: ["Favoriler", "Okunacaklar", "Teknoloji"]
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

// KAYIT (Çoklu Liste Desteği ile)
app.post('/kaydet', (req, res) => {
    const { url, baslik, etiketler, secilenListeler, yeniListeAdi } = req.body;
    
    let finalListeler = [...secilenListeler];
    
    // Eğer yeni bir liste adı girilmişse listelere ekle
    if (yeniListeAdi && yeniListeAdi.trim() !== "") {
        const temizAd = yeniListeAdi.trim();
        if (!db.listeler.includes(temizAd)) db.listeler.push(temizAd);
        if (!finalListeler.includes(temizAd)) finalListeler.push(temizAd);
    }

    const yeniLink = {
        id: Date.now(),
        url, baslik, etiketler,
        listeler: finalListeler.length > 0 ? finalListeler : ["Genel"],
        resim: req.body.resim,
        date: new Date().toLocaleString()
    };
    
    db.links.push(yeniLink);
    res.json({ success: true });
});

// LİSTE OLUŞTURMA
app.post('/liste-olustur', (req, res) => {
    const { ad } = req.body;
    if (ad && !db.listeler.includes(ad)) {
        db.listeler.push(ad);
        res.json({ success: true });
    } else res.status(400).send("Hata");
});

app.get('/data', (req, res) => res.json(db));

app.delete('/sil/:id', (req, res) => {
    db.links = db.links.filter(l => l.id != req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));