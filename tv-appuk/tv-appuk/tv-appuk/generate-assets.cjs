const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function main() {
  if (!fs.existsSync('assets')) fs.mkdirSync('assets');

  const logo = await loadImage('logo.png');

  const bgCanvas = createCanvas(1024, 1024);
  const bgCtx = bgCanvas.getContext('2d');
  bgCtx.fillStyle = '#4B1E8A';
  bgCtx.fillRect(0, 0, 1024, 1024);
  fs.writeFileSync('assets/icon-background.png', bgCanvas.toBuffer());

  const iconCanvas = createCanvas(1024, 1024);
  const iconCtx = iconCanvas.getContext('2d');
  const scale = Math.min(550 / logo.width, 550 / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  iconCtx.drawImage(logo, (1024 - w) / 2, (1024 - h) / 2, w, h);
  fs.writeFileSync('assets/icon-foreground.png', iconCanvas.toBuffer());
  
  const splashCanvas = createCanvas(2732, 2732);
  const splashCtx = splashCanvas.getContext('2d');
  splashCtx.fillStyle = '#000000';
  splashCtx.fillRect(0, 0, 2732, 2732);

  splashCtx.beginPath();
  splashCtx.arc(2732 / 2, 2732 / 2, 500, 0, 2 * Math.PI);
  splashCtx.lineWidth = 15;
  splashCtx.strokeStyle = '#D4AF37';
  splashCtx.stroke();

  const splashLogoScale = Math.min(700 / logo.width, 700 / logo.height);
  const slW = logo.width * splashLogoScale;
  const slH = logo.height * splashLogoScale;
  splashCtx.drawImage(logo, (2732 - slW) / 2, (2732 - slH) / 2, slW, slH);
  fs.writeFileSync('assets/splash.png', splashCanvas.toBuffer());

  // Detect content bounds to fix centering (logo has extra transparent padding)
  const btmp = createCanvas(logo.width, logo.height);
  const btmpCtx = btmp.getContext('2d');
  btmpCtx.drawImage(logo, 0, 0);
  const bd = btmpCtx.getImageData(0, 0, logo.width, logo.height).data;
  let bMinY=logo.height, bMaxY=0, bMinX=logo.width, bMaxX=0;
  for(let y=0;y<logo.height;y++) for(let x=0;x<logo.width;x++){
    const a=bd[(y*logo.width+x)*4+3];
    if(a>10){if(y<bMinY)bMinY=y;if(y>bMaxY)bMaxY=y;if(x<bMinX)bMinX=x;if(x>bMaxX)bMaxX=x;}
  }
  const bCropW = bMaxX - bMinX, bCropH = bMaxY - bMinY;

  const bannerCanvas = createCanvas(320, 180);
  const bannerCtx = bannerCanvas.getContext('2d');
  bannerCtx.fillStyle = '#4B1E8A';
  bannerCtx.fillRect(0, 0, 320, 180);
  const bannerLogoScale = Math.min(260 / bCropW, 140 / bCropH);
  const blW = bCropW * bannerLogoScale;
  const blH = bCropH * bannerLogoScale;
  bannerCtx.drawImage(logo, bMinX, bMinY, bCropW, bCropH, (320 - blW) / 2, (180 - blH) / 2, blW, blH);
  
  const bannerDir = 'android/app/src/main/res/drawable-xhdpi';
  if (!fs.existsSync(bannerDir)) fs.mkdirSync(bannerDir, { recursive: true });
  fs.writeFileSync(bannerDir + '/banner.png', bannerCanvas.toBuffer());
  
  console.log('Assets generated successfully!');
}

main().catch(console.error);
