const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'out/audio'),dest=path.join(root,'public/audio/master');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(dest,{recursive:true});
const silent=path.join(root,'out/repassa-promo-final.mp4'),final=path.join(root,'out/repassa-promo-audio-final.mp4');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const originalHash=hash(silent);
function run(bin,args){const r=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,maxBuffer:30e6});if(r.status!==0)throw Error(r.stderr||String(r.error));return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-nostats',...args]);
function measure(file,filter=''){const log=ff(['-i',file,'-af',(filter?filter+',':'')+'loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr;return JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);}
// Keep at least 50 ms around detected speech; never remove internal pauses.
const cues=[
 {name:'voz-01.mp3',at:.27,start:.03,end:1.69},
 {name:'voz-02.mp3',at:3.22,start:.13,end:1.99},
 {name:'voz-03.mp3',at:6.25,start:0,end:1.80},
 {name:'voz-04.mp3',at:9.20,start:.01,end:2.39},
 {name:'voz-05.mp3',at:12.35,start:.01,end:1.81},
 {name:'voz-06.mp3',at:15.50,start:0,end:2.76},
 {name:'voz-07.mp3',at:18.40,start:.07,end:3.61},
];
for(let i=0;i<cues.length;i++){
 const c=cues[i],input=path.join(root,'public/audio',c.name);assert.ok(fs.existsSync(input),input);
 c.duration=c.end-c.start;c.finish=c.at+c.duration;
 assert.ok(c.finish<=22);if(i)assert.ok(c.at>=cues[i-1].finish,'Overlapping voices');
 const trim=`atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS`;
 const m=measure(input,trim);c.gainDB=-20-Number(m.input_i);c.sourceMeasurement=m;
 ff(['-y','-i',input,'-af',`${trim},volume=${c.gainDB}dB,afade=t=in:d=0.005,afade=t=out:st=${c.duration-.01}:d=0.01`,'-ar','48000','-ac','1','-c:a','pcm_f32le',path.join(out,`voice-${i}.wav`)]);
}
const music=path.join(root,'public/audio/trilha.mp3'),musicMeasure=measure(music,'atrim=duration=22');
// Broad, deterministic ducking envelopes; no syllable-by-syllable pumping.
const envelopes=cues.map(c=>`if(lt(t,${Math.max(0,c.at-.16)}),0,if(lt(t,${c.at}), (t-${Math.max(0,c.at-.16)})/${Math.min(.16,c.at)},if(lt(t,${c.finish}),1,if(lt(t,${c.finish+.38}),1-(t-${c.finish})/.38,0))))`);
const duck=envelopes.reduce((a,b)=>`max(${a},${b})`);
const musicGain=-28-Number(musicMeasure.input_i);
ff(['-y','-i',music,'-af',`atrim=duration=22,asetpts=PTS-STARTPTS,volume=${musicGain}dB,volume='pow(10,-7*(${duck})/20)':eval=frame,afade=t=in:d=0.55,afade=t=out:st=21.1:d=0.9`,'-ar','48000','-ac','2','-c:a','pcm_f32le',path.join(out,'music.wav')]);
const args=['-y'];for(let i=0;i<7;i++)args.push('-i',path.join(out,`voice-${i}.wav`));args.push('-i',path.join(out,'music.wav'));
const graph=cues.map((c,i)=>`[${i}:a]pan=stereo|c0=c0|c1=c0,adelay=${Math.round(c.at*48000)}S:all=1[v${i}]`).join(';')+';'+cues.map((_,i)=>`[v${i}]`).join('')+'[7:a]amix=inputs=8:normalize=0:duration=longest,apad,atrim=duration=22[mix]';
const premix=path.join(out,'premix.wav');ff([...args,'-filter_complex',graph,'-map','[mix]','-ar','48000','-c:a','pcm_f32le',premix]);
const measured=measure(premix),master=path.join(dest,'repassa-master.wav');
const norm=`loudnorm=I=-16:TP=-1.5:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
const log=ff(['-y','-i',premix,'-af',norm,'-ar','48000','-c:a','pcm_s24le',master]).stderr;
ff(['-y','-i',silent,'-i',master,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-movflags','+faststart',final]);
const finalMeasure=measure(final);
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',final]).stdout);
const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
assert.equal(v.width,1080);assert.equal(v.height,1920);assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_read_frames),660);assert.equal(a.codec_name,'aac');assert.equal(a.sample_rate,'48000');assert.ok(Math.abs(Number(probe.format.duration)-22)<.05);
assert.ok(Math.abs(Number(finalMeasure.input_i)+16)<1);assert.ok(Number(finalMeasure.input_tp)<=-1,'Encoded true peak must stay below -1 dBTP');
const videoHash=file=>ff(['-v','error','-i',file,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();
assert.equal(videoHash(silent),videoHash(final));assert.equal(hash(silent),originalHash);
ff(['-v','error','-i',final,'-f','null','-']);
const report={cues,musicMeasure,musicGain,measured,mastering:JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]),finalMeasure,probe,silentSHA256:originalHash,videoStreamHash:videoHash(final),checks:'PASS: no VO overlap; ends before 22s; silent file unchanged; identical video stream; 660 frames; AAC stereo 48k; full decode; loudness and encoded true peak'};
fs.writeFileSync(path.join(out,'mastering-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({final,finalMeasure,checks:report.checks},null,2));
