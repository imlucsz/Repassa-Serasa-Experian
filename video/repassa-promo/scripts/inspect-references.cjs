const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const bin = path.join(root, 'node_modules/@remotion/compositor-win32-x64-msvc');
const out = path.join(root, 'out/reference-analysis');
fs.mkdirSync(out, {recursive:true});
function run(exe,args) {
  const r=spawnSync(exe+'.exe',args,{encoding:'utf8',maxBuffer:30e6,windowsHide:true});
  if(r.status!==0) throw new Error(r.stderr || r.error || `${exe}: ${r.status}`);
  return r;
}
const reports=[];
for(const file of fs.readdirSync(path.join(root,'references')).filter(f=>f.endsWith('.mp4'))) {
  const input=path.join(root,'references',file), id=file.replace(/\.mp4$/,'').replaceAll(' ','-');
  const meta=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',input]).stdout);
  const dur=Number(meta.format.duration);
  const video=meta.streams.find(s=>s.codec_type==='video');
  const transitionStarts={'amazon exemple.mp4':5.2,'ifood edit.mp4':1.7,'ifood edit2.mp4':3.8,'ifood exemple.mp4':5.5};
  const dense=process.argv.includes('--transitions');
  const times=Array.from({length:16},(_,i)=>dense?transitionStarts[file]+i*0.12:Math.max(0.05,(dur-0.2)*i/15));
  const tag=dense?`${id}-transition`:id;
  for(let i=0;i<times.length;i++) run('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(times[i]),'-i',input,'-vf','scale=240:426:force_original_aspect_ratio=decrease,pad=240:426:(ow-iw)/2:(oh-ih)/2:color=white','-frames:v','1','-y',path.join(out,`${tag}-${String(i).padStart(2,'0')}.png`)]);
  run('ffmpeg',['-hide_banner','-loglevel','error','-i',path.join(out,`${tag}-%02d.png`),'-vf','tile=4x4','-frames:v','1','-y',path.join(out,`${tag}-overview.png`)]);
  const report={file,duration:dur,width:video.width,height:video.height,fps:video.r_frame_rate,audio:meta.streams.some(s=>s.codec_type==='audio'),sampleTimes:times};
  reports.push(report); console.log(JSON.stringify(report));
}
fs.writeFileSync(path.join(out,process.argv.includes('--transitions')?'transitions.json':'metadata.json'),JSON.stringify(reports,null,2));
