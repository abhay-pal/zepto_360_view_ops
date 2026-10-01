/* Build a fully self-contained single-file build of the dashboard. */
const fs = require('fs');
const R = '/home/user/zepto-command-center/';
let html = fs.readFileSync(R + 'index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">',
  '<style>\n' + fs.readFileSync(R + 'style.css', 'utf8') + '\n</style>');
const svg64 = fs.readFileSync(R + 'assets/zepto-logo.svg').toString('base64');
html = html.split('src="assets/zepto-logo.svg"').join('src="data:image/svg+xml;base64,' + svg64 + '"');
const scripts = ['chart.umd.min.js', 'data.js', 'charts.js', 'script.js', 'export.js', 'pages1.js', 'pages2.js', 'pages3.js', 'pages4.js', 'pages5.js'];
for (const s of scripts) {
  const code = fs.readFileSync(R + s, 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace('<script src="' + s + '"></script>', '<script>\n' + code + '\n</script>');
}
fs.writeFileSync(R + 'zepto-ops-360-standalone.html', html);
console.log('bundled:', (html.length / 1024).toFixed(0) + ' KB',
  '| script refs left:', (html.match(/<script src/g) || []).length,
  '| asset refs left:', (html.match(/assets\//g) || []).length);
