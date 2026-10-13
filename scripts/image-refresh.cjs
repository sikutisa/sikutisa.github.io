const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RECORDS = path.join(ROOT, 'docs', 'image-refresh');
const MANIFEST = path.join(RECORDS, 'manifest.json');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const now = () => new Date().toISOString();
const bodyHash = content => sha(content.replace(/!\[[^\]\r\n]*\]\([^)\r\n]+\)(?:\{:\s*[^}\r\n]*\})?/g, '[IMAGE]'));

function inside(root, file) {
  const resolved = path.resolve(file);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw new Error(`Path outside ${root}: ${file}`);
  return resolved;
}
function workspace(file) { return inside(ROOT, path.resolve(ROOT, file)); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + `.${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  // Windows indexers can briefly hold the destination while watching records.
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(temp, file); break; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 7) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(200, 25 * (attempt + 1)));
    }
  }
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function save(manifest) { manifest.updatedAt = now(); writeJson(MANIFEST, manifest); }
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link: ${entry.name}`);
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function references(file) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = [...content.matchAll(/!\[([^\]\r\n]*)\]\(([^)\r\n]+)\)(?:\{:\s*[^}\r\n]*\})?/g)];
  return matches.map(match => {
    const target = match[2];
    if (/^(?:https?:|data:)/.test(target)) throw new Error(`Remote image requires separate inspection: ${file}: ${target}`);
    const resolved = inside(path.join(ROOT, '_wiki'), path.resolve(path.dirname(file), target));
    const before = content.slice(0, match.index);
    return { document: relative(file), source: relative(resolved), target, alt: match[1], token: match[0],
      line: before.split('\n').length, heading: [...before.matchAll(/^#{1,6}\s+(.+)$/gm)].at(-1)?.[1]?.trim() || '',
      context: content.slice(Math.max(0, match.index - 850), match.index + match[0].length + 1300) };
  });
}
function pngInfo(file) {
  const data = fs.readFileSync(file);
  if (data.length < 33 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error(`Not a PNG: ${file}`);
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  if (!width || !height) throw new Error(`Empty PNG: ${file}`);
  const idat = []; let end = false;
  for (let pos = 8; pos < data.length;) {
    const size = data.readUInt32BE(pos); const stop = pos + 12 + size;
    if (stop > data.length) throw new Error(`Truncated PNG: ${file}`);
    const type = data.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idat.push(data.subarray(pos + 8, pos + 8 + size));
    if (type === 'IEND') { end = true; break; }
    pos = stop;
  }
  if (!end || !idat.length || !zlib.inflateSync(Buffer.concat(idat)).length) throw new Error(`Invalid PNG data: ${file}`);
  return { width, height, sha256: sha(data), bytes: data.length };
}
function findItem(manifest, id) {
  const item = manifest.images.find(image => image.id === id);
  if (!item) throw new Error(`Unknown image ID: ${id}`);
  return item;
}
function activeReferences() {
  return walk(path.join(ROOT, '_wiki')).filter(file => file.endsWith('.md')).flatMap(references);
}
function scan() {
  const files = walk(path.join(ROOT, '_wiki'));
  const docs = files.filter(file => file.endsWith('.md'));
  let manifest;
  if (fs.existsSync(MANIFEST)) manifest = readJson(MANIFEST);
  else {
    manifest = { version: 1, createdAt: now(), initialGitStatus: execFileSync('git', ['status', '--short', '--branch'], { cwd: ROOT, encoding: 'utf8' }),
      documentBaselines: docs.map(file => ({ path: relative(file), sha256: sha(fs.readFileSync(file)), bodySha256: bodyHash(fs.readFileSync(file, 'utf8')) })), images: [], orphans: [] };
  }
  for (const file of docs) {
    let baseline = manifest.documentBaselines.find(item => item.path === relative(file));
    if (!baseline) {
      baseline = { path: relative(file), sha256: sha(fs.readFileSync(file)), addedAt: now() };
      manifest.documentBaselines.push(baseline);
    }
    if (!baseline.bodySha256) baseline.bodySha256 = bodyHash(fs.readFileSync(file, 'utf8'));
  }
  const refs = docs.flatMap(references);
  for (const ref of refs) {
    if (manifest.images.some(item => item.original === ref.source || item.generated === ref.source)) continue;
    if (!fs.existsSync(workspace(ref.source))) throw new Error(`Missing source: ${ref.source}`);
    const id = sha(ref.source).slice(0, 12);
    const generated = ref.source.replace(/\.[^.]+$/, '-generated.png');
    manifest.images.push({ id, document: ref.document, original: ref.source, generated, originalSha256: sha(fs.readFileSync(workspace(ref.source))),
      originalReference: ref, status: 'pending', attempts: [], reviews: [], createdAt: now() });
  }
  manifest.inventory = { documents: docs.length, documentsWithImages: new Set(refs.map(ref => ref.document)).size, references: refs.length, images: manifest.images.length };
  const known = new Set(manifest.images.flatMap(item => [item.original, item.generated]));
  for (const file of files.filter(file => /\.(png|jpe?g|webp|svg)$/i.test(file))) {
    const rel = relative(file);
    if (!known.has(rel) && !manifest.orphans.some(item => item.path === rel)) manifest.orphans.push({ path: rel, sha256: sha(fs.readFileSync(file)), status: 'pending-inspection' });
  }
  save(manifest); return manifest.inventory;
}
function validateSpec(spec) {
  if (spec.originalViewed !== true || spec.documentReviewed !== true) throw new Error('Read the full document and view the original first');
  for (const field of ['purpose', 'alt', 'prompt']) if (typeof spec[field] !== 'string' || !spec[field].trim()) throw new Error(`Missing ${field}`);
  if (!Array.isArray(spec.requiredChecks) || !spec.requiredChecks.length || spec.requiredChecks.some(check => typeof check !== 'string' || !check.trim())) throw new Error('Missing explicit requiredChecks');
  if (/[\]\r\n]/.test(spec.alt)) throw new Error('Alt text cannot contain closing brackets or newlines');
}
function validateReview(spec, review) {
  if (review.viewed !== true || review.decoded !== true || typeof review.passed !== 'boolean') throw new Error('Visual and decode verification required');
  if (!Array.isArray(review.checks) || review.checks.length !== spec.requiredChecks.length) throw new Error('Every requirement needs a review');
  for (let i = 0; i < spec.requiredChecks.length; i++) {
    const check = review.checks[i];
    if (check.requirement !== spec.requiredChecks[i] || typeof check.passed !== 'boolean' || typeof check.evidence !== 'string' || !check.evidence.trim()) throw new Error(`Missing evidence for requirement ${i + 1}`);
    if (review.passed && !check.passed) throw new Error('Failed check cannot be approved');
  }
  if (typeof review.notes !== 'string' || !review.notes.trim()) throw new Error('Review notes required');
}
function approved(manifest, item) {
  const spec = readJson(workspace(item.spec));
  const review = readJson(workspace(item.review));
  validateSpec(spec); validateReview(spec, review);
  const info = pngInfo(workspace(item.generated));
  if (!review.passed || review.generatedSha256 !== info.sha256 || review.specSha256 !== sha(fs.readFileSync(workspace(item.spec)))) throw new Error('Approval does not match current image/spec');
  return { spec, info };
}
function apply(manifest, item) {
  const { spec, info } = approved(manifest, item);
  const refs = activeReferences().filter(ref => ref.source === item.original);
  if (!refs.length) {
    if (activeReferences().some(ref => ref.source === item.generated)) { item.status = 'applied'; save(manifest); return; }
    throw new Error('Original is no longer referenced; inspect user changes before applying');
  }
  if (sha(fs.readFileSync(workspace(item.original))) !== item.originalSha256) throw new Error('Original changed after inventory');
  for (const document of new Set(refs.map(ref => ref.document))) {
    const file = workspace(document); const before = fs.readFileSync(file, 'utf8');
    let after = before;
    for (const ref of refs.filter(ref => ref.document === document)) {
      const target = path.relative(path.dirname(file), workspace(item.generated)).split(path.sep).join('/');
      const width = Math.min(760, info.width);
      const replacement = `![${spec.alt}](./${target}){: w="${width}"}`;
      after = after.replace(ref.token, replacement);
    }
    fs.writeFileSync(file, after);
    (item.appliedDocuments ||= []).push({ path: document, beforeSha256: sha(before), afterSha256: sha(after), appliedAt: now() });
  }
  item.status = 'applied'; item.appliedAt = now(); save(manifest);
}
function retire(manifest, item) {
  approved(manifest, item);
  const refs = activeReferences();
  if (refs.some(ref => ref.source === item.original) || !refs.some(ref => ref.source === item.generated)) throw new Error('Cannot remove an active original or an unreferenced replacement');
  const original = workspace(item.original);
  if (fs.existsSync(original)) {
    if (sha(fs.readFileSync(original)) !== item.originalSha256) throw new Error('Original changed; refusing deletion');
    fs.unlinkSync(original);
  }
  const wikiRel = path.relative(path.join(ROOT, '_wiki'), original);
  for (const candidate of [path.join(ROOT, 'public', 'wikis', wikiRel), path.join(ROOT, 'public', wikiRel)]) {
    const safe = inside(path.join(ROOT, 'public'), candidate);
    if (fs.existsSync(safe)) {
      if (sha(fs.readFileSync(safe)) !== item.originalSha256) throw new Error(`Old public asset differs: ${relative(safe)}; inspect manually`);
      fs.unlinkSync(safe);
    }
  }
  item.status = 'completed'; item.retiredAt = now(); save(manifest);
}
function audit(manifest) {
  const refs = activeReferences(); const issues = [];
  for (const ref of refs) if (!fs.existsSync(workspace(ref.source))) issues.push(`Missing reference: ${ref.document}: ${ref.target}`);
  for (const ref of refs) if (!manifest.images.some(item => ref.source === item.original || ref.source === item.generated)) issues.push(`Uninventoried image: ${ref.source}; run scan`);
  for (const baseline of manifest.documentBaselines) {
    if (!fs.existsSync(workspace(baseline.path))) issues.push(`Document removed: ${baseline.path}`);
    else if (baseline.bodySha256 && bodyHash(fs.readFileSync(workspace(baseline.path), 'utf8')) !== baseline.bodySha256) issues.push(`Document body changed beyond image tokens: ${baseline.path}; inspect user edits`);
  }
  for (const item of manifest.images) {
    if (['reviewed', 'applied', 'completed'].includes(item.status)) {
      try { approved(manifest, item); } catch (err) { issues.push(`${item.id}: ${err.message}`); }
    }
    if (item.status === 'completed') {
      if (fs.existsSync(workspace(item.original))) issues.push(`Completed original remains: ${item.original}`);
      if (refs.some(ref => ref.source === item.original)) issues.push(`Original still referenced: ${item.original}`);
      if (!refs.some(ref => ref.source === item.generated)) issues.push(`Replacement no longer referenced: ${item.generated}`);
    }
  }
  const pending = manifest.images.filter(item => item.status !== 'completed').length;
  const report = { at: now(), total: manifest.images.length, completed: manifest.images.length - pending, pending, orphanPending: manifest.orphans.filter(item => item.status !== 'removed').length, issues };
  writeJson(path.join(RECORDS, 'audit.json'), report);
  return report;
}
function main(args) {
  const [command, id, input] = args;
  if (command === 'scan') return scan();
  const manifest = readJson(MANIFEST);
  if (command === 'status') return { inventory: manifest.inventory, statuses: manifest.images.reduce((out, item) => { out[item.status] = (out[item.status] || 0) + 1; return out; }, {}), next: manifest.images.filter(item => item.status !== 'completed').slice(0, 8).map(item => ({ id: item.id, original: item.original, status: item.status })) };
  if (command === 'audit') return audit(manifest);
  const item = findItem(manifest, id);
  if (command === 'spec') {
    if (item.status === 'completed') throw new Error('Completed item cannot be re-specified automatically');
    const spec = readJson(path.resolve(input)); validateSpec(spec);
    item.spec = `docs/image-refresh/specs/${id}.json`; writeJson(workspace(item.spec), spec);
    item.status = 'analyzed'; item.analyzedAt = now(); save(manifest); return { id, status: item.status };
  }
  if (command === 'import') {
    if (!item.spec) throw new Error('Record a spec before generating');
    if (['applied', 'completed'].includes(item.status)) throw new Error('Do not overwrite a published replacement');
    const info = pngInfo(path.resolve(input));
    const dest = workspace(item.generated);
    if (path.resolve(input) !== dest) fs.copyFileSync(path.resolve(input), dest);
    item.attempts.push({ at: now(), tool: 'built-in image_gen', sourcePath: path.resolve(input), ...info });
    item.status = 'generated'; save(manifest); return { id, destination: item.generated, ...info };
  }
  if (command === 'review') {
    if (item.status !== 'generated' && item.status !== 'reviewed') throw new Error('Review a generated result first');
    const spec = readJson(workspace(item.spec)); const review = readJson(path.resolve(input)); validateReview(spec, review);
    const info = pngInfo(workspace(item.generated));
    Object.assign(review, { at: now(), generatedSha256: info.sha256, specSha256: sha(fs.readFileSync(workspace(item.spec))) });
    const record = `docs/image-refresh/reviews/${id}-${item.attempts.length}.json`;
    writeJson(workspace(record), review); item.review = record; item.reviews.push(record);
    item.status = review.passed ? 'reviewed' : 'needs-revision'; save(manifest); return { id, status: item.status };
  }
  if (command === 'apply') { apply(manifest, item); return { id, status: item.status }; }
  if (command === 'retire') { retire(manifest, item); return { id, status: item.status }; }
  throw new Error(`Unknown command: ${command}`);
}
if (require.main === module) {
  try { const result = main(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); if (result?.issues?.length) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inside, references, pngInfo, validateSpec, validateReview };
