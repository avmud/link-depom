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

const MONGO_URI = "mongodb+srv://mud:vVY7Eff21UPjBmJC@cluster0.gtyhy6w.mongodb.net/linkup?retryWrites=true&w=majority";
const SECRET_KEY = "linkup_ozel_anahtar_2026"; // Güvenlik anahtarı

mongoose.connect(MONGO_URI);

// MODELLER
const User = mongoose.model('User', {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: String
});

const Link = mongoose.model('Link', {
    baslik: String, url: String, aciklama: String, 
    userId: mongoose.Schema.Types.ObjectId, // Linkin kime ait olduğu
    tarih: { type: Date, default: Date.now }
});

// ÜYELİK SİSTEMİ ROTALARI
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
        return res.status(401).json({ error: "Hatalı giriş!" });
    }
    const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);
    res.json({ token, username: user.username });
});

// OTOMATİK BİLGİ ÇEKME
app.post('/fetch-info', async (req, res) => {
    try {
        const { url } = req.body;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        res.json({
            title: $('title').text() || "Başlık bulunamadı",
            description: $('meta[name="description"]').attr('content') || "Açıklama yok"
        });
    } catch (e) { res.status(500).send("Hata"); }
});

// LİNK KAYDETME (Üyeye Özel)
app.post('/kaydet', async (req, res) => {
    const { url, baslik, aciklama, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const yeniLink = new Link({ url, baslik, aciklama, userId: decoded.userId });
        await yeniLink.save();
        res.json({ success: true });
    } catch (e) { res.status(401).send("Yetkisiz"); }
});

app.get('/data', async (req, res) => {
    const links = await Link.find().sort({ tarih: -1 }).limit(20);
    res.json({ links });
});

app.listen(process.env.PORT || 3000, () => console.log("Sistem Aktif!"));