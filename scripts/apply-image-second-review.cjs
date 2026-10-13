// Apply the three visually reviewed corrections without erasing first-pass evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pngInfo, validateSpec, validateReview } = require('./image-refresh.cjs');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const bodyHash = text => sha(text.replace(/!\[[^\]\r\n]*\]\([^)\r\n]+\)(?:\{:\s*[^}\r\n]*\})?/g, '[IMAGE]'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const manifest = JSON.parse(fs.readFileSync('docs/image-refresh/manifest.json'));
const sourceDir = 'C:/Users/luke1046/.codex/generated_images/01a13349-6ff4-7122-b1a7-cb95b88e8257/';
const corrections = [
  { id: 'b43162264ce3', file: 'exec-7bfbd28b-61db-4cb8-8280-46f7549249a6.png',
    reason: 'Binary log cache is private per connection; restore omitted adaptive hash index.',
    requirements: [
      'Shared region includes InnoDB buffer pool, MyISAM key cache, Adaptive hash index, Redo log buffer and Table cache; no shared Binary log buffer.',
      'Each separate session contains Join, Sort, Network and Read buffers plus Binary log cache; no cross-session sharing connector.',
      'Both connection headings have access arrows to shared scope; the caption states query buffers are allocated as needed.'
    ],
    evidence: ['Read all five shared labels; Adaptive hash index replaces incorrectly shared binary log buffer.', 'Read five private labels independently in Session A and Session B, including Binary log cache in each.', 'Both Shared access arrows target shared heading; footer and private ownership caption are legible.'],
    prompt: 'Edit MySQL memory scopes: shared five cards InnoDB buffer pool, MyISAM key cache, Adaptive hash index, Redo log buffer, Table cache. Session A and B each have private Join buffer, Sort buffer, Network buffer, Read buffer, Binary log cache. Preserve shared access arrows and allocation-as-needed caption.',
    sources: ['https://dev.mysql.com/doc/refman/8.0/en/memory-use.html', 'https://dev.mysql.com/doc/refman/8.0/en/replication-options-binary-log.html'],
    originalBasis: 'Original untracked PNG was retired in the prior session and cannot be recovered; independently reviewed current document and official MySQL sources. originalViewed records the historical first pass, not this second pass.' },
  { id: '11bb97690e7e', file: 'exec-73e1fc7f-c3c9-43fc-9cf7-4d94e2047890.png',
    reason: 'Restore omitted SecurityControl with arm/disarm; correct Valve spelling and class count.',
    requirements: ['All fourteen original receiver classes are present, including SecurityControl.arm() and disarm().', 'All methods remain under the correct receiver; FaucetControl uses openValve() and closeValve().', 'Independent class cards show varied APIs and the Command-wrapping caption; no invented superclass.'],
    evidence: ['Counted 14 cards against the recovered original: ApplianceControl, CeilingLight, OutdoorLight, TV, Stereo, FaucetControl, CeilingFan, Hottub, GardenLight, GarageDoor, Thermostat, Sprinkler, Light, SecurityControl.', 'Visually read each method at full resolution; SecurityControl has arm/disarm and FaucetControl openValve/closeValve.', 'Cards are independent with varied operations and the Different receiver APIs caption.'],
    alt: '서로 다른 메서드를 제공하는 14개 가전 수신자 클래스와 공통 명령 인터페이스가 필요한 이유',
    prompt: 'Edit vendor chart: preserve existing thirteen receivers and methods; add SecurityControl with arm() and disarm(). Put Light and SecurityControl in the last row; correct FaucetControl openValve()/closeValve(); retain differing APIs caption.' },
  { id: '5324d78f9010', file: 'exec-03ca52ae-418b-4ca7-928b-951d124ca6ff.png',
    reason: 'Route buffer output directly to child open read descriptor, removing arrowhead beside closed descriptor.',
    requirements: ['Parent fd[0] read CLOSED and fd[1] write OPEN; child fd[0] read OPEN and fd[1] write CLOSED.', 'Exactly two data arrowheads show parent OPEN fd[1] → Kernel buffer → child OPEN fd[0]; no arrow touches CLOSED cards or follows child border.', 'Both descriptors inherited after fork; unused ends closed; one-way parent-write child-read caption preserved.'],
    evidence: ['Read the four fd labels and OPEN/CLOSED states individually.', 'Output bends upward in the empty gap before child boundary and ends at fd[0]; input ends at kernel buffer; neither CLOSED card has an arrow.', 'Both inheritance and one-way example captions are legible and match article code.'],
    prompt: 'Edit ordinary pipe after fork: preserve descriptor states and captions. Parent open fd[1] → kernel buffer → child open fd[0]. Route output upward in empty gap and right with one arrowhead on child fd[0]; no arrowhead at closed fd[1] row or container border.' }
];
const at = new Date().toISOString();
const staged = corrections.map(c => {
  const item = manifest.images.find(i => i.id === c.id);
  if (item.secondReviewRevision) throw new Error('Already applied: ' + c.id);
  const spec = JSON.parse(fs.readFileSync(item.spec));
  const previousSpec = Buffer.from(fs.readFileSync(item.spec));
  const previousInfo = pngInfo(item.generated);
  const previousReview = JSON.parse(fs.readFileSync(item.review));
  if (previousReview.generatedSha256 !== previousInfo.sha256 || previousReview.specSha256 !== sha(previousSpec)) throw new Error('Unexpected existing revision');
  Object.assign(spec, { requiredChecks: c.requirements, prompt: c.prompt, ...(c.alt ? {alt:c.alt}:{}), ...(c.sources ? {sources:c.sources}:{}), secondReviewOriginalViewed: !c.originalBasis });
  if (c.originalBasis) spec.secondReviewOriginalBasis = c.originalBasis;
  validateSpec(spec);
  const info = pngInfo(sourceDir + c.file);
  const specBytes = Buffer.from(JSON.stringify(spec, null, 2) + '\n');
  const review = { viewed:true, decoded:true, passed:true, checks:c.requirements.map((requirement,i)=>({requirement,passed:true,evidence:c.evidence[i]})), notes:'Independent second review: full-size generated PNG inspected against document and available original. ' + c.reason, at, generatedSha256:info.sha256, specSha256:sha(specBytes), originalReviewBasis:c.originalBasis || 'Recovered original PNG hash matches inventory; original and generated pixels compared side by side.' };
  validateReview(spec, review);
  return {c,item,previousSpec,previousInfo,info,specBytes,review,spec};
});
for (const {c,item,previousSpec,previousInfo,info,specBytes,review,spec} of staged) {
  const backup = '.cache/image-review/superseded/' + c.id + '.png';
  fs.mkdirSync(path.dirname(backup), {recursive:true});
  fs.copyFileSync(item.generated, backup);
  const specSnapshot = 'docs/image-refresh/specs/' + c.id + '-before-second-review.json';
  fs.writeFileSync(specSnapshot, previousSpec);
  fs.copyFileSync(sourceDir + c.file, item.generated);
  fs.writeFileSync(item.spec, specBytes);
  item.attempts.push({at,tool:'built-in image_gen',sourcePath:sourceDir+c.file,...info,reason:c.reason});
  const record = 'docs/image-refresh/reviews/' + c.id + '-' + item.attempts.length + '.json';
  write(record, review);
  const previousReview = item.review;
  item.reviews.push(record); item.review = record;
  item.secondReviewRevision = {at,reason:c.reason,previousReview,previousSpec:specSnapshot,previousSha256:previousInfo.sha256,generatedSha256:info.sha256,backup};
  if (c.alt) {
    const text = fs.readFileSync(item.document,'utf8');
    const refs = require('./image-refresh.cjs').references(path.resolve(item.document)).filter(r=>r.source===item.generated);
    if (refs.length !== 1) throw new Error('Unexpected image reference count');
    fs.writeFileSync(item.document,text.replace(refs[0].token,refs[0].token.replace('!['+refs[0].alt+']','!['+spec.alt+']')));
  }
}
function amend(document, replacements, reason, source) {
  let text = fs.readFileSync(document,'utf8');
  const baseline = manifest.documentBaselines.find(d=>d.path===document);
  if (bodyHash(text)!==baseline.bodySha256) throw new Error('Pre-existing body edits: '+document);
  const beforeSha256 = sha(text), beforeBodySha256 = bodyHash(text);
  for (const [before,after] of replacements) {
    if (!text.includes(before)) throw new Error('Missing exact replacement: '+before);
    text = text.replace(before,after);
  }
  fs.writeFileSync(document,text);
  (baseline.amendments ||= []).push({at,reason,source,beforeSha256,afterSha256:sha(text),beforeBodySha256,afterBodySha256:bodyHash(text)});
  baseline.bodySha256 = bodyHash(text);
}
amend('_wiki/Computer_Science/Operating_System/CPU_Scheduling/CPU_Scheduling.md', [
  ['\\alpha\\tau_n + (1 - \\alpha)\\tau_n','\\alpha t_n + (1 - \\alpha)\\tau_n'],
  ['$\\tau_n$ is the length of 𝑛th CPU burst,','$t_n$ is the measured length of the 𝑛th CPU burst,\r\n        * $\\tau_n$ is the previous predicted value for that burst,']
], 'Correct exponential-average formula and distinguish measured burst from previous estimate to match image 9.', 'https://www.ics.uci.edu/~ics143/lectures/oslectureset3-spr20.pdf');
amend('_wiki/Computer_Science/Operating_System/Virtual_Memory/Virtual_Memory.md', [
  ['If the reference was valid, terminate the process, or valid but page fault, we now *page it in*.','If the reference was invalid, terminate the process or report an error. If the address was valid but its page was not resident, we now *page it in*.'],
  ['EAT = 1 − 𝑝 × 𝑚𝑎 + 𝑝 ∗ (𝑝𝑎𝑔𝑒 𝑓𝑎𝑢𝑙𝑡 𝑡𝑖𝑚𝑒).','EAT = (1 − 𝑝) × 𝑚𝑎 + 𝑝 × (𝑝𝑎𝑔𝑒 𝑓𝑎𝑢𝑙𝑡 𝑡𝑖𝑚𝑒).']
], 'Correct reversed valid-address termination condition to match image 5 and restore missing probability parentheses in EAT.', 'Document page-fault diagram and the following numeric EAT example.');
amend('_wiki/Computer_Science/Database/Relational_Model/Relational_Model.md', [
  ['* *time_slot* 테이블의 *time_slot_id*는 외래키가 아님.\r\n    * *section* 테이블의 *time_slot_id*를 단순 참조 중.\r\n    * *section* 테이블의 *time_slot_id*이 primary key가 아니기 때문.', '* *section* 테이블의 *time_slot_id*는 *time_slot* 테이블의 시간대 식별자와 연관됨.\r\n    * 이 스키마에서 *time_slot*의 기본키는 *{time_slot_id, day, start_time}*이며, *time_slot_id*만으로는 행을 유일하게 식별할 수 없음.\r\n    * 따라서 이 연관 관계를 *time_slot_id* 하나의 외래키 제약으로 선언할 수 없음.']
], 'Correct time-slot association direction and the composite-key reason to match schema image 3.', 'https://www.db-book.com/slides-dir/PDF-dir/ch4.pdf');
manifest.updatedAt = at;
write('docs/image-refresh/manifest.json',manifest);
console.log(JSON.stringify({correctedImages:staged.length,amendedDocuments:3}));
