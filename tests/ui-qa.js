/*
 * 인터페이스 오류 탐색 테스트 (Playwright, Chromium)
 * 실행: npx playwright install chromium   (최초 1회)
 *       node tests/ui-qa.js [index.html 경로]
 * 28개 범주(A~Z, AA~AB) 168개 항목: 특수문자·XSS, 생성 중 프로필 전환, 실행 취소 범위, JSON 복원 검증,
 * 숫자 경계값, 극단적 명단, 날짜 팝오버, 연타·중단, Worker 차단 환경, 수동 교체, 프로필 이름,
 * 저장 전 입력 보존, 대규모 명단, 모바일 배치, 키보드 조작, 출력, 공휴일 입력, 손상된 저장값, 이전 결과 조작,
 * 기간 입력(~와 -의 변형, 날짜 형식 기간, 열린 기간 -5·20-), 실행 요약(소요 시간·개선 기록),
 * 다국어(W: en·ja·zh·fr·es 각각 화면·툴팁·팝오버·대화상자·출력·CSV에 한글이 남지 않는지, 한국어 복원,
 *   결과 표시 중 재전환, 새로 고침 후 유지, 360px 가로 넘침, 12月25日 형식 해석),
 * v1.15(X: 내장 공휴일은 한국어에서만, 목표 미달 원인·개선 목록, 통계 기대·차이 툴팁),
 * v1.16(Y: 최하단 사용법 영상 링크와 재생 레이어 열기·언어 전환·닫으면 정지),
 * v1.17(Z: 첫 방문 안내 띠의 표시·종료 조건과 유지, 샘플 체험, 기존 사용자 미표시, 머리글 ? 버튼, 번역),
 * v1.19(AA: 이름 끌어 놓기 맞바꾸기·실행 취소, 규칙 위반 빨간 테두리와 이유·[무시], 언어 전환, ✎ 교체 위반 표시),
 * v1.20(AB: 상위 3개 안 원본 보존, 카드를 누르면 처음 안으로 되돌림·실행 취소, 다른 안 선택). 첫 실행은 브라우저 언어를 감지해 저장하고, 이후에는 저장된 언어를 씁니다.
 * 각 항목은 JS 예외·콘솔 오류·브라우저 기본 대화상자 발생도 함께 실패로 기록합니다.
 */

const {chromium}=require('playwright');
const path=require('path');
const FILE='file://'+path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const results=[]; const log=(id,ok,msg)=>{results.push({id,ok,msg});console.log((ok?'PASS':'FAIL')+' '+id+' — '+msg);};
async function fresh(b,opt={}){
  // 브라우저 언어: 기본 ko-KR (첫 실행 언어 감지 때문에 한국어 화면 테스트가 한국어로 시작하도록)
  const ctx=await b.newContext({viewport:opt.vp||{width:1280,height:900},acceptDownloads:true,locale:opt.locale||'ko-KR'});
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
async function gen(p){ /* 시도 횟수는 자동(목표 이상 5안 또는 최대 20,000회) */
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
 await setPeople(p,Array.from({length:40},(_,i)=>({name:'사람'+i,level:1+i%4}))); await setRange(p,'#minDFI','100'); await p.waitForTimeout(500);
 await p.click('#btnGenerate'); await p.waitForTimeout(80);
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
 log('C1 삭제 취소가 다른 프로필에 섞이지 않음',!names.includes('James'),'P2 명단: '+names.join(','));
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
    if(!err){ await gen(p); log(id+' 복원 후 생성',!p.errs.length,p.errs.join('|')||'정상'); } }
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
 // E1. 시도 횟수 자동: 낮은 목표는 최소 500회에서 멈추고(목표 이상 5안 확보), 도달 불가 목표는 최대 20,000회
 for(const [v,expStop] of [['50','target'],['60','target'],['100','max']]){ p.errs=[]; await setRange(p,'#minDFI',v);
   await p.click('#btnGenerate'); await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000}); await closeDiag(p);
   const r=await p.evaluate(()=>state.run), t=await p.textContent('#progText');
   const ok=!p.errs.length&&r.stop===expStop&&(expStop==='max'?r.attempts===20000:r.hits>=5&&r.attempts===500);
   log('E1 목표 '+v+' → '+expStop,ok,`${r.attempts}회 · ${r.stop} · 목표 이상 ${r.hits}안 · `+t.slice(0,40)); }
 log('E5 시뮬레이션 횟수 설정 없음',!(await p.$('#maxAttempts')),'');
 // 슬라이더 격자 보정: 목표 DFI 50~100(5 단위)
 const snap=await p.evaluate(()=>[snapSetting('minDFI',82),snapSetting('minDFI',0),snapSetting('minDFI',''),snapSetting('minDFI',120)]);
 log('E4 목표 DFI 격자 보정',JSON.stringify(snap)==='[80,50,75,100]',JSON.stringify(snap));
 await p.evaluate(()=>{const el=document.querySelector('#minDFI');el.value='';el.dispatchEvent(new Event('input'));}); await gen(p);
 log('E2 목표 DFI 빈칸',!p.errs.length,await p.textContent('#dfiMeta'));
 await p.fill('#roster input[data-i="0"][data-f="weight"]','0'); await p.fill('#roster input[data-i="1"][data-f="weight"]','-3');
 await p.fill('#roster input[data-i="2"][data-f="max"]','-1'); await p.fill('#roster input[data-i="3"][data-f="max"]','2.7'); await p.waitForTimeout(500);
 await gen(p); log('E3 가중치 0·음수, 한도 음수·소수',!p.errs.length,p.errs.join('|')||'정상');
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
  const pc=await p.textContent('#precheck'); await gen(p);
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
 await setPeople(p,Array.from({length:40},(_,i)=>({name:'사람'+i,level:1+i%4}))); await setRange(p,'#minDFI','100'); await p.waitForTimeout(500);
 await p.click('#btnGenerate'); await p.click('#btnGenerate',{force:true,timeout:500}).catch(()=>{});
 await p.click('#btnCancel'); await p.waitForTimeout(200);
 log('H1 중단',(await p.textContent('#progText')).includes('중단'),await p.textContent('#progText'));
 await gen(p); log('H2 중단 후 재생성',/완료/.test(await p.textContent('#progText')),'');
 errsOK(p,'H'); await p.context().close();}

// I. Worker 차단 환경(대체 실행) + 중단
{const p=await fresh(b,{init:()=>{window.Worker=undefined;}}); await setPeople(p,Array.from({length:40},(_,i)=>({name:'사람'+i,level:1+i%4})));
 await gen(p); log('I1 Worker 없이 생성',/완료/.test(await p.textContent('#progText')),await p.textContent('#engineMode'));
 await setRange(p,'#minDFI','100'); await p.click('#btnGenerate'); await p.waitForTimeout(100); await p.click('#btnCancel',{timeout:3000}); await p.waitForTimeout(300);
 log('I2 대체 실행 중단',(await p.textContent('#progText')).includes('중단')&&!(await p.$eval('#btnGenerate',b=>b.disabled)),await p.textContent('#progText'));
 errsOK(p,'I'); await p.context().close();}

// J. 수동 교체·실행 취소·안 전환
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 const t0=await p.textContent('#dfiTotal');
 await p.click('#cal [data-edit="5"]'); await p.selectOption('#editDuty','-1'); await p.click('#editApply');
 const un=await p.$$eval('#cal .cell.unfilled',a=>a.length); await p.click('[data-cand="1"] .cand-rank');
 await p.click('#undoBtn').catch(()=>{}); await p.click('[data-cand="0"] .cand-rank'); 
 log('J1 미배정으로 교체 후 다른 안에서 취소',(await p.textContent('#dfiTotal'))===t0&&un===1,`DFI ${t0}→${await p.textContent('#dfiTotal')}`);
 // 레벨4로 교체 + 백업 없음
 const l4=await p.evaluate(()=>state.result.cfg.people.findIndex(x=>x.level===4));
 await p.click('#cal [data-edit="10"]'); await p.selectOption('#editDuty',String(l4)); await p.selectOption('#editAssist','-1');
 const w=await p.textContent('#editWarn'); await p.click('#editApply');
 log('J2 레벨4 백업 없음 경고',w.includes('백업이 필요'),w.slice(0,40));
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
 await setPeople(p,ps); const t=Date.now(); await gen(p); const ms=Date.now()-t;
 const t2=Date.now(); await p.click('#cal [data-pid]'); const hl=Date.now()-t2;
 log('M1 40명 생성(최대 20,000회)',!p.errs.length&&ms<30000,`${ms}ms, 강조 반응 ${hl}ms`);
 errsOK(p,'M'); await p.context().close();}

// N. 모바일: 팝오버·카드·결과
{const p=await fresh(b,{vp:{width:360,height:740}}); await p.click('#btnSample'); await p.waitForTimeout(300);
 await p.click('[data-dp="11"] >> visible=true'); const r=await p.$eval('#dp',e=>{const b=e.getBoundingClientRect();return [b.left,b.right,b.top,b.bottom,innerWidth,innerHeight]});
 log('N1 팝오버 화면 안',r[0]>=0&&r[1]<=r[4]&&r[2]>=0&&r[3]<=r[5],r.map(Math.round).join(','));
 await p.keyboard.press('Escape'); await gen(p);
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
 await gen(p); log('R2 손상 프로필로 생성',!p.errs.length,(await p.textContent('#progText')).slice(0,40));
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
 // 말일 초과 보정: 끝 날짜만 말일로 맞추고, 31 초과·시작일 초과는 오류
 for(const [inp,N,w] of [['15-31',28,'15~28'],['15-31',29,'15~29'],['25~31',30,'25~30'],['15-31',31,'15~31'],['29-31',28,''],['1-40',31,''],['1-32',30,'']]){
   const g=await p.evaluate(([v,N])=>fmtDays(parseDays(v,N).days),[inp,N]); log('T "'+inp+'" '+N+'일 달',g===w,'→ '+(g||'(오류 표시)')); }
 errsOK(p,'T'); await p.context().close();}

// U. 실행 요약: 소요 시간, 마지막 개선 시점, 그래프·표
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 const info=await p.evaluate(()=>({run:state.run, best:state.cands[0].attempt, ticks:[...document.querySelectorAll('#runSvg text.ax')].map(t=>t.textContent), rows:document.querySelectorAll('.run-table tbody tr').length}));
 const H=info.run.hist, last=H[H.length-1];
 log('U1 실행 요약 표시',await p.isVisible('#runSum')&&/초/.test(await p.textContent('#progText')),(await p.textContent('#progText')).slice(0,40));
 log('U2 마지막 개선 = 1안 발견 시도',last.a===info.best,`마지막 개선 ${last.a} · 1안 ${info.best}`);
 log('U3 개선 기록 오름차순·첫 기록 1번째',H[0].a===1&&H.every((h,i)=>!i||h.a>H[i-1].a),H.map(h=>h.a).join(','));
 log('U4 표 행 수 = 기록 수',info.rows===H.length,info.rows+'행');
 log('U5 로그 눈금',info.ticks.includes('1')&&info.ticks.includes(info.run.attempts.toLocaleString()),info.ticks.join(' '));
 // 통계표 행의 숫자 칸을 눌러도 강조, 다시 누르면 해제
 await p.click('#stats tbody tr:nth-child(3) td:nth-child(9)'); const hl3=await p.evaluate(()=>[state.hl,document.querySelector('#stats tbody tr:nth-child(3)').classList.contains('hl-row'),!document.querySelector('#hlInfo').classList.contains('hidden')]);
 await p.click('#stats tbody tr:nth-child(3) td:nth-child(4)'); const off=await p.evaluate(()=>state.hl);
 log('U7 통계표 행 클릭 강조·해제',hl3[0]===2&&hl3[1]&&hl3[2]&&off===-1,JSON.stringify(hl3)+' → '+off);
 // DFI 카드: 설명은 툴팁 (지표 막대 마우스 오버·포커스)
 await p.hover('#gauges .gauge:nth-child(3)'); await p.waitForTimeout(150);
 const tt=await p.evaluate(()=>[document.querySelector('#tip').classList.contains('show'),document.querySelector('#tip').textContent.slice(0,12)]);
 log('U8 DFI 지표 툴팁',tt[0]&&tt[1].startsWith('M3'),tt[1]); await p.mouse.move(0,0);
 await p.click('#btnProfileNew'); await p.fill('#askInput','U빈'); await p.click('#askYes'); await p.waitForTimeout(200);
 log('U6 프로필 전환 시 요약 숨김',!(await p.isVisible('#runSum')),'');
 errsOK(p,'U'); await p.context().close();}

// V. 느린 브라우저: 5초 시간 제한 (Worker 없는 대체 실행에서 시계를 빠르게 흐르게 해 흉내)
{const p=await fresh(b,{init:()=>{window.Worker=undefined;const real=Date.now.bind(Date);let c=0;Date.now=()=>real()+(c++)*400;}});
 await p.click('#btnSample'); await p.waitForTimeout(300); await setRange(p,'#minDFI','100'); await p.waitForTimeout(450);
 await p.click('#btnGenerate'); await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000}); await closeDiag(p);
 const r=await p.evaluate(()=>state.run), t=await p.textContent('#progText'), adv=await p.textContent('.run-advice');
 log('V1 5초 제한에서 멈춤',r.stop==='time'&&r.attempts<20000&&/시간 제한/.test(t),`${r.attempts}회 · ${t.slice(0,45)}`);
 log('V2 시간 제한 안내',/느려/.test(adv),adv.slice(0,50));
 errsOK(p,'V'); await p.context().close();}

// W. 다국어: 언어마다 새 페이지에서 화면 전체를 거치며 한글이 남지 않는지 확인
//    (언어 선택 목록의 '한국어'는 각 언어의 고유 이름이므로 검사에서 뺍니다)
{const HG=/[가-힣]/, hangul=s=>{const m=String(s).match(/[^\n]{0,30}[가-힣][^\n]{0,30}/);return m?m[0].trim():'';};
 const bodyText=p=>p.evaluate(()=>{const s=document.querySelector('.lang-pick');s.style.display='none';const t=document.body.innerText;s.style.display='';return t;});
 const attrText=p=>p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>!e.closest('script,.lang-pick'))
   .flatMap(e=>['title','aria-label','placeholder','data-label','data-edited'].map(a=>e.getAttribute(a)).filter(Boolean)).join('\n'));
 // W0. 첫 실행: 브라우저 언어 감지·저장 / 두 번째 실행: 저장된 언어 우선
 for(const [loc,exp] of [['ko-KR','ko'],['en-US','en'],['ja-JP','ja'],['zh-TW','zh'],['fr-CA','fr'],['es-MX','es'],['de-DE','en']]){
  const p=await fresh(b,{locale:loc}); const r=await p.evaluate(()=>[document.documentElement.lang,document.querySelector('#langSelect').value,localStorage.getItem('dfiDuty:lang')]);
  log('W0 첫 실행 '+loc+' → '+exp,r[1]===exp&&r[2]===exp,r.join(' · ')); errsOK(p,'W0'); await p.context().close(); }
 {const p=await fresh(b,{locale:'ja-JP'}); await p.selectOption('#langSelect','fr'); await p.reload(); await p.waitForTimeout(200);
  const r=await p.evaluate(()=>[document.querySelector('#langSelect').value,document.querySelector('#btnGenerate').textContent]);
  log('W0 두 번째 실행은 저장값(fr) 우선 (브라우저 ja)',r[0]==='fr'&&!/[가-힣]/.test(r[1]),r.join(' · ')); errsOK(p,'W0'); await p.context().close();}
 // W1. 중국어·일본어 날짜 표기 해석 (12月25日, 25日, 2026年12月25日)
 {const p=await fresh(b); const g=await p.evaluate(()=>['12月25日','25日','2026年12月25日','12月20日~22日','20日-22日'].map(v=>fmtDays(parseDays(v,31).days)));
  log('W1 12月25日·25日 형식',JSON.stringify(g)==='["25","25","25","20~22","20~22"]',JSON.stringify(g)); errsOK(p,'W1'); await p.context().close();}
 for(const L of ['en','ja','zh','fr','es']){
  const p=await fresh(b); const bad=[]; const chk=(where,s)=>{const h=hangul(s); if(h) bad.push(where+': '+h);};
  await p.selectOption('#langSelect',L); await p.waitForTimeout(100);
  await p.click('#btnSample'); await p.waitForTimeout(300);
  // 사전 점검 충돌: Emma의 희망일 5일을 제외일에도 넣음 / 열린 기간 안내
  await p.fill('#roster input[data-i="1"][data-f="avoid"]','5, 25'); await p.fill('#roster input[data-i="0"][data-f="avail"]','-5, 25-'); await p.waitForTimeout(500);
  const pc=await p.textContent('#precheck'); chk('사전 점검',pc); const conflict=/⚠️/.test(pc);
  await gen(p);
  await p.click('#btnMiniToggle'); await p.waitForTimeout(100); chk('미니 달력',await p.textContent('#candGrid'));
  await p.click('[data-dp="0"]'); chk('팝오버',await p.innerHTML('#dp')); await p.keyboard.press('Escape');
  await p.hover('#roster th[data-tip="level"]'); await p.waitForTimeout(100); const tip1=await p.innerHTML('#tip'); chk('명단 툴팁',tip1);
  await p.hover('#gauges .gauge:nth-child(3)'); await p.waitForTimeout(100); const tip2=await p.innerHTML('#tip'); chk('DFI 툴팁',tip2);
  await p.hover('[data-tt="dfiAbout"]'); await p.waitForTimeout(100); chk('DFI 설명 툴팁',await p.innerHTML('#tip')); await p.mouse.move(0,0);
  await p.click('#cal .duty-name'); await p.waitForTimeout(100); chk('강조 요약',await p.textContent('#hlInfo'));
  const l4=await p.evaluate(()=>state.result.cfg.people.findIndex(x=>x.level===4));
  await p.click('#cal [data-edit="5"]'); await p.selectOption('#editDuty',String(l4)); await p.selectOption('#editAssist','-1');
  chk('수동 교체 창',await p.innerHTML('#editDialog')); await p.click('#editApply'); await p.waitForTimeout(100); chk('실행 취소 막대',await p.textContent('#undoBar'));
  const docs=await p.evaluate(()=>({print:buildPrintDoc(false).replace(/<style>[\s\S]*?<\/style>/,''),csv:buildCSV(state.result)}));
  chk('출력 양식',docs.print); chk('CSV',docs.csv);
  chk('화면',await bodyText(p)); chk('속성',await attrText(p)); chk('문서 제목',await p.title());
  const tipsOK=tip1.length>50&&tip2.length>50;
  const msg=bad.length?bad.slice(0,3).join(' | '):!conflict?'사전 점검 충돌이 표시되지 않음':!tipsOK?'툴팁 비어 있음':docs.csv.split('\r\n')[0].slice(1,60);
  log('W2 '+L+' 한글 없음(화면·툴팁·팝오버·대화상자·출력·CSV)',!bad.length&&conflict&&tipsOK,msg);
  // 결과가 있는 채로 한국어로 → 한국어 복원, 다시 원래 언어로 → 한글 없음
  await p.selectOption('#langSelect','ko'); await p.waitForTimeout(150);
  const ko=await p.evaluate(()=>[document.documentElement.lang,document.querySelector('#calTitle').textContent,document.querySelector('#stats th').textContent,document.querySelector('#btnGenerate').textContent,document.querySelector('.run-tiles .k').textContent]);
  log('W3 '+L+' → 한국어 복원',ko[0]==='ko'&&/당직/.test(ko[1])&&ko[2]==='성명'&&ko[3].includes('당직표 생성')&&ko[4]==='시도 횟수',ko.join(' · '));
  await p.selectOption('#langSelect',L); await p.waitForTimeout(150);
  const again=hangul(await bodyText(p))||hangul(await attrText(p));
  log('W4 '+L+' 결과 표시 중 언어 재전환',!again,again||'정상');
  // 오류 대화상자(한도 합계 부족)·미배정 대화상자
  await setPeople(p,[{name:'a',level:1,max:'3'}]); await p.waitForTimeout(500);
  await p.click('#btnGenerate'); await p.waitForFunction(()=>document.querySelector('#diagDialog').open,null,{timeout:10000}); const e1=await p.textContent('#diagDialog'); await closeDiag(p);
  await setPeople(p,[{name:'x',level:2,avoid:'1~10'},{name:'y',level:2,avoid:'1~10'}]); await p.waitForTimeout(500);
  await p.click('#btnGenerate'); await p.waitForFunction(()=>!document.querySelector('#btnGenerate').disabled,null,{timeout:60000}); await p.waitForTimeout(150);
  const e2=await p.textContent('#diagDialog'); await closeDiag(p);
  const dh=hangul(e1)||hangul(e2)||hangul(await bodyText(p));
  log('W5 '+L+' 오류·미배정 대화상자',!dh&&e1.length>10&&e2.length>10,dh||e1.trim().slice(0,50));
  // 새로 고침 후에도 언어 유지
  await p.reload(); await p.waitForTimeout(300);
  const kept=await p.evaluate(()=>[document.documentElement.lang,document.querySelector('#langSelect').value]); const rh=hangul(await bodyText(p));
  log('W6 '+L+' 새로 고침 후 언어 유지',kept[0]===L&&kept[1]===L&&!rh,kept.join(',')+(rh?' · '+rh:''));
  errsOK(p,'W '+L); await p.context().close();
  // 좁은 화면(360px): 긴 번역으로 가로 넘침이 생기지 않는지
  {const q=await fresh(b,{vp:{width:360,height:740}}); await q.selectOption('#langSelect',L);
   await q.click('#btnSample'); await q.waitForTimeout(300); await gen(q);
   const ov=await q.evaluate(()=>document.documentElement.scrollWidth-innerWidth); log('W7 '+L+' 360px 가로 넘침 없음',ov<=0,'초과 '+ov+'px');
   errsOK(q,'W7 '+L); await q.context().close();}
 }
}

// X. v1.15: 내장 공휴일은 한국어에서만 · 목표 미달 원인 추정 · 통계 차이 툴팁
{const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(300);
 await p.selectOption('#ym','2027-1'); await p.waitForTimeout(200); await p.selectOption('#ym','2026-12'); await p.waitForTimeout(300);
 const koH=await p.inputValue('#holidays');
 log('X1 한국어: 내장 공휴일 자동 입력',/25/.test(koH),koH||'(비어 있음)');
 await p.selectOption('#langSelect','en'); await p.waitForTimeout(150);
 await p.selectOption('#ym','2026-10'); await p.waitForTimeout(300);
 const enH=await p.inputValue('#holidays'); const hint=await p.textContent('#holHint').catch(()=>'');
 log('X2 영어: 공휴일 자동 입력 안 함',enH.trim()===''&&/Korean/.test(hint),(enH||'(비어 있음)')+' · '+(hint||'').slice(0,60));
 await p.fill('#holidays','12'); await p.waitForTimeout(450);
 {const h3=await p.textContent('#holHint'); log('X3 영어: 직접 입력한 공휴일 유지·안내 숨김',(await p.inputValue('#holidays'))==='12'&&!h3.trim(),'12 · '+(h3||'(안내 없음)'));}
 await p.selectOption('#langSelect','ko'); await p.waitForTimeout(150);
 // 목표 100 → 대개 미달: 원인 목록과 추정 최고점
 await p.selectOption('#ym','2027-1'); await p.waitForTimeout(200); await p.selectOption('#ym','2026-12'); await p.waitForTimeout(300);
 await setRange(p,'#minDFI','100'); await p.waitForTimeout(300); await gen(p);
 const dg=await p.evaluate(()=>{const d=document.querySelector('#dfiDiag details');if(!d)return null;d.open=true;return {n:d.querySelectorAll('li').length,fix:d.querySelectorAll('.fix').length,ub:(d.querySelector('.ub')||{}).textContent||''};});
 log('X4 목표 미달 → 원인·개선 목록',dg&&dg.n>=1&&dg.fix>=1&&/\d/.test(dg.ub),dg?`${dg.n}개 · ${dg.ub}`:'목록 없음');
 // 통계 차이 칸 툴팁
 const why=await p.$('#stats td.why');
 if(why){await why.hover(); await p.waitForTimeout(300); const tt=await p.textContent('#tip');
   log('X5 통계 차이 칸 툴팁',/실제/.test(tt)&&/기대/.test(tt),tt.replace(/\s+/g,' ').slice(0,80));}
 else log('X5 통계 차이 칸 툴팁',true,'±1 이상 차이 없음(표시 대상 없음)');
 await p.hover('#stats th[data-tt="statDiff"]'); await p.waitForTimeout(300);
 log('X6 차이 열 머리글 툴팁',/실제 − 기대/.test(await p.textContent('#tip')),'');
 // 영어에서 원인 목록·툴팁에 한글 없음
 await p.selectOption('#langSelect','en'); await p.waitForTimeout(200);
 const enDiag=await p.evaluate(()=>{const d=document.querySelector('#dfiDiag');return d?d.textContent:'';});
 let enTip=''; const w2=await p.$('#stats td.why'); if(w2){await w2.hover();await p.waitForTimeout(300);enTip=await p.textContent('#tip');}
 const hg=/[가-힣]/.test(enDiag+enTip);
 log('X7 영어: 원인 목록·통계 툴팁 번역',!hg,hg?(enDiag+enTip).match(/.{0,20}[가-힣]+.{0,20}/)[0]:enDiag.replace(/\s+/g,' ').slice(0,70));
 errsOK(p,'X'); await p.context().close();}

// Y. v1.16: 최하단 사용법 영상 링크 → 재생 레이어
{const p=await fresh(b);
 const foot=await p.evaluate(()=>{const f=document.querySelector('footer.app-foot');const m=document.querySelector('main');return !!f&&!!(m.compareDocumentPosition(f)&Node.DOCUMENT_POSITION_FOLLOWING);});
 log('Y1 본문 아래 바닥글에 영상 링크',foot&&(await p.textContent('#btnGuide')).includes('사용법 영상'),'');
 await p.click('#btnGuide'); await p.waitForTimeout(300);
 const st=await p.evaluate(()=>{const v=document.querySelector('#guideVideo');return {open:document.querySelector('#guideDialog').open,src:v.getAttribute('src')||'',ko:document.querySelector('[data-vlang="ko"]').getAttribute('aria-pressed')};});
 log('Y2 클릭 → 레이어 열림·한국어 영상',st.open&&/guide-ko-30s\.mp4$/.test(st.src)&&st.ko==='true',st.src);
 await p.click('[data-vlang="en"]'); await p.waitForTimeout(200);
 log('Y3 English 전환',/guide-en-30s\.mp4$/.test(await p.getAttribute('#guideVideo','src')),'');
 await p.keyboard.press('Escape'); await p.waitForTimeout(200);
 const cl=await p.evaluate(()=>{const v=document.querySelector('#guideVideo');return {open:document.querySelector('#guideDialog').open,src:v.getAttribute('src'),paused:v.paused};});
 log('Y4 Esc로 닫으면 정지·영상 해제',!cl.open&&!cl.src&&cl.paused,JSON.stringify(cl));
 await p.click('#btnGuide'); await p.waitForTimeout(200); await p.click('#guideClose'); await p.waitForTimeout(150);
 const c2=await p.evaluate(()=>document.querySelector('#guideDialog').open);
 await p.click('#btnGuide'); await p.waitForTimeout(200); await p.mouse.click(5,5); await p.waitForTimeout(150);
 const c3=await p.evaluate(()=>document.querySelector('#guideDialog').open);
 log('Y5 ×·바깥 클릭으로 닫힘',!c2&&!c3,'');
 await p.selectOption('#langSelect','ja'); await p.waitForTimeout(150);
 await p.click('#btnGuide'); await p.waitForTimeout(200);
 const ja=await p.evaluate(()=>[document.querySelector('#btnGuide').textContent,document.querySelector('#guideTitle').textContent,document.querySelector('#guideVideo').getAttribute('src')]);
 log('Y6 다른 언어: 번역·영어 영상',!/[가-힣]/.test(ja[0]+ja[1])&&/guide-en/.test(ja[2]),ja.join(' · '));
 errsOK(p,'Y'); await p.context().close();}

// Z. v1.17: 첫 방문 안내 띠 · 머리글 ? 버튼
{const p=await fresh(b); const vis=()=>p.evaluate(()=>!document.querySelector('#welcome').classList.contains('hidden'));
 log('Z1 첫 방문: 안내 띠 표시',await vis(),'');
 await p.click('#btnHelp'); await p.waitForTimeout(200);
 const op=await p.evaluate(()=>[document.querySelector('#guideDialog').open,document.querySelector('#guideVideo').getAttribute('src')]);
 log('Z2 ? 버튼 → 영상 레이어',op[0]&&/guide-ko/.test(op[1]),op[1]||'');
 await p.keyboard.press('Escape'); await p.waitForTimeout(150);
 log('Z3 영상을 열면 안내 띠 사라짐',!(await vis()),'');
 await p.reload(); await p.waitForTimeout(300);
 log('Z4 새로 고침 후에도 다시 안 나옴',!(await vis()),'');
 errsOK(p,'Z'); await p.context().close();}
{const p=await fresh(b); const vis=()=>p.evaluate(()=>!document.querySelector('#welcome').classList.contains('hidden'));
 await p.click('#wClose'); await p.waitForTimeout(150); const a=!(await vis()); await p.reload(); await p.waitForTimeout(300);
 log('Z5 × 로 닫으면 사라지고 유지',a&&!(await vis()),'');
 errsOK(p,'Z5'); await p.context().close();}
{const p=await fresh(b); const vis=()=>p.evaluate(()=>!document.querySelector('#welcome').classList.contains('hidden'));
 await p.click('#wSample'); await p.waitForTimeout(400); const kept=await vis();
 const n=await p.evaluate(()=>state.people.length);
 await gen(p); const after=await vis();
 log('Z6 샘플 체험: 명단 불러옴·안내 유지 → 생성하면 사라짐',kept&&n>0&&!after,`명단 ${n}명`);
 errsOK(p,'Z6'); await p.context().close();}
{// 이미 쓰던 사람: 저장된 명단이 있고 안내 기록이 없는 경우
 const p=await fresh(b); await p.click('#btnSample'); await p.waitForTimeout(800);
 await p.evaluate(()=>localStorage.removeItem('dfiDuty:welcomeDone')); await p.reload(); await p.waitForTimeout(300);
 log('Z7 저장된 명단이 있으면 안내 띠 없음',await p.evaluate(()=>document.querySelector('#welcome').classList.contains('hidden')),'');
 errsOK(p,'Z7'); await p.context().close();}
{const p=await fresh(b); await p.selectOption('#langSelect','fr'); await p.waitForTimeout(150);
 const tx=await p.evaluate(()=>document.querySelector('#welcome').textContent+document.querySelector('#btnHelp').title);
 log('Z8 다른 언어: 안내 띠·? 버튼 번역',!/[가-힣]/.test(tx),tx.replace(/\s+/g,' ').trim().slice(0,70));
 errsOK(p,'Z8'); await p.context().close();}

// AA. v1.19: 이름 끌어 놓기 맞바꾸기 · 규칙 위반 빨간 테두리 · [무시]
{const p=await fresh(b); await p.click('#wClose'); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 await p.evaluate(()=>document.querySelector('#cal').scrollIntoView({block:'center'})); await p.waitForTimeout(150);
 const drag=async(a,c)=>{const sb=await (await p.$(`#cal [data-day="${a}"] .duty-name`)).boundingBox(),db=await (await p.$(`#cal [data-day="${c}"]`)).boundingBox();
   await p.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2);await p.mouse.down();await p.mouse.move(sb.x+20,sb.y+10,{steps:3});
   await p.mouse.move(db.x+db.width/2,db.y+db.height/2,{steps:6});await p.mouse.up();await p.waitForTimeout(250);};
 // 규칙에 맞는 맞바꿈 / 어긋나는 맞바꿈 날 쌍을 규칙 점검 함수로 찾기
 const pair=await p.evaluate(()=>{const R=state.result,N=R.cal.N,P=R.cfg.people;let ok=null,bad=null;
   for(let a=1;a<=N&&(!ok||!bad);a++)for(let c=a+1;c<=N;c++){if(R.duty[a]<0||R.duty[c]<0||R.duty[a]===R.duty[c])continue;
     if(P[R.duty[a]].level>=4||P[R.duty[c]].level>=4)continue;
     const d=R.duty.slice();[d[a],d[c]]=[d[c],d[a]];const T={...R,duty:d};
     const v=ruleViolations(T,a,d[a],-1).length+ruleViolations(T,c,d[c],-1).length;
     if(!v&&!ok)ok=[a,c];if(v&&!bad)bad=[a,c];}
   return {ok,bad};});
 const dutyAt=pr=>p.evaluate(([a,c])=>[state.result.duty[a],state.result.duty[c]],pr);
 const b0=await dutyAt(pair.ok);
 await drag(...pair.ok);
 const s1=await dutyAt(pair.ok), u1=await p.evaluate(()=>!document.querySelector('#undoBar').classList.contains('hidden')), hl1=await p.evaluate(()=>state.hl);
 log('AA1 끌어 놓기 → 두 날 맞바꿈·실행 취소 막대',s1[0]===b0[1]&&s1[1]===b0[0]&&u1&&hl1<0,pair.ok.join('↔'));
 await p.click('#undoBtn'); await p.waitForTimeout(200);
 log('AA2 실행 취소로 원래대로',JSON.stringify(await dutyAt(pair.ok))===JSON.stringify(b0),'');
 await drag(...pair.bad);
 const v=await p.$$eval('#cal .cell.violate',x=>x.map(c=>[c.dataset.day,c.title,!!c.querySelector('[data-ignore]')]));
 log('AA3 규칙 위반 → 빨간 테두리·이유·[무시]',v.length>=1&&v.every(x=>x[1].includes('⚠️')&&x[2]),v.map(x=>x[0]+': '+x[1].slice(0,30)).join(' / '));
 await p.selectOption('#langSelect','en'); await p.waitForTimeout(150);
 const enT=await p.$$eval('#cal .cell.violate',x=>x.map(c=>c.title+c.textContent).join(''));
 log('AA4 언어 전환 시 이유·버튼 번역',!/[가-힣]/.test(enT)&&/Ignore/.test(enT),enT.slice(0,60));
 await p.selectOption('#langSelect','ko'); await p.waitForTimeout(150);
 await p.click('#cal [data-ignore]'); await p.waitForTimeout(150);
 log('AA5 [무시] → 그 날 빨간 표시만 사라짐',(await p.$$('#cal .cell.violate')).length===v.length-1,'');
 // 같은 칸 안에서 놓으면 변화 없음, 끌기 뒤 클릭으로 강조되지 않음
 const d0=await p.evaluate(()=>state.result.duty.join());
 const sb=await (await p.$('#cal [data-day="1"] .duty-name')).boundingBox();
 await p.mouse.move(sb.x+5,sb.y+5);await p.mouse.down();await p.mouse.move(sb.x+15,sb.y+8,{steps:3});await p.mouse.up();await p.waitForTimeout(150);
 log('AA6 같은 칸에 놓으면 변화 없음·강조 안 됨',(await p.evaluate(()=>state.result.duty.join()))===d0&&(await p.evaluate(()=>state.hl))<0,'');
 // ✎ 수동 교체: 전날 당직자(레벨 2~3)를 다음 날에 넣으면 배정 제외일 위반 → 빨간 테두리
 const tgt=await p.evaluate(()=>{const R=state.result,P=R.cfg.people;for(let d=2;d<=R.cal.N;d++){const k=R.duty[d-1];if(k>=0&&P[k].level>1&&P[k].level<4&&R.duty[d]!==k&&!R.flags.has(d))return [d,k];}return null;});
 await p.click(`#cal [data-edit="${tgt[0]}"]`); await p.waitForTimeout(150);
 await p.selectOption('#editDuty',String(tgt[1])); await p.click('#editApply'); await p.waitForTimeout(200);
 log('AA7 ✎ 수동 교체 위반도 빨간 테두리',await p.evaluate(d=>document.querySelector(`#cal [data-day="${d}"]`).classList.contains('violate'),tgt[0]),`${tgt[0]}일`);
 errsOK(p,'AA'); await p.context().close();}

// AB. v1.20: 상위 3개 안은 생성된 그대로 보존 · 카드를 누르면 처음 안으로 되돌림
{const p=await fresh(b); await p.click('#wClose'); await p.click('#btnSample'); await p.waitForTimeout(300); await gen(p);
 const o=await p.evaluate(()=>({d:state.cands[0].duty.join(),v:state.cands[0].dfi.total.toFixed(1)}));
 await p.evaluate(()=>{swapDays(2,10);swapDays(5,20);}); await p.waitForTimeout(200);
 const m=await p.evaluate(()=>({cand:state.cands[0].duty.join(),res:state.result.duty.join(),card:document.querySelector('[data-cand="0"] .cand-score').textContent,line:!!document.querySelector('[data-cand="0"] .cand-edit')}));
 log('AB1 수동 변경해도 1안 카드·원본은 그대로',m.cand===o.d&&m.res!==o.d&&m.card===o.v&&m.line,`카드 ${m.card}`);
 await p.click('[data-cand="0"]'); await p.waitForTimeout(200);
 const r=await p.evaluate(()=>({res:state.result.duty.join(),ed:state.result.edited.size,viol:document.querySelectorAll('#cal .violate').length,line:!!document.querySelector('.cand-edit'),dfi:state.result.dfi.total.toFixed(1)}));
 log('AB2 1안 카드를 누르면 처음 1안으로',r.res===o.d&&!r.ed&&!r.viol&&!r.line&&r.dfi===o.v,`DFI ${r.dfi}`);
 await p.click('#undoBtn'); await p.waitForTimeout(200);
 log('AB3 실행 취소로 수정한 당직표 복원',await p.evaluate(()=>state.result.edited.size)===4,'');
 await p.click('[data-cand="1"]'); await p.waitForTimeout(200);
 const s2=await p.evaluate(()=>({sel:state.sel,same:state.result.duty.join()===state.cands[1].duty.join(),copy:state.result!==state.cands[1],c0:state.cands[0].duty.join()}));
 log('AB4 다른 안 선택: 그 안의 처음 배정(사본), 1안 원본 유지',s2.sel===1&&s2.same&&s2.copy&&s2.c0===o.d,'');
 await p.evaluate(()=>swapDays(3,4)); await p.click('[data-cand="0"]'); await p.waitForTimeout(200);
 log('AB5 2안 수정 후 1안 선택 → 처음 1안',await p.evaluate(()=>state.sel===0&&state.result.duty.join()===state.cands[0].duty.join()&&!state.result.edited.size),'');
 errsOK(p,'AB'); await p.context().close();}

await b.close();
const f=results.filter(r=>!r.ok); console.log(`\n총 ${results.length}건 · 통과 ${results.length-f.length} · 실패 ${f.length}`);
})();
