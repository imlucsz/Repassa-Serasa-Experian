const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'out/repassa-promo-final.mp4');
const out=path.join(root,'out/validation');
fs.mkdirSync(out,{recursive:true});
function run(exe,args){const p=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:20e6});if(p.status!==0)throw new Error(p.stderr||String(p.error));return p.stdout;}
const meta=JSON.parse(run('ffprobe.exe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',input]));
const v=meta.streams.find(s=>s.codec_type==='video');
assert.equal(v.width,1080);assert.equal(v.height,1920);assert.equal(v.r_frame_rate,'30/1');assert.equal(v.codec_name,'h264');assert.equal(Number(v.nb_read_frames),660);assert.ok(Math.abs(Number(meta.format.duration)-22)<.04);
run('ffmpeg.exe',['-v','error','-i',input,'-f','null','-']);
const frames=[40,155,245,340,450,550,640,659];
const boundaries=[84,89,90,96,179,180,263,270,277,353,360,367,473,480,487,563,570,577];
for(const [tag,list] of [['scene',frames],['boundary',boundaries]]){
 for(let i=0;i<list.length;i++)run('ffmpeg.exe',['-v','error','-ss',String(list[i]/30),'-i',input,'-frames:v','1','-vf','scale=270:480','-y',path.join(out,`${tag}-${String(i).padStart(2,'0')}.png`)]);
 run('ffmpeg.exe',['-v','error','-i',path.join(out,`${tag}-%02d.png`),'-vf',`tile=${tag==='scene'?'4x2':'6x3'}`,'-frames:v','1','-y',path.join(out,`${tag}-sheet.png`)]);
}
for(const frame of [155,245,450,550,640])run('ffmpeg.exe',['-v','error','-ss',String(frame/30),'-i',input,'-frames:v','1','-y',path.join(out,`full-${frame}.png`)]);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({metadata:meta,frames,boundaries,decoded:true,assertions:'1080x1920, 30fps, 660 decoded frames, H264, 22s'},null,2));
console.log('PASS: 1080x1920, 30fps, 660 decoded frames, H264, 22s; full decode without errors.');
console.log('Contact sheets: out/validation/scene-sheet.png and boundary-sheet.png');
