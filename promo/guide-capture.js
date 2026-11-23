// 가이드 영상용 실제 앱 화면 캡처 (영어·한국어).
// 사용: node promo/guide-capture.js   → promo/guide/<en|ko>/*.png + manifest.json
// 화면: 뷰포트 1600×900 × 배율 1.2 = 1920×1080 (영상 한 프레임 크기 그대로).
// manifest.json에는 각 화면에서 커서가 가리킬 요소의 위치(영상 픽셀 좌표)를 기록합니다.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const APP='file://'+path.resolve(__dirname,'..','index.html'), S=1.2;
(async()=>{const b=await chromium.launch();
for(const lang of ['en','ko']){
  const dir=path.join(__dirname,'guide',lang);fs.mkdirSync(dir,{recursive:true});
  const ctx=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:S,locale:lang==='en'?'en-US':'ko-KR'});
  const p=await ctx.newPage();await p.goto(APP);await p.selectOption('#langSelect',lang);
  await p.addStyleTag({content:'.toast{display:none!important}*{scroll-behavior:auto!important}main{padding-bottom:560px!important}'});   // 아래 여백: 맨 아래 카드도 화면 가운데로 스크롤 가능
  const M={};
  // 요소 위치(영상 픽셀). 화면 밖이면 null
  const rect=async sel=>{const r=await p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [b.x,b.y,b.width,b.height];},sel);return r&&r.map(v=>Math.round(v*S));};
  const center=async(sel,block='center')=>{await p.evaluate(([s,bl])=>{const e=document.querySelector(s);const y=e.getBoundingClientRect().top+scrollY;
      scrollTo(0,bl==='top'?y-70:y-innerHeight/2+e.getBoundingClientRect().height/2);},[sel,block]);await p.waitForTimeout(150);};
  const shot=async(name,targets)=>{await p.screenshot({path:path.join(dir,name+'.png')});const t={};for(const [k,s] of Object.entries(targets))t[k]=await rect(s);M[name]=t;};
  // 영어 화면은 내장 공휴일이 없으므로 직접 입력한 모습(크리스마스)으로 촬영
  const hol=async()=>{if(lang!=='ko'){await p.fill('#holidays','25');await p.waitForTimeout(500);}};
  const gen=async()=>{await p.click('#btnGenerate');await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000});await p.waitForTimeout(400);if(await p.$('#diagDialog[open]'))await p.click('#diagClose');};

  // ① 설정 (샘플을 불러온 깨끗한 상태)
  await p.click('#btnSample');await p.waitForTimeout(700);await hol();
  await p.evaluate(()=>{const el=document.querySelector('#minDFI');el.value='70';el.dispatchEvent(new Event('input'));});await p.waitForTimeout(500);
  await center('#ctrlCard','top');
  await shot('s1',{ym:'#ym',holidays:'#holidays',miniCal:'#miniCal',restW:'.sg-rule',minDFI:'.sg-gen'});
  // ② 명단
  await center('#btnSample');
  await shot('s2z',{sample:'#btnSample',add:'#btnAddRow',table:'#rosterWrap'});
  await center('#rosterCard','top');
  await shot('s2a',{sample:'#btnSample',add:'#btnAddRow',avail:'#roster input[data-i="1"][data-f="avail"]',wishDow:'#roster tr:nth-child(2) td:nth-child(8) .dow',dp:'#roster [data-dp="1"]'});
  await p.click('#roster input[data-i="1"][data-f="avail"]');await p.keyboard.type('20-22',{delay:20});await p.waitForTimeout(200);
  await p.click('#roster tr:nth-child(2) td:nth-child(8) .dow button[data-k="3"]');await p.waitForTimeout(150);
  await p.mouse.move(5,5);
  await shot('s2b',{avail:'#roster tr:nth-child(2) td:nth-child(9)',wishDow:'#roster tr:nth-child(2) td:nth-child(8) .dow'});
  await p.click('#roster [data-dp="1"]');await p.click('#dp [data-dd="12"]');await p.click('#dp [data-mode="avoid"]');await p.click('#dp [data-dd="25"]');
  await p.mouse.move(5,5);await p.waitForTimeout(150);
  await shot('s2c',{dp:'#dp',dpbtn:'#roster [data-dp="1"]',day:'#dp [data-dd="25"]'});
  await p.keyboard.press('Escape');
  // 입력 원상 복구 (생성 결과가 샘플 기준이 되도록)
  await p.click('#btnSample');await p.click('#askYes');await p.waitForTimeout(700);await hol();
  await p.evaluate(()=>{const el=document.querySelector('#minDFI');el.value='70';el.dispatchEvent(new Event('input'));});await p.waitForTimeout(500);
  // ③ 생성
  await center('#genCard','top');
  await shot('s3a',{precheck:'#precheck',gen:'#btnGenerate'});
  await gen();await center('#genCard','top');
  await shot('s3b',{prog:'#progText',tiles:'.run-tiles',chart:'.run-chart'});
  // ④ 결과
  await center('.cand-section','top');
  await shot('s4a',{cand2:'[data-cand="1"]',cand1:'[data-cand="0"]'});
  await center('.cal-row','top');
  const nameSel=await p.evaluate(()=>{const n=[...document.querySelectorAll('#cal .duty-name')].find(x=>x.textContent==='Sophia');return n?`#cal [data-day="${n.closest('.cell').dataset.day}"] .duty-name`:'#cal .duty-name';});
  await shot('s4b0',{name:nameSel});
  await p.click(nameSel);await p.mouse.move(5,5);await p.waitForTimeout(200);
  await shot('s4b',{name:nameSel,hl:'#hlInfo'});
  await p.click('#cal [data-edit="10"]');await p.waitForTimeout(200);
  await shot('s4c',{dialog:'#editDialog',duty:'#editDuty'});
  const edit=await rect('#cal [data-edit="10"]');M.s4c.editbtn=edit;   // 대화상자 뒤 ✎ 위치(열기 전 커서 목표)
  await p.click('#editCancel');await p.waitForTimeout(150);
  await p.hover('#gauges .gauge:nth-child(1)');await p.waitForTimeout(250);
  await shot('s4d',{gauge:'#gauges .gauge:nth-child(1)',tip:'#tip',score:'#dfiTotal'});
  await p.mouse.move(5,5);
  // ⑤ 출력·저장
  await center('#outCard');
  await shot('s5a',{print:'#btnPrint',csv:'#btnCSV',json:'#btnExportJSON',opts:'#poStats'});
  const html=await p.evaluate(()=>buildPrintDoc(false));
  const q=await b.newPage({viewport:{width:820,height:1160},deviceScaleFactor:1.6});await q.setContent(html);await q.waitForTimeout(300);
  await (await q.$('.page')).screenshot({path:path.join(dir,'print.png')});await q.close();
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(M,null,1));
  await ctx.close();console.log(lang,'ok',Object.keys(M).join(' '));
}
await b.close();})();
