const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

// Verilerin geçici olarak tutulacağı dizi (Render uyuyunca sıfırlanır)
let linkler = [
    {
        baslik: "LinkUp'a Hoş Geldiniz!",
        link: "https://google.com",
        resim: "https://images.unsplash.com/photo-1481627564055-3c27f58634b0?auto=format&fit=crop&w=800&q=80",
        etiketler: "başlangıç, merhaba",
        tiklama: 0
    }
];

// 1. LİSTELEME
app.get('/linkler', (req, res) => {
    res.json(linkler);
});

// 2. ANALİZ VE EKLEME
app.post('/analiz', async (req, res) => {
    const { linkUrl, etiketler } = req.body;
    try {
        const response = await axios.get(linkUrl, { timeout: 5000 });
        const $ = cheerio.load(response.data);
        const baslik = $('title').text() || linkUrl;
        const resim = $('meta[property="og:image"]').attr('content') || "";

        const yeniLink = { baslik, link: linkUrl, resim, etiketler, tiklama: 0 };
        linkler.push(yeniLink);
        res.json(yeniLink);
    } catch (error) {
        // Hata durumunda boş resimle ekle
        const hataLink = { baslik: linkUrl, link: linkUrl, resim: "", etiketler, tiklama: 0 };
        linkler.push(hataLink);
        res.json(hataLink);
    }
});

// 3. TIKLAMA SAYACI
app.post('/tikla/:id', (req, res) => {
    const id = req.params.id;
    if (linkler[id]) {
        linkler[id].tiklama = (linkler[id].tiklama || 0) + 1;
        res.json({ success: true });
    } else {
        res.status(404).send("Link bulunamadı");
    }
});

// 4. SİLME
app.delete('/sil/:id', (req, res) => {
    const id = req.params.id;
    linkler.splice(id, 1);
    res.json({ success: true });
});

// 5. GÜNCELLEME (DÜZENLEME)
app.patch('/guncelle/:id', (req, res) => {
    const id = req.params.id;
    const { etiketler } = req.body;
    
    if (linkler[id]) {
        linkler[id].etiketler = etiketler;
        res.json({ success: true, mesaj: "Etiketler güncellendi!" });
    } else {
        res.status(404).json({ success: false, mesaj: "Link bulunamadı." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});