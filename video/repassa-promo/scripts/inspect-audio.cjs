const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'out/audio'),{recursive:true});
function run(bin,args){const r=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr||String(r.error));return r;}
const reports=[];
for(const name of [...Array.from({length:7},(_,i)=>`voz-0${i+1}.mp3`),'trilha.mp3']){
 const file=path.join(root,'public/audio',name);if(!fs.existsSync(file))throw Error(`Missing required asset: ${file}`);
 const meta=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]).stdout);
 const log=run('ffmpeg',['-hide_banner','-i',file,'-af','silencedetect=noise=-45dB:d=0.06,loudnorm=I=-18:TP=-2:LRA=9:print_format=json','-f','null','-']).stderr;
 const loudness=JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
 const silence=log.split(/\r?\n/).filter(l=>l.includes('silence_'));
 const s=meta.streams.find(s=>s.codec_type==='audio');
 const report={name,duration:Number(meta.format.duration),codec:s.codec_name,sampleRate:s.sample_rate,channels:s.channels,layout:s.channel_layout,loudness,silence};reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync(path.join(root,'out/audio/inspection.json'),JSON.stringify(reports,null,2));
