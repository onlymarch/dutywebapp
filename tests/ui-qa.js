/*
 * 인터페이스 오류 탐색 테스트 (Playwright, Chromium)
 * 실행: npx playwright install chromium   (최초 1회)
 *       node tests/ui-qa.js [index.html 경로]
 * 20개 범주(A~T) 81개 항목: 특수문자·XSS, 생성 중 프로필 전환, 실행 취소 범위, JSON 복원 검증,
 * 숫자 경계값, 극단적 명단, 날짜 팝오버, 연타·중단, Worker 차단 환경, 수동 교체, 프로필 이름,
 * 저장 전 입력 보존, 대규모 명단, 모바일 배치, 키보드 조작, 출력, 공휴일 입력, 손상된 저장값, 이전 결과 조작,
 * 기간 입력(~와 -의 변형, 날짜 형식 기간, 열린 기간 -5·20-).
 * 각 항목은 JS 예외·콘솔 오류·브라우저 기본 대화상자 발생도 함께 실패로 기록합니다.
 */

const {chromium}=require('playwright');
const path=require('path');
const FILE='file://'+path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const results=[]; const log=(id,ok,msg)=>{results.push({id,ok,msg});console.log((ok?'PASS':'FAIL')+' '+id+' — '+msg);};
async function fresh(b,opt={}){
  const ctx=await b.newContext({viewport:opt.vp||{width:1280,height:900},acceptDownloads:true});
  const p=await ctx.newPage(); p.errs=[];
  p.on('pageerror',e=>p.errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')p.errs.push('console: '+m.text())});
  p.on('dialog',d=>{p.errs.push('native dialog: '+d.message());d.dismiss();});
  if(opt.init) await p.addInitScript(opt.init);
  await p.goto(FILE); return p;
}
// 슬라이더 값 설정: 브라우저가 격자(min+k×step)에 맞춰 보정하므로 아무 값이나 넣어도 됩니다.
const setRange=(p,sel,v)=>p.evaluate(([sel,v])=>{const el=document.querySelector(sel);el.value=String(v);el.dispatchEvent(new Event('input'));},[sel,v]);
const closeDiag=async p=>{ if(await p.$('#diagDialog[open]')) await p.click('#diagClose'); };
async function gen(p,attempts='300'){ await setRange(p,'#maxAttempts',attempts);
  await p.click('#btnGenerate'); await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000}); await p.waitForTimeout(150); await closeDiag(p); }
const setPeople=(p,people)=>p.evaluate(ps=>{state.people=ps.map(x=>Object.assign(blankPerson(),x));renderRoster();scheduleSave();},people);
const errsOK=(p,id)=>{ if(p.errs.length) log(id+' 오류없음',false,p.errs.join(' | ')); };

(async()=>{const b=await chromium.launch();

// A. XSS·특수문자 이름
{const p=await fresh(b); await p.click('#btnSample');
 await p.fill('#roster input[data-i="0"][data-f="name"]','<img src=x onerror="window.__x=1">"\'&');
 await p.fill('#roster input[data-i="1"][data-f="name"]','김,"쉼표"');
 await p.waitForTimeout(500); await gen(p);
 await p.click('#cal [data-pid="0"]').catch(()=>{});
 const x=await p.evaluate(()=>window.__x); log('A1 이름 XSS',!x,x?'스크립트 실행됨':'이스케이프 정상');
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#btnCSV')]); const csv=require('fs').readFileSync(await dl.path(),'utf8');
 log('A2 CSV 따옴표·쉼표',csv.includes('"김,""쉼표"""'),'CSV 인용 처리');
 await p.click('#btnProfileSaveAs'); await p.fill('#askInput','<b>프"로\'필</b>'); await p.click('#askYes'); await p.waitForTimeout(200);
 log('A3 프로필명 특수문자',(await p.$eval('#profileSelect',s=>s.value))==='<b>프"로\'필</b>','선택값 유지');
 errsOK(p,'A'); await p.context().close();}

// B. 생성 중 프로필 전환
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(500);
 await p.click('#btnProfileSaveAs'); await p.fill('#askInput','두번째'); await p.click('#askYes'); await p.waitForTimeout(200);
 await setRange(p,'#maxAttempts','10000'); await p.click('#btnGenerate'); await p.waitForTimeout(80);
 await p.click('#btnProfileNew'); await p.fill('#askInput','빈프로필'); await p.click('#askYes');
 await p.waitForTimeout(3500);
 const shown=await p.evaluate(()=>!document.querySelector('#results').classList.contains('hidden'));
 log('B1 생성 중 새 프로필 → 이전 결과 표시 안 됨',!shown,shown?'이전 프로필 결과가 새 프로필 화면에 나타남':'정상');
 log('B2 생성 버튼 복구',!(await p.$eval('#btnGenerate',b=>b.disabled)),'');
 errsOK(p,'B'); await p.context().close();}

// C. 근무자 삭제 → 프로필 전환 → 실행 취소
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(500);
 await p.click('#btnProfileNew'); await p.fill('#askInput','P2'); await p.click('#askYes'); await p.waitForTimeout(200);
 await p.click('#btnAddRow'); await p.fill('#roster input[data-i="0"][data-f="name"]','P2사람'); await p.waitForTimeout(500);
 await p.selectOption('#profileSelect','기본'); await p.waitForTimeout(200);
 await p.click('.ops-desk [data-op="del"][data-i="0"]'); 
 await p.selectOption('#profileSelect','P2'); await p.waitForTimeout(200);
 const vis=await p.isVisible('#undoBar'); if(vis) await p.click('#undoBtn'); await p.waitForTimeout(500);
 const names=await p.evaluate(()=>state.people.map(x=>x.name));
 log('C1 삭제 취소가 다른 프로필에 섞이지 않음',!names.includes('김민수'),'P2 명단: '+names.join(','));
 errsOK(p,'C'); await p.context().close();}

// D. 잘못된 JSON 복원
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(500);
 const fs=require('fs'); const cases={
  'D1 JSON 아님':'not json',
  'D2 people에 null':JSON.stringify({settings:{year:2026,month:12},people:[null,{name:'가'}]}),
  'D3 문자열 레벨·숫자 희망일':JSON.stringify({settings:{year:2026,month:12,restW:'2'},people:[{name:'나',level:'2',wish:5,weight:'abc',max:'x'}]}),
  'D4 settings 없음':JSON.stringify({people:[]}),
 };
 for(const [id,txt] of Object.entries(cases)){
  const f=require('os').tmpdir()+'/dutyqa.json'; fs.writeFileSync(f,txt); const before=await p.evaluate(()=>JSON.stringify(serialize()));
  p.errs=[]; await p.setInputFiles('#fileJSON',f); await p.waitForTimeout(300); if(await p.isVisible('#askDialog')) await p.click('#askYes'); await p.waitForTimeout(100); const err=await p.isVisible('#diagDialog'); await closeDiag(p);
  const after=await p.evaluate(()=>JSON.stringify(serialize()));
  if(id==='D1 JSON 아님'||id==='D4 settings 없음') log(id,err&&before===after,err?(before===after?'거부·상태 유지':'거부됐지만 상태 일부 변경'):'오류 안내 없음');
  else { const ok=!p.errs.length; log(id,ok,ok?(err?'거부됨':'복원됨'):p.errs.join('|'));
    if(!err){ await gen(p,'100'); log(id+' 복원 후 생성',!p.errs.length,p.errs.join('|')||'정상'); } }
 }
 // D5 같은 이름 프로필 덮어쓰기
 await p.click('#btnProfileSaveAs'); await p.fill('#askInput','보존'); await p.click('#askYes'); await p.waitForTimeout(200);
 const keep=await p.evaluate(()=>state.people.length);
 await p.click('#btnProfileNew'); await p.fill('#askInput','작업'); await p.click('#askYes'); await p.waitForTimeout(200);
 fs.writeFileSync(require('os').tmpdir()+'/dutyqa.json',JSON.stringify({profile:'보존',settings:{year:2026,month:12},people:[]}));
 await p.setInputFiles('#fileJSON',require('os').tmpdir()+'/dutyqa.json'); await p.waitForTimeout(300);
 if(await p.isVisible('#askDialog')) await p.click('#askNo');
 const st=await p.evaluate(()=>Store.load('보존').p.length);
 log('D5 백업 복원이 같은 이름 프로필을 묻지 않고 덮어쓰지 않음',st===keep,`보존 프로필 인원 ${keep}→${st}`);
 errsOK(p,'D'); await p.context().close();}

// E. 숫자 입력 경계값
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300);
 for(const v of ['','0','-5','99999','1e9','abc']){ p.errs=[]; await p.evaluate(v=>{const el=document.querySelector('#maxAttempts');el.value=v;el.dispatchEvent(new Event('input'));},v);
   await p.click('#btnGenerate'); await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000}); await closeDiag(p);
   const t=await p.textContent('#progText'), n=await p.evaluate(()=>buildCfg().maxAttempts);
   log('E1 시뮬레이션 횟수="'+v+'"',!p.errs.length&&/완료/.test(t)&&[1000,3000,5000,7000,9000].includes(n),'적용 '+n+'회 · '+t.slice(0,30)); }
 // 슬라이더 격자 보정: 이전 버전 값·JSON 값이 1,000~9,000(2,000 단위), 50~100(5 단위)에 맞춰지는지
 const snap=await p.evaluate(()=>[snapSetting('maxAttempts',10000),snapSetting('maxAttempts',300),snapSetting('maxAttempts',2500),snapSetting('minDFI',82),snapSetting('minDFI',0),snapSetting('minDFI','')]);
 log('E4 슬라이더 격자 보정',JSON.stringify(snap)==='[9000,1000,3000,80,50,75]',JSON.stringify(snap));
 await p.evaluate(()=>{const el=document.querySelector('#minDFI');el.value='';el.dispatchEvent(new Event('input'));}); await gen(p,'100');
 log('E2 목표 DFI 빈칸',!p.errs.length,await p.textContent('#dfiMeta'));
 await p.fill('#roster input[data-i="0"][data-f="weight"]','0'); await p.fill('#roster input[data-i="1"][data-f="weight"]','-3');
 await p.fill('#roster input[data-i="2"][data-f="max"]','-1'); await p.fill('#roster input[data-i="3"][data-f="max"]','2.7'); await p.waitForTimeout(500);
 await gen(p,'100'); log('E3 가중치 0·음수, 한도 음수·소수',!p.errs.length,p.errs.join('|')||'정상');
 errsOK(p,'E'); await p.context().close();}

// F. 극단적 명단
{const p=await fresh(b); const cases={
  'F1 전원 레벨4':[{name:'a',level:4},{name:'b',level:4}],
  'F2 1명 레벨1':[{name:'혼자',level:1}],
  'F3 1명 한도0':[{name:'영',level:2,max:'0'}],
  'F4 레벨3 전원 기피':[{name:'초보',level:4},{name:'일반',level:3,avoid:'1~31'},{name:'숙련',level:2}],
  'F5 모든 요일 제외':[{name:'x',level:2,exDow:[1,1,1,1,1,1,1]},{name:'y',level:1}],
  'F6 희망일=기피일, 범위 밖 날짜':[{name:'z',level:1,wish:'1, 40, 0, 5~3',avoid:'1'},{name:'w',level:2}],
 };
 for(const [id,ps] of Object.entries(cases)){ p.errs=[]; await setPeople(p,ps); await p.waitForTimeout(500);
  const pc=await p.textContent('#precheck'); await gen(p,'200');
  const ok=!p.errs.length; log(id,ok,(ok?'':p.errs.join('|')+' ')+'점검: '+pc.replace(/\s+/g,' ').slice(0,70)); }
 errsOK(p,'F'); await p.context().close();}

// G. 달력 팝오버 열린 채 연월 변경 / 행 재정렬
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300);
 await p.click('[data-dp="0"]'); const opts=await p.$$eval('#ym option',o=>o.map(x=>x.value));
 await p.selectOption('#ym',opts[opts.length-1]); await p.waitForTimeout(200);
 const open=await p.isVisible('#dp'); log('G1 연월 변경 시 팝오버 닫힘',!open,open?'이전 달 기준 팝오버가 남음':'정상');
 await p.click('[data-dp="1"]'); await p.click('#dp [data-dd="31"]').catch(e=>p.errs.push(e.message));
 log('G2 30일 달→31일 달 클릭',!p.errs.length,'');
 errsOK(p,'G'); await p.context().close();}

// H. 생성 버튼 연타 / 중단 후 재생성
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300);
 await setRange(p,'#maxAttempts','3000');
 await p.click('#btnGenerate'); await p.click('#btnGenerate',{force:true,timeout:500}).catch(()=>{});
 await p.click('#btnCancel'); await p.waitForTimeout(200);
 log('H1 중단',(await p.textContent('#progText')).includes('중단'),await p.textContent('#progText'));
 await gen(p,'200'); log('H2 중단 후 재생성',/완료/.test(await p.textContent('#progText')),'');
 errsOK(p,'H'); await p.context().close();}

// I. Worker 차단 환경(대체 실행) + 중단
{const p=await fresh(b,{init:()=>{window.Worker=undefined;}}); await setPeople(p,Array.from({length:40},(_,i)=>({name:'사람'+i,level:1+i%4})));
 await gen(p,'500'); log('I1 Worker 없이 생성',/완료/.test(await p.textContent('#progText')),await p.textContent('#engineMode'));
 await setRange(p,'#maxAttempts','10000'); await p.click('#btnGenerate'); await p.waitForTimeout(100); await p.click('#btnCancel',{timeout:3000}); await p.waitForTimeout(300);
 log('I2 대체 실행 중단',(await p.textContent('#progText')).includes('중단')&&!(await p.$eval('#btnGenerate',b=>b.disabled)),await p.textContent('#progText'));
 errsOK(p,'I'); await p.context().close();}

// J. 수동 교체·실행 취소·안 전환
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 const t0=await p.textContent('#dfiTotal');
 await p.click('#cal [data-edit="5"]'); await p.selectOption('#editDuty','-1'); await p.click('#editApply');
 const un=await p.$$eval('#cal .cell.unfilled',a=>a.length); await p.click('[data-cand="1"] .cand-rank');
 await p.click('#undoBtn').catch(()=>{}); await p.click('[data-cand="0"] .cand-rank'); 
 log('J1 미배정으로 교체 후 다른 안에서 취소',(await p.textContent('#dfiTotal'))===t0&&un===1,`DFI ${t0}→${await p.textContent('#dfiTotal')}`);
 // 레벨4로 교체 + 조력자 없음
 const l4=await p.evaluate(()=>state.result.cfg.people.findIndex(x=>x.level===4));
 await p.click('#cal [data-edit="10"]'); await p.selectOption('#editDuty',String(l4)); await p.selectOption('#editAssist','-1');
 const w=await p.textContent('#editWarn'); await p.click('#editApply');
 log('J2 레벨4 조력자 없음 경고',w.includes('조력자가 필요'),w.slice(0,40));
 await p.keyboard.press('Escape');
 errsOK(p,'J'); await p.context().close();}

// K. 프로필 이름 변경 경계
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(500);
 await p.click('#btnProfileRename'); await p.click('#askYes'); await p.waitForTimeout(200);
 const toast=await p.textContent('#toast'); log('K1 같은 이름으로 변경',!toast.includes('이미 있습니다'),'안내: '+toast);
 await p.click('#btnProfileDelete'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
 log('K2 삭제 확인창 Esc → 삭제 안 됨',(await p.evaluate(()=>Store.list())).includes('기본'),'');
 await p.click('#btnProfileNew'); await p.fill('#askInput','   '); await p.click('#askYes'); await p.waitForTimeout(100);
 log('K3 공백 이름 거부',!(await p.evaluate(()=>Store.list())).includes(''),await p.textContent('#toast'));
 errsOK(p,'K'); await p.context().close();}

// L. 첫 실행: 입력 직후(400ms 안) 프로필 전환 시 입력 유실
{const p=await fresh(b); await p.evaluate(()=>{Store.save('기존',{v:1,s:defaultSettings(),p:[]});refreshProfileUI();});
 await p.evaluate(()=>{state.profile='';refreshProfileUI();});
 await p.click('#btnAddRow'); await p.fill('#roster input[data-i="0"][data-f="name"]','방금입력');
 await p.selectOption('#profileSelect','기존'); await p.waitForTimeout(600);
 const saved=JSON.stringify(await p.evaluate(()=>Store.list().map(n=>[n,(Store.load(n)||{p:[]}).p.map(x=>x[0])])));
 log('L1 저장 전 입력이 전환 시 보존',saved.includes('방금입력'),saved);
 errsOK(p,'L'); await p.context().close();}

// M. 대규모 명단 성능
{const p=await fresh(b); const ps=Array.from({length:40},(_,i)=>({name:'사람'+i,level:1+i%4,wish:String(1+i%28),avoid:String(2+i%27)}));
 await setPeople(p,ps); const t=Date.now(); await gen(p,'2000'); const ms=Date.now()-t;
 const t2=Date.now(); await p.click('#cal [data-pid]'); const hl=Date.now()-t2;
 log('M1 40명 2,000회 생성',!p.errs.length&&ms<15000,`${ms}ms, 강조 반응 ${hl}ms`);
 errsOK(p,'M'); await p.context().close();}

// N. 모바일: 팝오버·카드·결과
{const p=await fresh(b,{vp:{width:360,height:740}}); await p.click('#btnSample'); await p.waitForTimeout(300);
 await p.click('[data-dp="11"] >> visible=true'); const r=await p.$eval('#dp',e=>{const b=e.getBoundingClientRect();return [b.left,b.right,b.top,b.bottom,innerWidth,innerHeight]});
 log('N1 팝오버 화면 안',r[0]>=0&&r[1]<=r[4]&&r[2]>=0&&r[3]<=r[5],r.map(Math.round).join(','));
 await p.keyboard.press('Escape'); await gen(p,'200');
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth); log('N2 가로 넘침 없음',ov<=0,'초과 '+ov+'px');
 errsOK(p,'N'); await p.context().close();}

// O. 키보드 전용 조작
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 await p.focus('[data-cand="2"]'); await p.keyboard.press(' '); await p.waitForTimeout(100);
 log('O1 Space로 안 선택',(await p.textContent('#selTag'))==='3안','');
 await p.focus('#cal .duty-name'); await p.keyboard.press('Enter'); log('O2 Enter로 강조',await p.isVisible('#hlInfo'),'');
 await p.focus('#cal [data-edit="3"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(100); const o=await p.isVisible('#editDialog');
 await p.keyboard.press('Escape'); await p.waitForTimeout(100); log('O3 Enter로 교체창 열고 Esc로 닫기',o&&!(await p.isVisible('#editDialog')),'');
 errsOK(p,'O'); await p.context().close();}

// P. 출력·인쇄용 파일
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 await p.click('#cal [data-pid]'); await p.click('#btnPrint'); await p.waitForTimeout(800);
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#btnPrintFile')]);
 const html=require('fs').readFileSync(await dl.path(),'utf8');
 const q=await b.newPage(); await q.setContent(html); const z=await q.evaluate(()=>{fitSheet();return getComputedStyle(document.querySelector('.sheet')).zoom});
 log('P1 출력·인쇄용 파일',!p.errs.length&&html.includes('당직표'),'zoom '+z); await q.close();
 // 결과 낡음 상태에서 출력 → 확인창
 await p.fill('#roster input[data-i="0"][data-f="weight"]','2'); await p.waitForTimeout(600); await p.click('#btnCSV');
 const asked=await p.isVisible('#askDialog'); if(asked) await p.click('#askNo');
 log('P2 낡은 결과 출력 시 확인',asked,'');
 errsOK(p,'P'); await p.context().close();}

// Q. 공휴일 입력 이상값
{const p=await fresh(b); for(const v of ['abc','0, 32','1~40','12월 25일, 2026-12-31, 12/24','~,,,-']){ p.errs=[];
  await p.fill('#holidays',v); await p.waitForTimeout(450); log('Q "'+v+'"',!p.errs.length,(await p.textContent('#ph-holidays'))||'(빈 안내)'); }
 errsOK(p,'Q'); await p.context().close();}

// R. 저장값 손상(구버전·이상 프로필)
{const p=await fresh(b,{init:()=>{try{localStorage.setItem('dfiDuty:list','["손상"]');localStorage.setItem('dfiDuty:last','손상');
   localStorage.setItem('dfiDuty:p:손상',JSON.stringify({v:1,s:{year:2026,month:13,restW:'x',maxAttempts:null},p:[['a',null,null,null,7,null,999,'q',null]]}));}catch(e){}}});
 await p.waitForTimeout(300); log('R1 손상된 프로필 불러오기',!p.errs.length,p.errs.join('|')||'정상');
 await gen(p,'100'); log('R2 손상 프로필로 생성',!p.errs.length,(await p.textContent('#progText')).slice(0,40));
 await p.context().close();}

// S. 결과 강조 후 재생성 / 명단 축소 후 이전 결과 강조
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 const last=await p.evaluate(()=>state.result.cfg.people.length-1);
 await p.evaluate(i=>setHighlight(i),last);
 await p.evaluate(()=>{state.people.splice(0,6);renderRoster();scheduleSave();}); await p.waitForTimeout(600);
 await p.click('#cal [data-pid]'); await p.click('#btnCSV'); if(await p.isVisible('#askDialog')) await p.click('#askYes');
 log('S1 명단 축소 후 이전 결과 조작',!p.errs.length,p.errs.join('|')||'정상');
 errsOK(p,'S'); await p.context().close();}

// T. 기간 입력: ~와 -의 변형, 날짜 형식으로 쓴 기간
{const p=await fresh(b); const exp={'20~22':'20~22','20-22':'20~22','20 - 22':'20~22','20일-22일':'20~22','20～22':'20~22','20〜22':'20~22','20−22':'20~22','20–22':'20~22','20—22':'20~22',
  '12/20-12/22':'20~22','12.20~12.22':'20~22','12월 20일-22일':'20~22','2026-12-20~2026-12-22':'20~22','2026-12-25':'25','12/25':'25','22-20':'','-5':'1~5','20-':'20~31','~5':'1~5','-5, 25-':'1~5, 25~31','-':'','-40':'','0-':''};
 for(const [inp,want] of Object.entries(exp)){ const got=await p.evaluate(v=>fmtDays(parseDays(v,31).days),inp); log('T "'+inp+'"',got===want,'→ '+(got||'(오류 표시)')); }
 for(const [N,w] of [[30,'20~30'],[28,'20~28']]){ const g=await p.evaluate(N=>fmtDays(parseDays('20-',N).days),N); log('T "20-" '+N+'일 달',g===w,'→ '+g); }
 errsOK(p,'T'); await p.context().close();}

await b.close();
const f=results.filter(r=>!r.ok); console.log(`\n총 ${results.length}건 · 통과 ${results.length-f.length} · 실패 ${f.length}`);
})();
