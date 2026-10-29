const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('download ring stays at measured percentage across animation cycles',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../replica/src/fx.js'),'utf8'),{window});
 const ring=()=>({style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}});
 const fx={rings:Array.from({length:5},ring),overlayAt:0,externalProgress:11};
 for(const now of [100,2500,20000]){window.GROK_FX.OverlayLayer.prototype.paintProgress.call(fx,1,now,114);const a=fx.rings[4].attrs;assert.ok(Math.abs(Number(a['stroke-dashoffset'])/Number(a['stroke-dasharray'])-.89)<.002);}
 fx.externalProgress=71;window.GROK_FX.OverlayLayer.prototype.paintProgress.call(fx,1,30000,114);assert.ok(Math.abs(Number(fx.rings[4].attrs['stroke-dashoffset'])/Number(fx.rings[4].attrs['stroke-dasharray'])-.29)<.002);
});
test('paused download releases animation priority for music',()=>{const {TransferTracker}=require('../desktop/transfer-core.cjs');const t=new TransferTracker();t.update({source:'baidu',id:'1',state:'active',percent:11},1);assert.equal(t.update({source:'baidu',id:'1',state:'paused',percent:11},2).animation,null);assert.equal(t.update({source:'baidu',id:'1',state:'active',percent:12},3).animation,'progress');});
