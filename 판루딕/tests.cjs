const assert=require('node:assert/strict');const E=require('./dist/engine.js');
for(let t=0;t<500;t++){let p=E.puzzle();assert.equal(new Set(p.cards.map(c=>c.join(','))).size,9);let solutions=E.combinations(p.cards).filter(ids=>E.matches(p.cards,ids,p.target));assert.equal(solutions.length,1);assert.deepEqual(solutions[0],p.answer)}
assert.equal(E.tripleScore(40),140);assert.equal(E.tripleScore(1),101);assert.equal(E.memoryScore(0,0),1000);assert.equal(E.memoryScore(120,20),0);assert.equal(E.memoryScore(25,2),795);
let deck=E.shuffle([...Array(8).keys(),...Array(8).keys()]);for(let n=0;n<8;n++)assert.equal(deck.filter(x=>x===n).length,2);
console.log('PASS: 500 unique-solution puzzles, scoring boundaries, pair deck');
