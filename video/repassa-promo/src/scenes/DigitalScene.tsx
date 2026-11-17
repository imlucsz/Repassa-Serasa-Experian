import {Sequence,useCurrentFrame} from 'remotion';
import {Action,C,Footer,Headline,Label,Panel,Pill,rise,Stage,tween} from '../components/Motion';
import {Book} from '../components/Book';

/** One continuous camera/card across opportunity and donation, no reset at 6s. */
export const DigitalScene = () => {
  const f=useCurrentFrame();
  const settle=tween(f,0,22), ui=rise(f,20), form=tween(f,90,108), sent=tween(f,143,155);
  const bookScale=tween(f,24,62,1,.49);
  return <Stage green>
    <div style={{position:'absolute',left:0,width:1080,textAlign:'center',top:890-710*settle,fontSize:116-80*settle,fontWeight:700,letterSpacing:-6+5*settle,color:C.cream}}>RePassa<span style={{color:C.coral}}>.</span></div>
    <Sequence durationInFrames={90} style={{opacity:1-tween(f,80,89)}}><Headline lines={['Ele ainda pode','ensinar muito.']} light delay={14}/></Sequence>
    <Sequence from={90}><Headline lines={['Anuncie.','RePasse.']} light/></Sequence>
    <div style={{position:'absolute',top:650,left:130,width:820,height:900,opacity:ui,transform:`translateY(${(1-ui)*310}px) rotateX(${(1-ui)*20}deg) rotateY(${tween(f,20,75,-12,0)}deg)`}}>
      <Panel style={{height:'100%',padding:48,boxSizing:'border-box',overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><Label>{form>.5?'Doar material':'Seu próximo capítulo'}</Label><span style={{fontSize:32,color:C.green}}>↗</span></div>
        <div style={{position:'absolute',top:125,left:335,right:45,opacity:tween(f,48,65)}}>
          <div style={{fontFamily:'Georgia',fontSize:49,lineHeight:1.12,marginBottom:22}}>Ciências<br/>da natureza</div>
          <div style={{fontSize:25,color:C.green,marginBottom:25}}>Ensino médio</div><Pill>Em bom estado</Pill>
        </div>
        <div style={{position:'absolute',left:55,right:55,top:490,opacity:1-form}}>
          <div style={{height:1,background:'#267A6230',marginBottom:42}}/>
          <div style={{fontFamily:'Georgia',fontSize:48,lineHeight:1.2,marginBottom:40}}>Uma nova história<br/>começa com você.</div>
          <Action>Quero doar</Action>
        </div>
        <div style={{position:'absolute',left:55,right:55,top:465,opacity:form,transform:`translateY(${(1-form)*40}px)`}}>
          {[['Título','Ciências da natureza'],['Condição','Bom estado']].map(([label,value],i)=><div key={label} style={{marginBottom:20,opacity:rise(f,94+i*8),transform:`translateX(${(1-rise(f,94+i*8))*35}px)`}}><div style={{fontSize:19,color:C.green,marginBottom:8}}>{label}</div><div style={{border:'1px solid #1c292528',borderRadius:14,padding:'19px 24px',fontSize:28,display:'flex',justifyContent:'space-between'}}>{value}<span style={{color:C.green}}>✓</span></div></div>)}
          <div style={{marginTop:30,transform:`scale(${1-Math.sin(tween(f,138,147)*Math.PI)*.035})`}}><Action done={sent>.5} progress={sent}>{sent>.5?'Anúncio criado':'Publicar doação'}</Action></div>
        </div>
      </Panel>
    </div>
    <div style={{position:'absolute',left:tween(f,24,62,275,205),top:tween(f,24,62,760,775),transform:`scale(${bookScale}) rotate(${tween(f,24,62,-6,0)}deg)`,transformOrigin:'0 0',opacity:tween(f,12,23)}}><Book width={530}/></div>
    <Footer step={f<90?'01 / 06':'02 / 06'} label={f<90?'NOVAS POSSIBILIDADES':'DOE CONHECIMENTO'} light/>
  </Stage>;
};
