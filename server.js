const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- MONGODB BAĞLANTISI ---
const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 LinkUp Bulut Veritabanı Ölümsüzleşti!"))
    .catch(err => console.error("❌ Veritabanı Hatası:", err));

// --- VERİ MODELLERİ (ŞEMALAR) ---

// Link Şeması
const LinkSchema = new mongoose.Schema({
    baslik: String,
    url: String,
    aciklama: String, // SEO için önemli
    listeler: [String],
    domain: String,
    creator: { type: String, default: "Uğur" },
    likes: { type: Number, default: 0 },
    reports: { type: Number, default: 0 },
    tarih: { type: Date, default: Date.now }
});

// Platform Şeması (100 Link Analizi İçerir)
const PlatformSchema = new mongoose.Schema({
    domain: String,
    count: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false }
});

const Link = mongoose.model('Link', LinkSchema);
const Platform = mongoose.model('Platform', PlatformSchema);

// Güvenlik: Yasaklı Kelime Filtresi
const forbiddenKeywords = ['illegal', 'müstehcen', 'kumar', 'bet', 'adult'];

// --- API ROTALARI ---

// 1. Tüm Verileri Getir (SEO ve Arayüz İçin)
app.get('/data', async (req, res) => {
    try {
        const links = await Link.find().sort({ tarih: -1 });
        const platforms = await Platform.find({ isVerified: true });
        
        // Çizimindeki "Merhaba Uğur" istatistikleri
        res.json({ 
            links, 
            platforms,
            user: { 
                username: "Uğur", 
                status: "active",
                stats: { 
                    totalLinks: links.length, 
                    totalLists: 32,
                    linkLikes: links.reduce((acc, curr) => acc + (curr.likes || 0), 0),
                    followers: 8 
                } 
            },
            listeler: [
                { ad: "YouTube Listelerim", parent: null },
                { ad: "Instagram Listelerim", parent: null },
                { ad: "Ders Videolarım", parent: null },
                { ad: "Fransızca Şarkılar", parent: "YouTube Listelerim" },
                { ad: "Müslüm Gürses", parent: "YouTube Listelerim" }
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Yeni Link Kaydet + Güvenlik Filtresi + 100 Barajı
app.post('/kaydet', async (req, res) => {
    try {
        const { url, baslik, aciklama, secilenListeler } = req.body;
        
        // Güvenlik Kontrolü
        const isIllegal = forbiddenKeywords.some(word => 
            url.toLowerCase().includes(word) || baslik.toLowerCase().includes(word)
        );

        if (isIllegal) {
            // Kullanıcıyı banla/anonimleştir mantığı burada devreye girer
            return res.status(403).json({ error: "İhlal tespit edildi. İçerik reddedildi." });
        }

        const domain = new URL(url).hostname.replace('www.', '');

        // Linki Kaydet
        const yeniLink = new Link({ baslik, url, aciklama, listeler: secilenListeler, domain });
        await yeniLink.save();

        // Platform Güncelleme (100 Link Barajı)
        let plat = await Platform.findOne({ domain });
        if (plat) {
            plat.count += 1;
            if (plat.count >= 100) plat.isVerified = true;
            await plat.save();
        } else {
            await Platform.create({ domain });
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkUp Devrimi ${PORT} portunda aktif!`));