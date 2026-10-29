const {test}=require('node:test');
const assert=require('node:assert/strict');
const {MetricHistory}=require('../desktop/focus.cjs');
const {trendSeries}=require('../pet/hud-model.js');
test('network history retains bytes per second without percent clamping and represents unavailable samples as gaps',()=>{const h=new MetricHistory();h.sample({download:204800,upload:0},1000);h.sample({download:-5,upload:NaN},2000);assert.equal(h.view(2000)[0].download,204800);assert.equal(h.view(2000)[0].upload,0);assert.equal(h.view(2000)[1].download,null);assert.equal(h.view(2000)[1].upload,null);});
test('network lines share a scale and preserve zero, gaps and a real minute',()=>{const now=61000;const s=trendSeries([{at:0,download:999999},{at:1000,download:100,upload:50},{at:2000,download:0,upload:0},{at:3000,download:null,upload:null},{at:4000,download:20,upload:10}],['download','upload'],now);assert.equal(s.max,100);assert.match(s.paths.download,/M0.0 1.0 L2.0 27.0 M6.0 21.8/);assert.match(s.paths.upload,/M0.0 14.0/);assert.equal(trendSeries([],['download','upload'],now).max,1);});
