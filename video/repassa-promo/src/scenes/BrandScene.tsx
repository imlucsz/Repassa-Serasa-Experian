import {useCurrentFrame} from 'remotion';
import {Book} from '../components/Book';
import {C,Footer,OfficialLogo,rise,Stage,tween} from '../components/Motion';

export const BrandScene = () => {
  const f=useCurrentFrame(), gather=tween(f,3,32), reveal=rise(f,22);
  return <Stage>
    <svg width="1080" height="1920" style={{position:'absolute',inset:0}}>
      {[340,470,610].map((r,i)=><circle key={r} cx="540" cy="880" r={r} fill="none" stroke={i===1?C.coral:C.green} strokeWidth={i===1?2:1} opacity={.18*(1-tween(f,30,60))} strokeDasharray={`${r*4} ${r*2.3}`} transform={`rotate(${f*.55+i*90} 540 880)`}/>)}
    </svg>
    {[0,1,2,3].map((k)=>{const a=(k*90-45+f*.6)*Math.PI/180,r=410*(1-gather);return <div key={k} style={{position:'absolute',left:540+Math.cos(a)*r-90,top:880+Math.sin(a)*r-115,transform:`scale(${1-gather*.9}) rotate(${-12+k*8+f*.2}deg)`,opacity:1-tween(f,20,32)}}><Book width={180} kind={k}/></div>;})}
    <div style={{position:'absolute',top:750,left:140,opacity:reveal,transform:`translateY(${(1-reveal)*35}px) scale(${.95+.05*reveal})`}}><OfficialLogo width={800}/></div>
    <div style={{position:'absolute',top:1050,left:80,right:80,textAlign:'center',fontFamily:'Georgia',fontSize:84,lineHeight:1.14,letterSpacing:-2,color:C.ink}}>{['Conhecimento','merece circular.'].map((s,i)=><div key={s} style={{overflow:'hidden',paddingBottom:8}}><div style={{transform:`translateY(${(1-rise(f,33+i*5))*110}%)`,color:i?C.green:C.ink,fontStyle:i?'italic':'normal'}}>{s}</div></div>)}</div>
    <div style={{position:'absolute',top:1375,left:510,width:60,height:3,background:C.coral,transform:`scaleX(${rise(f,49)})`}}/>
    <Footer step="06 / 06" label="UM LIVRO. MUITAS POSSIBILIDADES."/>
  </Stage>;
};
