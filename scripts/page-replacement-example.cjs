// Numerical verification for the reference string in Virtual_Memory.md.
// Produces data only; all replacement images are made by the image-generation tool.
const fs = require('node:fs');
const path = require('node:path');
const refs = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
function simulate(policy, capacity, references) {
  const frames = Array(capacity).fill(null), last = new Map(), fifo = [];
  const steps = references.map((page, index) => {
    const fault = !frames.includes(page); let victim = null;
    if (fault) {
      let frame = frames.indexOf(null);
      if (frame < 0) {
        if (policy === 'FIFO') frame = fifo.shift();
        else if (policy === 'LRU') frame = frames.reduce((best, resident, i) => last.get(resident) < last.get(frames[best]) ? i : best, 0);
        else if (policy === 'OPT') {
          const next = frames.map(resident => { const at = references.indexOf(resident, index + 1); return at < 0 ? Infinity : at; });
          frame = next.indexOf(Math.max(...next));
        } else throw new Error('Unknown policy');
        victim = frames[frame];
      }
      frames[frame] = page;
      if (policy === 'FIFO') fifo.push(frame);
    }
    last.set(page, index);
    return { step: index + 1, page, frames: [...frames], fault, victim };
  });
  return { policy, capacity, references, faults: steps.filter(step => step.fault).length, steps };
}
const examples = ['FIFO', 'OPT', 'LRU'].map(policy => simulate(policy, 3, refs));
if (JSON.stringify(examples.map(example => example.faults)) !== '[15,9,12]') throw new Error('Reference fault counts differ from the document');
const anomalyRefs = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
const anomaly = Array.from({ length: 7 }, (_, i) => ({ frames: i + 1, faults: simulate('FIFO', i + 1, anomalyRefs).faults }));
if (anomaly[2].faults !== 9 || anomaly[3].faults !== 10) throw new Error('Belady anomaly example mismatch');
const result = { source: '_wiki/Computer_Science/Operating_System/Virtual_Memory/Virtual_Memory.md',
  note: 'Original figures use a 20-reference version; the Markdown contains two additional hit references 0,3. New tables use the complete 22-reference Markdown sequence. Fault totals remain 15/9/12.',
  examples, anomalyReferences: anomalyRefs, anomaly };
const output = path.resolve(__dirname, '../docs/image-refresh/examples/virtual-memory.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ faultTotals: examples.map(item => [item.policy, item.faults]), anomaly, output }, null, 2));
