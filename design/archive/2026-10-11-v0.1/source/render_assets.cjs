// Local artifact renderer. Does not access browser or application state.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');

async function render() {
  const files = ['assets', 'previews'].flatMap(folder => fs.readdirSync(path.join(root, folder))
    .filter(name => name.endsWith('.svg')).map(name => path.join(root, folder, name)));
  for (const source of files) {
    const name = path.basename(source);
    const options = { density: 72 };
    let img = sharp(source, options);
    if (/mark(?:-small|-mono|-white)?\.svg$/.test(name)) img = img.resize(512, 512);
    await img.png().toFile(source.replace(/\.svg$/, '.png'));
  }
  for (const key of ['ldsp', 'plugin', 'store']) {
    const images = [];
    for (const size of [16, 32, 48]) {
      const png = await sharp(path.join(root, 'assets', `${key}-favicon.svg`)).resize(size, size).png().toBuffer();
      images.push({ size, png });
    }
    // ICO containing PNG images; widely supported on current browsers and Windows.
    const header = Buffer.alloc(6 + images.length * 16);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach(({ size, png }, index) => {
      const p = 6 + 16 * index;
      header[p] = size; header[p + 1] = size;
      header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
      header.writeUInt32LE(png.length, p + 8); header.writeUInt32LE(offset, p + 12);
      offset += png.length;
    });
    fs.writeFileSync(path.join(root, 'assets', `${key}-favicon.ico`), Buffer.concat([header, ...images.map(i => i.png)]));
  }
  console.log(JSON.stringify({ rendered: files.length, ico: 3 }));
}
render().catch(error => { console.error(error); process.exit(1); });
