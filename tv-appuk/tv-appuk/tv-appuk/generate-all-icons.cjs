const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const densities = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

async function main() {
  const logo = await loadImage('logo.png');
  const resDir = 'android/app/src/main/res';

  // Detect actual content bounds to fix centering (logo has excess transparent padding)
  const tmpCanvas = createCanvas(logo.width, logo.height);
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(logo, 0, 0);
  const d = tmpCtx.getImageData(0, 0, logo.width, logo.height).data;
  let minY = logo.height, maxY = 0, minX = logo.width, maxX = 0;
  for (let y = 0; y < logo.height; y++) {
    for (let x = 0; x < logo.width; x++) {
      const a = d[(y * logo.width + x) * 4 + 3];
      if (a > 10) {
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
      }
    }
  }
  const cropW = maxX - minX;
  const cropH = maxY - minY;

  for (const [density, size] of Object.entries(densities)) {
    const dir = `${resDir}/mipmap-${density}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Helper to draw logo cropped & centered
    function drawLogo(ctx, canvasSize, fillFraction) {
      const scale = Math.min((canvasSize * fillFraction) / cropW, (canvasSize * fillFraction) / cropH);
      const dw = cropW * scale;
      const dh = cropH * scale;
      const dx = (canvasSize - dw) / 2;
      const dy = (canvasSize - dh) / 2;
      ctx.drawImage(logo, minX, minY, cropW, cropH, dx, dy, dw, dh);
    }

    // 1. Generate Legacy Square Icon
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4B1E8A';
    ctx.fillRect(0, 0, size, size);
    drawLogo(ctx, size, 0.75);
    fs.writeFileSync(`${dir}/ic_purple_icon.png`, canvas.toBuffer());

    // 2. Generate Legacy Round Icon
    const roundCanvas = createCanvas(size, size);
    const roundCtx = roundCanvas.getContext('2d');
    roundCtx.beginPath();
    roundCtx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
    roundCtx.clip();
    roundCtx.fillStyle = '#4B1E8A';
    roundCtx.fillRect(0, 0, size, size);
    drawLogo(roundCtx, size, 0.60);
    fs.writeFileSync(`${dir}/ic_purple_icon_round.png`, roundCanvas.toBuffer());

    // 3. Generate the foreground PNG for adaptive icons
    const adaptiveSize = (108 / 48) * size;
    const adaptiveCanvas = createCanvas(adaptiveSize, adaptiveSize);
    const adaptiveCtx = adaptiveCanvas.getContext('2d');
    drawLogo(adaptiveCtx, adaptiveSize, (66 / 108) * 0.85);
    fs.writeFileSync(`${dir}/ic_purple_icon_foreground.png`, adaptiveCanvas.toBuffer());

    // Also the background
    const bgCanvas = createCanvas(adaptiveSize, adaptiveSize);
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle = '#4B1E8A';
    bgCtx.fillRect(0, 0, adaptiveSize, adaptiveSize);
    fs.writeFileSync(`${dir}/ic_purple_icon_background.png`, bgCanvas.toBuffer());
  }
  
  // 4. Generate the anydpi-v26 xmls
  const v26Dir = `${resDir}/mipmap-anydpi-v26`;
  if (!fs.existsSync(v26Dir)) fs.mkdirSync(v26Dir, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_purple_icon_background"/>
    <foreground android:drawable="@mipmap/ic_purple_icon_foreground"/>
</adaptive-icon>`;
  fs.writeFileSync(`${v26Dir}/ic_purple_icon.xml`, xml);
  fs.writeFileSync(`${v26Dir}/ic_purple_icon_round.xml`, xml);
  
  console.log('All icons generated under new name!');
}

main().catch(console.error);
