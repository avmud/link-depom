const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// --- GÜVENLİK VE VERİTABANI AYARLARI ---
const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Veritabanı ve Güvenlik Motoru Aktif!"))
    .catch(err => console.error("❌ Veritabanı Hatası:", err));

// --- MODELLER ---
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: String,
    tarih: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', {
    baslik: String,
    url: String,
    aciklama: String, 
    userId: mongoose.Schema.Types.ObjectId,
    domain: String,
    tarih: { type: Date, default: Date.now }
});

// --- ÜYELİK ROTALARI ---
app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, username });
        await user.save();
        res.json({ success: true, message: "Kayıt başarılı!" });
    } catch (e) { res.status(400).json({ error: "Email zaten kayıtlı!" }); }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Hatalı giriş bilgileri!" });
    }
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username });
});

// --- OTOMATİK SEO BİLGİ ÇEKME (SCRAPER) ---
app.post('/fetch-info', async (req, res) => {
    try {
        const { url } = req.body;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        res.json({
            title: $('title').text().trim() || "Başlık bulunamadı",
            description: $('meta[name="description"]').attr('content') || "Bu içerik için açıklama belirtilmemiş."
        });
    } catch (e) { res.status(500).json({ title: "Başlık alınamadı", description: "" }); }
});

// --- LİNK İŞLEMLERİ ---
app.post('/kaydet', async (req, res) => {
    const { url, baslik, aciklama, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const domain = new URL(url).hostname.replace('www.', '');
        const yeniLink = new Link({ url, baslik, aciklama, userId: decoded.userId, domain });
        await yeniLink.save();
        res.json({ success: true });
    } catch (e) { res.status(401).json({ error: "Oturum geçersiz" }); }
});

app.get('/data', async (req, res) => {
    try {
        const links = await Link.find().sort({ tarih: -1 }).limit(50);
        res.json({ links });
    } catch (e) { res.status(500).json({ error: "Veri çekilemedi" }); }
});

// SITEMAP (Google Botları İçin)
app.get('/sitemap.xml', async (req, res) => {
    const links = await Link.find();
    let xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    xml += `<url><loc>https://link-depom-frontend.onrender.com/</loc></url>`;
    links.forEach(l => { xml += `<url><loc>https://link-depom-frontend.onrender.com/link/${l._id}</loc></url>`; });
    xml += `</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

const PORT = process.env.PORT || 3000;
const path = require('path');

// Statik dosyaları (index.html, resimler vb.) sunar
app.use(express.static(path.join(__dirname, '/')));

// Herhangi bir sayfaya girilirse index.html'i gönderir
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(PORT, () => console.log(`LinkUp Sunucusu ${PORT} portunda devrim yapıyor!`));