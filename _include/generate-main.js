function generateMain(site) {
  const recent = [...site.documents].sort((a, b) => b.lastmodIso.localeCompare(a.lastmodIso)).slice(0, 30);
  site.write('index.html', site.render(site.config.MAIN_LAYOUT_PATH, { recent_docs: recent }));
  console.log('✔ Generated home page');
}

if (require.main === module) require('./cli').run(generateMain, { assets: true });
module.exports = { generateMain };
