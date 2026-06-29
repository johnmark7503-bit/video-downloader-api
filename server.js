const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// yt-dlp file ka path set karna
const binaryPath = path.join(__dirname, 'yt-dlp.exe');
let ytDlpWrap;

// AUTOMATIC DOWNLOAD FUNCTION: Yeh chalte hi check karega aur file download karega
async function setupYtdlp() {
    if (!fs.existsSync(binaryPath)) {
        console.log('yt-dlp binary file nahi mili. Internet se download ho rahi hai, thoda wait karein...');
        // GitHub se latest version download karna
        await YTDlpWrap.downloadFromGithub(binaryPath);
        console.log('yt-dlp download mukammal ho gayi!');
    }
    // Ab wrapper ko batana ke download ki hui file use kare
    ytDlpWrap = new YTDlpWrap(binaryPath);
}

// 1. BROWSER KE LIYE (GET Request)
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;

    if (!videoUrl) {
        return res.status(400).json({ success: false, error: "Video URL missing hai!" });
    }

    try {
        let videoInfo = await ytDlpWrap.getVideoInfo(videoUrl);
        return res.json({
            success: true,
            method: "GET (Browser)",
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration_string,
            downloadUrl: videoInfo.url || (videoInfo.formats && videoInfo.formats.pop().url)
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. RAPIDAPI KE LIYE (POST Request)
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });
    }

    try {
        let videoInfo = await ytDlpWrap.getVideoInfo(videoUrl);
        return res.json({
            success: true,
            method: "POST (API/App)",
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration_string,
            downloadUrl: videoInfo.url || (videoInfo.formats && videoInfo.formats.pop().url)
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Pehle setup run hoga fir server chalu hoga
setupYtdlp().then(() => {
    app.listen(PORT, () => {
        console.log(`API perfectly http://localhost:${PORT} par live chal rahi hai!`);
    });
}).catch(err => {
    console.error("Setup error:", err.message);
});