const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');
const { renderedDocument } = require('./markdown');
const { copyRequired } = require('./assets');

function generateDocuments(site) {
  const copied = new Set();
  for (const document of site.documents) {
    const rendered = renderedDocument(site, document);
    for (const image of rendered.images) {
      if (copied.has(image.source)) continue;
      if (!fs.statSync(image.source).isFile()) throw new Error(`Image is not a file: ${image.source}`);
      copyRequired(image.source, path.join(site.config.OUTPUT_DIR, 'wikis', image.relative));
      copied.add(image.source);
    }
    site.write(path.join('wikis', document.urlRel, 'index.html'), site.render(site.config.DOCUMENT_LAYOUT_PATH, {
      ...document,
      content: new Handlebars.SafeString(rendered.html),
      table_of_contents: rendered.toc ? new Handlebars.SafeString(rendered.toc) : null,
    }));
  }
  console.log(`✔ Generated ${site.documents.length} documents (${copied.size} image assets)`);
}

if (require.main === module) require('./cli').run(generateDocuments, { assets: true });
module.exports = { generateDocuments };
