import sharp from "sharp";

const mark = await sharp("public/brand/picchuspot-mark-white-gold.svg")
  .resize({
    width: 500,
    height: 250,
    fit: "inside",
    withoutEnlargement: true,
  })
  .png()
  .toBuffer();

const caption = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect x="548" y="435" width="104" height="5" rx="2.5" fill="#B88A44" />
    <text
      x="600"
      y="495"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="34"
      font-weight="700"
      fill="#FFFFFF"
    >Property showcase</text>
  </svg>
`);

await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 4,
    background: "#0B1F3A",
  },
})
  .composite([
    { input: mark, left: 350, top: 120 },
    { input: caption, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile("public/brand/property-social-emergency.png");
