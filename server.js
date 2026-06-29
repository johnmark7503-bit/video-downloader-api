const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const binaryPath = path.join(__dirname, 'node_modules', '.bin', 'yt-dlp');
const finalBinary = fs.existsSync(binaryPath) ? binaryPath : 'yt-dlp';
const ytDlpWrap = new YTDlpWrap(finalBinary);
const cookiesPath = path.join(__dirname, 'cookies.txt');

// 🌐 Live Free HTTP Proxies fetch karne ka engine
async function getLiveFreeProxies() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt');
        const text = await response.text();
        return text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    } catch (e) {
        console.error("⚠️ Proxy list fetch error:", e.message);
        return [];
    }
}

// 🔄 Smart Retry Engine
async function getVideoDataWithRetry(videoUrl) {
    const proxyList = await getLiveFreeProxies();
    const maxRetries = 5; 
    let lastError = null;

    // List mein se random proxies select karne ke liye shuffle
    const randomProxies = proxyList.sort(() => 0.5 - Math.random()).slice(0, maxRetries);

    // Try 1: Pehle hamesha direct bina proxy ke check karein
    try {
        return await extractData(videoUrl, null);
    } catch (err) {
        console.log("⚠️ Direct request blocked. Switching to Free Proxy Rotation...");
        lastError = err;
    }

    // Try 2 to 6: Agar block ho, toh free proxies rotate karein
    for (let i = 0; i < randomProxies.length; i++) {
        const currentProxy = `http://${randomProxies[i]}`;
        console.log(`🌀 Attempt ${i + 1}/${maxRetries} -> Using Free Proxy: ${currentProxy}`);
        
        try {
            return await extractData(videoUrl, currentProxy);
        } catch (err) {
            console.error(`❌ Proxy ${currentProxy} failed or timed out.`);
            lastError = err;
        }
    }

    throw new Error(`Saari free proxies block ya down ho chuki hain. Last error: ${lastError.message}`);
}

// 🛠️ Main Extraction Core (Fixed Arguments)
async function extractData(videoUrl, proxyUrl) {
    // --no-impersonate hata diya gaya hai taaki syntax error khatam ho
    let args = [
        videoUrl,
        '--no-playlist',
        '--geo-bypass',
        '--socket-timeout', '10' // Proxies ke liye timeout 10 seconds kiya taaki data load ho sake
    ];
    
    if (fs.existsSync(cookiesPath)) {
        args.push('--cookies', cookiesPath);
    }

    if (proxyUrl) {
        args.push('--proxy', proxyUrl);
    }

    let videoInfo = await ytDlpWrap.getVideoInfo(args);
    let directUrl = videoInfo.url;
    
    if (!directUrl && videoInfo.formats) {
        const validFormats = videoInfo.formats.filter(f => f.url && !f.url.includes('.m3u8'));
        if (validFormats.length > 0) {
            directUrl = validFormats[validFormats.length - 1].url;
        } else {
            directUrl = videoInfo.formats[videoInfo.formats.length - 1].url;
        }
    }

    return {
        success: true,
        title: videoInfo.title || videoInfo.description || "Social Media Video",
        thumbnail: videoInfo.thumbnail || (videoInfo.thumbnails && videoInfo.thumbnails[0]?.url) || "",
        duration: videoInfo.duration_string || "N/A",
        downloadUrl: directUrl,
        platform: videoInfo.extractor_key || "Universal"
    };
}

// 1. POST ROUTE
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        let data = await getVideoDataWithRetry(videoUrl);
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. GET ROUTE
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL missing hai!" });

    try {
        let data = await getVideoDataWithRetry(videoUrl);
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 All-Platform Fix Engine live on port ${PORT}`);
});