// 사용: node render.js preview "1.6,3.4,5.4,8.2,10.4,11.3,14.4,16.4,19.5"   또는   node render.js full
const {chromium}=require('playwright');const fs=require('fs');const {spawn}=require('child_process');
(async()=>{const mode=process.argv[2]||'preview';const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/index.html');await p.waitForLoadState('networkidle');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
await p.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
const seek=t=>p.evaluate(t=>{document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000;});window.tick(t);},t);
if(mode==='preview'){for(const t of (process.argv[3]||'').split(',').map(Number)){await seek(t);await p.screenshot({path:__dirname+`/prev_${t}.jpg`,type:'jpeg',quality:80});}}
else{const FPS=30,DUR=20,N=FPS*DUR;
 const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','slow','-movflags','+faststart',require('path').resolve(__dirname,'..','assets','promo-20s.mp4')],{stdio:['pipe','ignore','inherit']});
 for(let i=0;i<N;i++){await seek(i/FPS);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%60===0)process.stdout.write(i+' ');}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log('\ndone');}
await b.close();})()
