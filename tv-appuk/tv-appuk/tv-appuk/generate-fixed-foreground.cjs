const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function main() {
  const logo = await loadImage('logo.png');
  
  // Adaptive icons must be 108dp x 108dp. Safe zone is 72dp.
  // At XXXHDPI (4x), 108dp = 432px. Safe zone = 288px.
  // We will create a 432x432 image.
  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');
  
  // Scale logo to fit inside the 288px safe zone, with some padding (e.g. max width 270)
  const scale = Math.min(270 / logo.width, 270 / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  
  ctx.drawImage(logo, (432 - w) / 2, (432 - h) / 2, w, h);
  
  const targetDir = 'android/app/src/main/res/drawable-xxxhdpi';
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetDir + '/true_adaptive_foreground.png', canvas.toBuffer());
  
  console.log('Fixed foreground generated!');
}

main().catch(console.error);
