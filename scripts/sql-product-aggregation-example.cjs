'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const instructors=[
 {ID:'201',name:'Dana',dept_name:'Comp. Sci.',salary:60000},
 {ID:'202',name:'Eli',dept_name:'Comp. Sci.',salary:80000},
 {ID:'203',name:'Faye',dept_name:'Physics',salary:90000},
 {ID:'204',name:'Gus',dept_name:'Physics',salary:110000}
];
const teaches=[
 {ID:'201',course_id:'CS-210',sec_id:'1',semester:'Fall',year:2026},
 {ID:'202',course_id:'CS-315',sec_id:'1',semester:'Spring',year:2027}
];
const product=instructors.slice(0,2).flatMap(i=>teaches.map(t=>({
 'instructor.ID':i.ID,name:i.name,dept_name:i.dept_name,salary:i.salary,
 'teaches.ID':t.ID,course_id:t.course_id,sec_id:t.sec_id,semester:t.semester,year:t.year
})));
const depts=[...new Set(instructors.map(i=>i.dept_name))];
const means=depts.map(dept_name=>{
 const rows=instructors.filter(i=>i.dept_name===dept_name);
 return {dept_name,avg_salary:rows.reduce((s,r)=>s+r.salary,0)/rows.length};
});
assert.equal(product.length,4);
assert.equal(product.filter(r=>r['instructor.ID']!==r['teaches.ID']).length,2);
assert.deepEqual(means.map(r=>r.avg_salary),[70000,100000]);
const tables={
 product:{columns:Object.keys(product[0]),rows:product},
 instructors:{columns:Object.keys(instructors[0]),rows:instructors},
 means:{columns:Object.keys(means[0]),rows:means}
};
fs.writeFileSync('docs/image-refresh/examples/sql-product-aggregation.json',JSON.stringify({note:'Original illustrative dataset. Cartesian example uses first two instructors; aggregation uses all four.',tables},null,2)+'\n');
console.log('Cartesian and GROUP BY verified: 2x2=4, 2 mismatches retained; averages 70000 and100000.');

