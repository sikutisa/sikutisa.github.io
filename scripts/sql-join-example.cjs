'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const students = [
 {ID:'101',name:'Ari',dept_name:'Comp. Sci.',tot_cred:32},
 {ID:'102',name:'Bo',dept_name:'History',tot_cred:28},
 {ID:'103',name:'Cy',dept_name:'Biology',tot_cred:20}
];
const takes = [
 {ID:'101',course_id:'CS-210',sec_id:'1',semester:'Fall',year:2026,grade:'A'},
 {ID:'101',course_id:'CS-315',sec_id:'1',semester:'Spring',year:2027,grade:'B+'},
 {ID:'102',course_id:'HIS-220',sec_id:'1',semester:'Fall',year:2026,grade:'A-'}
];
const course = [
 {course_id:'CS-210',title:'Systems',dept_name:'Comp. Sci.',credits:4},
 {course_id:'CS-315',title:'Robot Control',dept_name:'Comp. Sci.',credits:3}
];
const prereq = [
 {course_id:'CS-210',prereq_id:'CS-101'},
 {course_id:'CS-347',prereq_id:'CS-101'}
];
function join(left,right,key,kind='inner') {
 const result=[];
 for(const l of left) {
  const matches=right.filter(r=>l[key]===r[key]);
  if(matches.length) result.push(...matches.map(r=>({...l,...r})));
  else if(kind==='left'||kind==='full') result.push({...Object.fromEntries(Object.keys(right[0]).map(k=>[k,null])),...l});
 }
 if(kind==='right'||kind==='full')
  for(const r of right)
   if(!left.some(l=>l[key]===r[key])) result.push({...Object.fromEntries(Object.keys(left[0]).map(k=>[k,null])),...r});
 return result;
}
const natural=join(students,takes,'ID');
const left=join(course,prereq,'course_id','left');
const right=join(course,prereq,'course_id','right');
const full=join(course,prereq,'course_id','full');
assert.equal(natural.length,3);
assert(!natural.some(r=>r.ID==='103'));
assert.equal(left.find(r=>r.course_id==='CS-315').prereq_id,null);
assert.equal(right.find(r=>r.course_id==='CS-347').title,null);
assert.deepEqual(full.map(r=>r.course_id),['CS-210','CS-315','CS-347']);
const tables={
 student:{columns:Object.keys(students[0]),rows:students},
 takes:{columns:Object.keys(takes[0]),rows:takes},
 natural:{columns:Object.keys(natural[0]),rows:natural},
 course:{columns:Object.keys(course[0]),rows:course},
 prereq:{columns:Object.keys(prereq[0]),rows:prereq},
 left:{columns:Object.keys(left[0]),rows:left},
 right:{columns:Object.keys(right[0]),rows:right},
 full:{columns:Object.keys(full[0]),rows:full}
};
fs.mkdirSync('docs/image-refresh/examples',{recursive:true});
fs.writeFileSync('docs/image-refresh/examples/sql-joins.json',JSON.stringify({note:'Original illustrative dataset; CS-315 and CS-347 unmatched keys retained to agree with surrounding prose. No image rendering.',tables},null,2)+'\n');
console.log('SQL illustrative joins verified: inner 3, left 2, right 2, full 3 rows.');

