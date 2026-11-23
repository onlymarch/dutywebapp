// 가이드 영상 렌더러 (30초, 1920×1080, 음성 없음)
// 사용: node promo/guide-render.js preview en "3.6,10.6,15.9"   → promo/gprev_en_<t>.jpg
//       node promo/guide-render.js full en|ko                  → assets/guide-<lang>-30s.mp4
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
(async()=>{
const mode=process.argv[2]||'preview', lang=process.argv[3]||'en';
const manifest=fs.readFileSync(path.join(__dirname,'guide',lang,'manifest.json'),'utf8');
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await p.addInitScript(`window.MANIFEST=${manifest};`);
await p.goto('file://'+__dirname+'/guide.html?lang='+lang);await p.waitForLoadState('networkidle');
await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
const seek=t=>p.evaluate(t=>{document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000;});},t);
if(mode==='preview'){
  for(const t of (process.argv[4]||'').split(',').filter(Boolean).map(Number)){await seek(t);await p.screenshot({path:__dirname+`/gprev_${lang}_${t}.jpg`,type:'jpeg',quality:80});}
}else{
  const FPS=30,DUR=30,N=FPS*DUR,out=path.resolve(__dirname,'..','assets',`guide-${lang}-30s.mp4`);
  const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','slow','-movflags','+faststart',out],{stdio:['pipe','ignore','inherit']});
  for(let i=0;i<N;i++){await seek(i/FPS);const buf=await p.screenshot({type:'jpeg',quality:94});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%90===0)process.stdout.write(i+' ');}
  ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log('\ndone',out);
}
await b.close();})();
