const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Yasaklı kelimeler (Geliştirilebilir)
const forbiddenKeywords = ['illegal', 'adult', 'müstehcen', 'kumar', 'bet'];

let db = {
    user: {
        username: "Uğur",
        status: "active",
        stats: { totalLists: 32, totalLinks: 400, savedLists: 16, savedLinks: 128, listLikes: 64, linkLikes: 256, followers: 8 }
    },
    links: [],
    listeler: [
        { ad: "YouTube Listelerim", parent: null, type: "system" },
        { ad: "Fransızca Şarkılar", parent: "YouTube Listelerim", type: "custom" },
        { ad: "Instagram Listelerim", parent: null, type: "system" },
        { ad: "Ders Videolarım", parent: null, type: "system" }
    ],
    bannedEmails: []
};

// GÜVENLİK VE KAYIT
app.post('/kaydet', (req, res) => {
    const { url, baslik, secilenListeler, creator } = req.body;

    // Müstehcenlik Kontrolü
    const isIllegal = forbiddenKeywords.some(word => 
        url.toLowerCase().includes(word) || baslik.toLowerCase().includes(word)
    );

    if (isIllegal) {
        db.user.status = "banned";
        db.user.username = "Anonim_" + Math.floor(1000 + Math.random() * 9000);
        return res.status(403).json({ error: "İhlal tespit edildi. Hesabınız anonimleştirildi." });
    }

    const newLink = { 
        id: Date.now(), url, baslik, 
        listeler: secilenListeler, 
        creator: db.user.username, 
        likes: 0, reports: 0 
    };
    
    db.links.push(newLink);
    res.json({ success: true });
});

app.get('/data', (req, res) => res.json(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkUp Engine Active on ${PORT}`));