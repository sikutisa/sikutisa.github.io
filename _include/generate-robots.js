function generateRobots(site) {
  if (!site.siteUrl) throw new Error('SITE_URL or a GitHub repository remote is required for robots.txt');
  site.write('robots.txt', `User-agent: *\nDisallow:\nSitemap: ${site.siteUrl}${site.config.BASE_URL}/sitemap.xml\n`);
  console.log('✔ Generated robots.txt');
}

if (require.main === module) require('./cli').run(generateRobots);
module.exports = { generateRobots };
