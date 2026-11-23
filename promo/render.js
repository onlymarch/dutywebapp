// 소개 영상 렌더러: 모션그래픽(index.html)을 프레임마다 정확한 시각으로 맞춰 캡처하고 ffmpeg로 인코딩합니다.
// 사용:
//   node promo/render.js preview "1.6,8.2,14.4" [vert]   → promo/prev_<t>.jpg (가로) / prev_v_<t>.jpg (세로)
//   node promo/render.js full                            → assets/promo-20s.mp4         (1920×1080)
//   node promo/render.js full vert                       → assets/promo-shorts-20s.mp4  (1080×1920, 쇼츠·릴스용)
// 세로형은 같은 index.html을 ?vert 로 열어 CSS만 세로 배치로 바꿉니다(타임라인·음악 동일).
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
const run=(args)=>new Promise((res,rej)=>spawn('ffmpeg',args,{stdio:['ignore','ignore','inherit']}).on('close',c=>c?rej(new Error('ffmpeg '+c)):res()));
(async()=>{
const mode=process.argv[2]||'preview', vert=process.argv.includes('vert');
const W=vert?1080:1920, H=vert?1920:1080, tag=vert?'v_':'';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/index.html'+(vert?'?vert':''));await p.waitForLoadState('networkidle');
await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
await p.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
// 모든 CSS 애니메이션의 현재 시각을 t초로 맞추고, 숫자 카운터(tick)를 갱신
const seek=t=>p.evaluate(t=>{document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000;});window.tick(t);},t);
if(mode==='preview'){
  for(const t of (process.argv[3]||'').split(',').filter(Boolean).map(Number)){await seek(t);await p.screenshot({path:__dirname+`/prev_${tag}${t}.jpg`,type:'jpeg',quality:80});}
}else{
  const FPS=30,DUR=20,N=FPS*DUR, silent=__dirname+`/video-silent${vert?'-vert':''}.mp4`;
  const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','slow','-movflags','+faststart',silent],{stdio:['pipe','ignore','inherit']});
  for(let i=0;i<N;i++){await seek(i/FPS);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%60===0)process.stdout.write(i+' ');}
  ff.stdin.end();await new Promise(r=>ff.on('close',r));
  // 배경음악(python3 promo/music.py → music.wav)을 합침. loudnorm으로 SNS 권장 음량(-14 LUFS, 최대 -1 dBTP)에 맞춤
  const out=path.resolve(__dirname,'..','assets',vert?'promo-shorts-20s.mp4':'promo-20s.mp4'), wav=__dirname+'/music.wav';
  await run(fs.existsSync(wav)
    ?['-y','-i',silent,'-i',wav,'-map','0:v','-map','1:a','-c:v','copy','-af','loudnorm=I=-14:TP=-1:LRA=11','-ar','48000','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',out]
    :['-y','-i',silent,'-c','copy',out]);
  console.log('\ndone',out);
}
await b.close();})();
