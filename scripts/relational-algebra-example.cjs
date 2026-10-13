'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const intro=JSON.parse(fs.readFileSync('docs/image-refresh/examples/sql-product-aggregation.json','utf8'));
const i=intro.tables.instructors.rows;
const t=[
 {ID:'201',course_id:'CS-210',sec_id:'1',semester:'Fall',year:2017},
 {ID:'202',course_id:'CS-315',sec_id:'1',semester:'Spring',year:2018}
];
const product=i.flatMap(a=>t.map(b=>({'instructor.ID':a.ID,name:a.name,dept_name:a.dept_name,salary:a.salary,'teaches.ID':b.ID,course_id:b.course_id,sec_id:b.sec_id,semester:b.semester,year:b.year})));
const joined=product.filter(r=>r['instructor.ID']===r['teaches.ID']);
const selection=i.filter(r=>r.dept_name==='Physics');
const projection=i.map(({ID,name,salary})=>({ID,name,salary}));
const fall=['CS-210','PHY-220'],spring=['CS-210','HIS-230'];
const union=[...new Set([...fall,...spring])].sort();
const intersection=fall.filter(x=>spring.includes(x)).sort();
const difference=fall.filter(x=>!spring.includes(x)).sort();
assert.equal(product.length,8);assert.equal(joined.length,2);
assert.deepEqual(union,['CS-210','HIS-230','PHY-220']);
assert.deepEqual(intersection,['CS-210']);assert.deepEqual(difference,['PHY-220']);
function table(rows){return{columns:Object.keys(rows[0]),rows};}
const tables={
 base:table(i),instance:table([i[2],i[0],i[3],i[1]]),selection:table(selection),projection:table(projection),product:table(product),joined:table(joined),
 union:table(union.map(course_id=>({course_id}))),
 intersection:table(intersection.map(course_id=>({course_id}))),
 difference:table(difference.map(course_id=>({course_id})))
};
fs.writeFileSync('docs/image-refresh/examples/relational-algebra.json',JSON.stringify({note:'Original illustrative data; chronological course sets are independent of instructor/teaches example.',courseSets:{'Fall 2017':fall,'Spring 2018':spring},tables},null,2)+'\n');
console.log('Relational algebra checked: selection2, projection4, product8, theta join2; union3, intersection1, difference1.');

