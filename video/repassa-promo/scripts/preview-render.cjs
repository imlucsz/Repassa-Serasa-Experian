const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const withAudio=process.argv.includes('--audio');
const file=path.resolve(__dirname,withAudio?'../out/repassa-promo-audio-final.mp4':'../out/repassa-promo-final.mp4');
const server=http.createServer((req,res)=>{
 if(req.url==='/') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><title>RePassa — filme final</title><body style="margin:0;background:#1C2925;display:grid;place-items:center;height:100vh"><video controls playsinline preload="auto" style="height:94vh;max-width:100%" src="/video.mp4"></video></body></html>');return;}
 if(req.url!=='/video.mp4'||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const size=fs.statSync(file).size;
 const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
 if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;if(start>end){res.writeHead(416);res.end();return;}res.writeHead(206,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);}
 else {res.writeHead(200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':size});fs.createReadStream(file).pipe(res);}
});
const port=withAudio?3131:3130;
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));
