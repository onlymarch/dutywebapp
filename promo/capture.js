// 영상용 실제 앱 화면 캡처 (영어). 사용: node promo/capture.js
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
async function page(lang){const ctx=await b.newContext({viewport:{width:1280,height:1100},deviceScaleFactor:2,locale:lang==='en'?'en-US':lang});await ctx.addInitScript(()=>{try{localStorage.setItem('dfiDuty:welcomeDone','1')}catch(e){}});const p=await ctx.newPage();
 await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.selectOption('#langSelect',lang);await p.addStyleTag({content:'header.top{position:static!important}.toast{display:none!important}'});return p;}
async function gen(p,tgt){await p.evaluate(t=>{const el=document.querySelector('#minDFI');el.value=String(t);el.dispatchEvent(new Event('input'));},tgt);
 await p.click('#btnGenerate');await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000});await p.waitForTimeout(300);if(await p.$('#diagDialog[open]'))await p.click('#diagClose');}
const p=await page('en');await p.click('#btnSample');await p.waitForTimeout(300);
await (await p.$('#ctrlCard')).screenshot({path:__dirname+'/settings.png'});
// 명단 상단 6행
const rc=await p.$('#rosterCard');await rc.scrollIntoViewIfNeeded();await rc.screenshot({path:__dirname+'/roster.png'});   // 명단 카드 전체 (영상에서 위쪽만 보이게 잘라 표시)
// 날짜 팝오버
await p.click('[data-dp="1"]');await p.click('#dp [data-dd="12"]');await p.click('#dp [data-mode="avoid"]');await p.click('#dp [data-dd="24"]');await p.click('#dp [data-dd="25"]');await p.click('#dp [data-mode="wish"]');
await (await p.$('#dp')).screenshot({path:__dirname+'/dp.png'});await p.keyboard.press('Escape');
// 원래 샘플로 되돌리고 생성 (높은 목표 90 → 20,000회)
await p.click('#btnSample');await p.click('#askYes');await p.waitForTimeout(300);
await gen(p,90);
const info=await p.evaluate(()=>({dfi:state.result.dfi.total,grade:state.result.dfi.grade,attempts:state.run.attempts,ms:Math.round(state.run.ms),metrics:state.result.dfi.metrics.map(m=>[m.key,+m.score.toFixed(1),m.max])}));
console.log(JSON.stringify(info));require('fs').writeFileSync(__dirname+'/info.json',JSON.stringify(info));
await (await p.$('#genCard')).screenshot({path:__dirname+'/gen.png'});
await (await p.$('.cand-section')).screenshot({path:__dirname+'/cands.png'});
await p.evaluate(()=>{const n=[...document.querySelectorAll('#cal .duty-name')].find(x=>x.textContent==='Sophia');n&&n.click();});await p.waitForTimeout(150);
await (await p.$('.cal-row')).screenshot({path:__dirname+'/results.png'});
await (await p.$('#dfiCard')).screenshot({path:__dirname+'/dfi.png'});
const html=await p.evaluate(()=>buildPrintDoc(false));
const q=await b.newPage({viewport:{width:900,height:1250},deviceScaleFactor:2});await q.setContent(html);await q.waitForTimeout(300);await (await q.$('.page')).screenshot({path:__dirname+'/print.png'});
// 언어별 결과 달력 머리 부분
for(const l of ['ko','ja','zh','fr','es','en']){const r=await page(l);await r.click('#btnSample');await r.waitForTimeout(200);await gen(r,70);
 const c=await r.$('.cal-row section');const cb=await c.boundingBox();await r.screenshot({path:__dirname+`/lang_${l}.png`,clip:{x:cb.x,y:cb.y,width:cb.width,height:Math.min(cb.height,330)}});await r.context().close();}
// 언어별 앱 첫 화면 (머리글 + 설정 상단) — 언어 장면에서 크게 표시
for(const l of ['en','ko','ja','zh','fr','es']){const r=await page(l);await r.click('#btnSample');await r.waitForTimeout(800);
 await r.evaluate(()=>scrollTo(0,0));await r.screenshot({path:__dirname+`/top_${l}.png`,clip:{x:0,y:0,width:1280,height:560}});await r.context().close();}
await b.close();})()
