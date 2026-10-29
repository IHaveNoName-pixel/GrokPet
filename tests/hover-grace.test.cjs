const {test}=require('node:test'),assert=require('node:assert/strict');
const {HoverGrace}=require('../pet/hud-model.js');
test('dock survives return movement for three seconds and returning inside renews the grace',()=>{const h=new HoverGrace(3000);assert.equal(h.update(false,100),false);h.hold(100);assert.equal(h.update(false,3099),true);assert.equal(h.update(false,3100),false);assert.equal(h.update(true,4000),true);assert.equal(h.update(false,6999),true);assert.equal(h.update(false,7000),false);});
test('a deliberate hide clears pending hover grace',()=>{const h=new HoverGrace(3000);h.hold(100);h.reset();assert.equal(h.update(false,101),false);});
