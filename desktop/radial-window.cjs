 'use strict';
function radialBounds(b,area){const width=Math.min(760,area.width),height=Math.min(650,area.height);return {x:Math.round(Math.max(area.x,Math.min(b.x+180-width/2,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(b.y+216-height/2,area.y+area.height-height))),width,height};}
function radialEase(t){t=Math.max(0,Math.min(1,t));let u=t;for(let i=0;i<8;i++){const v=1-u,x=.66*v*v*u+1.08*v*u*u+u*u*u,derivative=.66*v*v+.84*v*u+1.92*u*u;if(derivative<1e-6)break;u=Math.max(0,Math.min(1,u-(x-t)/derivative));}return 1-Math.pow(1-u,3);}
module.exports={radialBounds,radialEase};
