const GITHUB_REPO_URL = "https://raw.githubusercontent.com/devpixel781-cyber/baldi-2d-game/main/version.json";
const LOCAL_GAME_VERSION = "1.0.0";

async function checkOnlineUpdates() {
    try {
        const res = await fetch(GITHUB_REPO_URL + '?t=' + new Date().getTime());
        if (res.ok) {
            const remoteData = await res.json();
            if (remoteData.version && remoteData.version !== LOCAL_GAME_VERSION) {
                console.log(`✨ تم إيجاد تحديث جديد: ${remoteData.version}`);
                showUpdateNotice(remoteData.version, remoteData.changelog);
            }
        }
    } catch (err) {
        console.warn("🌐 متعذر الاتصال برابط التحديثات أونلاين حالياً.");
    }
}

function showUpdateNotice(newVer, changelog) {
    const msg = `يوجد إصدار جديد متوفر للعبة (${newVer})!\n\nالتغييرات الجديدة:\n${changelog}\n\nيرجى تحديث اللعبة للحصول على أفضل تجربة.`;
    document.getElementById('overlay-title').innerText = "📢 تحديث جديد متوفر!";
    document.getElementById('overlay-message').innerText = msg;
    document.getElementById('overlay').classList.remove('hidden');
}