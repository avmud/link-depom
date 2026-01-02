const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const DOSYA_YOLU = './veriler.json';

const verileriOku = () => {
    if (!fs.existsSync(DOSYA_YOLU)) return [];
    try {
        return JSON.parse(fs.readFileSync(DOSYA_YOLU));
    } catch (e) {
        return [];
    }
};

const verileriKaydet = (veriler) => {
    fs.writeFileSync(DOSYA_YOLU, JSON.stringify(veriler, null, 2));
};

app.get('/linkler', (req, res) => {
    res.json(verileriOku());
});

app.post('/analiz', async (req, res) => {
    try {
        const { linkUrl, etiketler } = req.body;
        let analizVerisi = {};

        if (linkUrl.includes('tiktok.com')) {
            const tiktokRes = await axios.get(`https://www.tiktok.com/oembed?url=${linkUrl}`);
            analizVerisi = {
                baslik: tiktokRes.data.title || "TikTok Videosu",
                resim: tiktokRes.data.thumbnail_url,
                link: linkUrl,
                platform: 'tiktok',
                tiklama: 0,
                etiketler: etiketler
            };
        } else {
            const response = await axios.get(linkUrl);
            const $ = cheerio.load(response.data);
            analizVerisi = {
                baslik: $('meta[property="og:title"]').attr('content') || $('title').text() || 'Başlık bulunamadı',
                resim: $('meta[property="og:image"]').attr('content') || 'https://via.placeholder.com/150',
                link: linkUrl,
                platform: linkUrl.includes('instagram.com') ? 'instagram' : 'web',
                tiklama: 0,
                etiketler: etiketler
            };
        }

        const mevcutLinkler = verileriOku();
        mevcutLinkler.push(analizVerisi);
        verileriKaydet(mevcutLinkler);
        res.json(analizVerisi);
    } catch (hata) {
        res.status(500).json({ hata: "Link analiz edilemedi." });
    }
});

app.post('/tikla/:index', (req, res) => {
    const index = req.params.index;
    const mevcutLinkler = verileriOku();
    if (mevcutLinkler[index]) {
        mevcutLinkler[index].tiklama = (mevcutLinkler[index].tiklama || 0) + 1;
        verileriKaydet(mevcutLinkler);
        res.json({ mesaj: "Tıklandı" });
    } else {
        res.status(404).json({ hata: "Link bulunamadı" });
    }
});

app.delete('/sil/:index', (req, res) => {
    const index = req.params.index;
    const mevcutLinkler = verileriOku();
    mevcutLinkler.splice(index, 1);
    verileriKaydet(mevcutLinkler);
    res.json({ mesaj: "Silindi" });
});

app.listen(5000, () => console.log(`Sunucu aktif: http://localhost:5000`));