// Sağ tık menüsünü oluşturma
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "depoyaGonder",
    title: "Link Depoma Gönder",
    contexts: ["link", "page"]
  });
});

// Sağ tıklandığında linki alıp sunucuya (server.js) gönderme
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "depoyaGonder") {
    const linkUrl = info.linkUrl || info.pageUrl;

    fetch('http://localhost:5000/analiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkUrl: linkUrl })
    })
    .then(res => res.json())
    .then(data => console.log("Kaydedildi:", data))
    .catch(err => console.error("Hata:", err));
  }
});