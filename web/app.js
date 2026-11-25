(()=>{
'use strict';
const $=s=>document.querySelector(s), stage=$('#stage'),scene=$('#scene'),glass=$('#glass'),body=$('#glassBody'),button=$('#lensButton'),command=$('#command'),motion=$('#motion');
const source=document.createElement('canvas'), brush=source.getContext('2d',{alpha:false}),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const params=new URLSearchParams(location.search);let controlled=params.has('capture'),engine,backend='WebGL 2',w,h,last=-1,active=true,paused=reduced.matches,clock=2.15,elapsed=0,p=1,v=0,goal=1,next=0,raf=0,latest,cycle=0,stageNo=6,bloom=true,fixture=false,hide=false,shown=true;
try{engine=Tideline.renderer(scene)}catch(e){backend='静态对照'; scene.remove();source.id='scene';stage.prepend(source);stage.classList.add('fallback');}
let notes=[
  ['01 / 03','光在边缘转弯。','看同一条亮纹：它穿过玻璃时被拉长、变软，离开后接回原来的轨迹。','折射 · 扩散 · 高光'],
  ['02 / 03','让纹理软下来。','模糊的是玻璃后的细节，不是眼前的字。保留主轮廓，透明才不会变成磨砂。','普通模糊 · 亮部扩散'],
  ['03 / 03','高光借来的颜色。','亮边有宽窄，也有环境的冷暖。只有折射光真的抵达，颜色才沿着高光延开。','环境高光 · 接触延色']
];
function note(n){const a=notes[n];body.querySelector('.kicker').lastChild.nodeValue=' '+a[0];body.querySelector('h2').textContent=a[1];body.querySelector('p').textContent=a[2];body.querySelector('.material span').textContent=a[3];}
function sync(){const a=Boolean(goal);button.setAttribute('aria-expanded',a);button.setAttribute('aria-label',a?'收起当前标本':'打开下一张光学标本');command.setAttribute('aria-expanded',a);$('#cmdText').textContent=a?'收起标本':'展开下一张标本';$('#cmdArrow').textContent=a?'↘':'↗';body.setAttribute('aria-hidden',!a);motion.setAttribute('aria-pressed',paused);motion.querySelector('span').textContent=paused?'继续光纹':'暂停光纹';motion.querySelector('b').textContent=paused?'▷':'Ⅱ'}
function dims(q){const small=w<425, W=Math.min(small?w-39:w*.68,small?352:414),H=small?190:208,C=Math.min(w-54,181),c=54,ww=Math.round(C+(W-C)*q),hh=Math.round(c+(H-c)*q),radius=Math.min(hh*.5,Math.round(27+6*q));
// The same centre of mass and a slightly biased upward anchor are maintained in both endpoints.
return {x:Math.round((w-ww)*.50),y:Math.round(h*.51 - hh*.51),ww,hh,r:radius}}
function show(q,t,options={}){
  let d=dims(q);latest=d;glass.style.cssText='left:'+d.x+'px;top:'+d.y+'px;width:'+d.ww+'px;height:'+d.hh+'px;border-radius:'+d.r+'px';
  const face=Math.max(0,Math.min(1,(q-.39)/.57));body.style.opacity=hide?0:face;body.style.transform='translateY('+((1-face)*6).toFixed(2)+'px)';button.style.opacity=hide?0:1;
  const short=1-Math.max(0,Math.min(1,q/.40));button.querySelector('.btn-label').style.cssText='opacity:'+short+';display:'+(short<.01?'none':'inline');
  button.querySelector('.lens-icon i+i').style.transform='rotate('+(90*(1-q))+'deg)';button.style.bottom=(11.0+2*q)+'px';button.style.right=(17-2*q)+'px';
  paintStrata(brush,w,h,t,fixture);if(engine){engine.prepare(d.ww,d.hh,d.r);engine.render({x:d.x,y:d.y,stage:stageNo,bloom,sourceCanvas:source,time:t,plate:0,probes:0,testCase:0,shift:[0,0],color:[0,0,0],fixture:[0,0,0,0],markers:new Float32Array(8),contactWindow:[0,0]})}
  else{glass.style.background='rgba(22,47,60,.94)';glass.style.outline='1px solid #b9c4bf';document.querySelector('.image-meta span:nth-child(2)').textContent='静态可读模式 · 无折射'}
}
function advanceSpring(dt){const moving=Math.abs(goal-p)>.0005||Math.abs(v)>.005;
  if(moving){if(reduced.matches){p=goal;v=0}else{for(let i=0;i<6;i++){const j=dt/6;v+=((goal-p)*206-v*25)*j;p+=v*j}if(Math.abs(p-goal)<.0005&&Math.abs(v)<.015){p=goal;v=0}}} }
function tick(now){raf=0;if(w===undefined||!shown||document.hidden)return;
  const dt=last<0?0:Math.min(.09,(now-last)/1000);last=now;
  if(!paused&&!controlled)clock+=dt;
  const moving=Math.abs(goal-p)>.0005||Math.abs(v)>.005;
  advanceSpring(dt);
  if(!controlled)show(p,clock);
  if(!controlled&&(moving||!paused))raf=requestAnimationFrame(tick);
}
function start(){if(!controlled&&shown&&!document.hidden&&!raf){last=-1;raf=requestAnimationFrame(tick)}}
function change(){goal=1-goal;if(goal){cycle=(cycle+1)%3;note(cycle)}if(reduced.matches){p=goal;v=0;show(p,clock)}sync();start()}
button.addEventListener('click',change);command.addEventListener('click',change);motion.addEventListener('click',()=>{controlled=false;paused=!paused;sync();start()});
reduced.addEventListener('change',()=>{paused=reduced.matches;sync();start()});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else start()});
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{shown=entries[0].isIntersecting;if(!shown){cancelAnimationFrame(raf);raf=0}else start()}).observe(stage);
function size(){w=Math.round(stage.clientWidth);h=Math.round(stage.clientHeight);source.width=w;source.height=h;if(engine)engine.resize(w,h,1);show(p,clock);start()}
new ResizeObserver(size).observe(stage);sync();size();
window.specimen={get status(){return {backend,p,goal,v,paused,reduced:reduced.matches,clock,cycle,box:latest,size:[w,h]}},
// Capture does not rebuild the scene: this only supplies time, optical stage and lens position to show().
step(dt){if(!controlled)throw Error("Only in controlled capture");clock+=dt;advanceSpring(dt);show(p,clock);return this.status},
frame(q,t,opt={}){controlled=true;clock=t;cancelAnimationFrame(raf);raf=0;p=q;v=0;goal=opt.goal??(q>.50?1:0);stageNo=opt.stage??6;bloom=opt.bloom??true;fixture=!!opt.fixture;hide=!!opt.hide;cycle=opt.note??0;note(cycle);sync();show(q,t);return this.status},
resume(){controlled=false;fixture=false;hide=false;stageNo=6;bloom=true;start()}};
})();
