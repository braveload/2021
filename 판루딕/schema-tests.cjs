const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { games, origin } = require('./scripts/structured-data.cjs');
const root = path.join(__dirname, 'dist');
let pages = 0, entities = 0;
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const blocks = [...html.matchAll(/<script id="page-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (file === 'solo.html') { assert.equal(blocks.length, 0); assert(html.includes('noindex,follow')); continue; }
  assert.equal(blocks.length, 1, file);
  assert(!html.includes('retained-review'), 'Preview toolbar must not ship');
  assert(!html.includes('127.0.0.1'), 'Local URLs must not ship');
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@context'], 'https://schema.org');
  const graph = data['@graph'], ids = graph.map(x => x['@id']);
  assert.equal(new Set(ids).size, ids.length);
  const page = graph.find(x => ['CollectionPage', 'WebPage'].includes(x['@type']));
  assert(html.includes('rel="canonical" href="' + page.url + '"'));
  for (const node of graph) {
    assert(node['@id'].startsWith(origin + '/'));
    assert(!node.aggregateRating && !node.review, 'Never invent reviews');
    if (node.image) assert(fs.existsSync(path.join(root, node.image.slice(origin.length + 1))));
    if (node['@type'] === 'VideoGame') {
      const expected = games.find(g => g[1] === node.name); assert(expected, node.name);
      assert.equal(node.description, expected[2]);
      assert.equal(node.numberOfPlayers.maxValue, expected[5]);
      assert.equal(node.playMode, 'https://schema.org/' + expected[4]);
      entities++;
    }
  }
  if (file === 'index.html') {
    assert.equal(graph.find(x => x['@type'] === 'ItemList').numberOfItems, games.filter(g=>g[0]!=='online.html').length);
    const org=graph.find(x=>x['@type']==='Organization'),site=graph.find(x=>x['@type']==='WebSite');
    assert.equal(org.name,'판루딕');assert.equal(org.alternateName,'PANLUDIQ');assert.equal(org.url,origin+'/');
    assert.equal(site.publisher['@id'],org['@id']);assert.equal(page.publisher['@id'],org['@id']);
    assert.equal(org.logo.url,org.logo.contentUrl);assert(html.includes('src="assets/logo-transparent-v3.png"'));
    const png=fs.readFileSync(path.join(root,'assets/logo-transparent-v3.png'));
    assert.equal(org.logo.width,png.readUInt32BE(16));assert.equal(org.logo.height,png.readUInt32BE(20));
    assert(org.logo.width>=112&&org.logo.height>=112);
    for(const unsupported of ['aggregateRating','review','legalName','telephone','address','sameAs','taxID'])assert(!Object.hasOwn(org,unsupported));
    assert(!graph.some(x=>x['@type']==='BreadcrumbList'),'Do not invent a homepage hierarchy');
  }
  else {
    assert.equal(graph.filter(x => x['@type'] === 'VideoGame').length, 1);
    const crumbs = graph.filter(x => x['@type'] === 'BreadcrumbList');
    assert.equal(crumbs.length, 1, file + ': one breadcrumb');
    assert.equal(page.breadcrumb['@id'], crumbs[0]['@id']);
    assert.equal(crumbs[0].itemListElement.length, 2);
    assert.equal(crumbs[0].itemListElement[0].item, origin + '/');
    assert.equal(crumbs[0].itemListElement[1].item, page.url);
    assert.equal(crumbs[0].itemListElement[1].name, games.find(g => g[0] === file)[1]);
    assert.equal((html.match(/class="page-breadcrumb"/g) || []).length, 1);
    assert(html.includes('aria-current="page">' + crumbs[0].itemListElement[1].name + '</li>'));
  }
  pages++;
}
console.log(JSON.stringify({ passed: true, pages, gameEntities: entities, legacyRedirectNoindex: true, fabricatedReviews: false }));
