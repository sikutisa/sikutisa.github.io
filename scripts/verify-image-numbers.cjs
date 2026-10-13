// Independently recompute values transcribed from the educational figures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ref = [7,0,1,2,0,3,0,4,2,3,0,3,0,3,2,1,2,0,1,7,0,1];
function pages(sequence, capacity, policy) {
  const frames = [], loaded = [], last = new Map(), events = [];
  sequence.forEach((page,i) => {
    if (!frames.includes(page)) {
      let slot = frames.length, victim = null;
      if (slot === capacity) {
        if (policy === 'FIFO') slot = loaded.indexOf(Math.min(...loaded));
        if (policy === 'LRU') slot = frames.map(p=>last.get(p)).indexOf(Math.min(...frames.map(p=>last.get(p))));
        if (policy === 'OPT') {
          const future = frames.map(p=>{const n=sequence.indexOf(p,i+1);return n<0?Infinity:n;});
          slot = future.indexOf(Math.max(...future));
        }
        victim = frames[slot];
      }
      frames[slot] = page; loaded[slot] = i;
      events.push([i+1,page,...Array.from({length:capacity},(_,n)=>frames[n]??null),victim]);
    }
    last.set(page,i);
  });
  return events;
}
const expected = {
  FIFO:[[1,7,7,null,null,null],[2,0,7,0,null,null],[3,1,7,0,1,null],[4,2,2,0,1,7],[6,3,2,3,1,0],[7,0,2,3,0,1],[8,4,4,3,0,2],[9,2,4,2,0,3],[10,3,4,2,3,0],[11,0,0,2,3,4],[16,1,0,1,3,2],[17,2,0,1,2,3],[20,7,7,1,2,0],[21,0,7,0,2,1],[22,1,7,0,1,2]],
  OPT:[[1,7,7,null,null,null],[2,0,7,0,null,null],[3,1,7,0,1,null],[4,2,2,0,1,7],[6,3,2,0,3,1],[8,4,2,4,3,0],[11,0,2,0,3,4],[16,1,2,0,1,3],[20,7,7,0,1,2]],
  LRU:[[1,7,7,null,null,null],[2,0,7,0,null,null],[3,1,7,0,1,null],[4,2,2,0,1,7],[6,3,2,0,3,1],[8,4,4,0,3,2],[9,2,4,0,2,3],[10,3,4,3,2,0],[11,0,0,3,2,4],[16,1,1,3,2,0],[18,0,1,0,2,3],[20,7,1,0,7,2]]
};
const results = Object.entries(expected).map(([policy,rows])=>{
  const actual=pages(ref,3,policy); assert.deepEqual(actual,rows);
  return {subject:policy+' page-replacement figure',faults:actual.length,allFrameStatesAndVictimsMatch:true};
});
const anomaly=Array.from({length:7},(_,i)=>pages([1,2,3,4,1,2,5,1,2,3,4,5],i+1,'FIFO').length);
assert.deepEqual(anomaly,[12,12,9,10,5,5,5]);
results.push({subject:'Belady anomaly figure',faultsByFrames:anomaly});
function roundRobin(bursts,q) {
  const remaining=[...bursts], finish=bursts.map(()=>0), queue=bursts.map((_,i)=>i); let time=0;
  while(queue.length) {const i=queue.shift(),run=Math.min(q,remaining[i]);time+=run;remaining[i]-=run;if(remaining[i])queue.push(i);else finish[i]=time;}
  return {finish,waiting:finish.map((t,i)=>t-bursts[i]),averageTurnaround:finish.reduce((a,b)=>a+b)/finish.length};
}
const averages=Array.from({length:7},(_,i)=>roundRobin([6,3,1,7],i+1).averageTurnaround);
assert.deepEqual(averages,[11,11.5,10.75,11.5,12.25,10.5,10.5]);
assert.deepEqual(roundRobin([24,3,3],4).waiting,[6,4,7]);
results.push({subject:'RR turnaround graph and quantum-4 waiting table',averages,waiting:[6,4,7]});
let estimate=10;const prediction=[6,4,6,4,13,13,13].map(measured=>estimate=0.5*measured+0.5*estimate);
assert.deepEqual(prediction,[8,6,6,5,9,11,12]);
results.push({subject:'Exponential average figure',prediction});
const requests=[98,183,37,122,14,124,65,67];
const travel=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p-points[i]),0);
assert.equal(travel([53,...requests]),640);
assert.equal(travel([53,37,14,0,65,67,98,122,124,183]),236);
assert.equal(travel([53,65,67,98,122,124,183,199,0,14,37]),382);
results.push({subject:'Disk scheduling figures',FCFS:640,SCAN:236,CSCANIncludingReturn:382,CSCANExcludingReturn:183});
const allocation=[[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]], maximum=[[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
const request=[1,0,2], available=[3,3,2];
allocation[1]=allocation[1].map((n,i)=>n+request[i]);
const work=available.map((n,i)=>n-request[i]), trace=[];
assert.deepEqual(work,[2,3,0]);
for(const p of [1,3,4,0,2]) {assert(maximum[p].every((n,i)=>n-allocation[p][i]<=work[i]));allocation[p].forEach((n,i)=>work[i]+=n);trace.push({process:'T'+p,work:[...work]});}
results.push({subject:'Banker request and safe sequence figure',sequence:trace});
fs.writeFileSync('docs/image-refresh/second-review-numeric.json',JSON.stringify({at:new Date().toISOString(),passed:true,results},null,2)+'\n');
console.log(JSON.stringify({passed:true,figureFamilies:results.length}));
