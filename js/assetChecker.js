const MANDATORY_ASSETS = [
    { name: 'baldi', path: 'assets/baldi.png' },
    { name: 'door', path: 'assets/door.png' },
    { name: 'desk', path: 'assets/desk.png' },
    { name: 'book', path: 'assets/book.png' }
];

async function verifyGameAssets() {
    console.log("🔒 جاري التحقق من أصول اللعبة وحمايتها...");
    
    for (const asset of MANDATORY_ASSETS) {
        try {
            const response = await fetch(asset.path, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`الملف المفقود: ${asset.path}`);
            }
        } catch (error) {
            showFatalError(
                "خطأ في نظام الأمان وحماية الأصول",
                `تعذر العثور على ملف الصورة المهم: (${asset.path}).\nيرجى التأكد من وضع كافة الصور بنفس الأسماء في مجلد assets.`
            );
            return false;
        }
    }
    return true;
}

function showFatalError(title, msg) {
    const overlay = document.getElementById('overlay');
    document.getElementById('overlay-title').innerText = title;
    document.getElementById('overlay-message').innerText = msg;
    overlay.classList.remove('hidden');
    document.getElementById('start-screen').classList.add('hidden');
}

function handleOverlayClick() {
    document.getElementById('overlay').classList.add('hidden');
}