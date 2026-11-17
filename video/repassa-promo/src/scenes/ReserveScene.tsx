import {Img,staticFile,useCurrentFrame} from 'remotion';
import {Book} from '../components/Book';
import {Action,C,Check,Footer,Headline,Label,Panel,rise,Stage,tween} from '../components/Motion';

export const ReserveScene = () => {
  const f=useCurrentFrame(),reserved=tween(f,20,32),collected=tween(f,57,70);
  return <Stage>
    <div style={{position:'absolute',left:90,top:175}}><Label>Seu próximo capítulo</Label></div>
    <Headline lines={['Reserve','e retire.']} delay={3}/>
    <Panel style={{position:'absolute',top:610,left:130,width:820,height:610,padding:45,boxSizing:'border-box',transform:`translateY(${(1-rise(f,3))*80}px)`,border:'1px solid #267a6230'}}>
      <div style={{display:'flex',alignItems:'center',gap:30}}><Book width={145}/><div><div style={{fontFamily:'Georgia',fontSize:41}}>Ciências da natureza</div><div style={{fontSize:24,color:C.green,marginTop:14}}>Retirada na instituição de ensino</div></div></div>
      <div style={{position:'relative',height:150,marginTop:25}}>
        <div style={{position:'absolute',inset:0,opacity:1-reserved,paddingTop:30}}><Action>Reservar material</Action></div>
        <div style={{position:'absolute',inset:0,opacity:reserved,transform:`translateY(${(1-reserved)*25}px)`}}><div style={{fontSize:22,color:C.green,letterSpacing:2}}>SEU CÓDIGO DE RETIRADA</div><div style={{fontSize:77,fontWeight:600,letterSpacing:15,marginTop:14}}>RP-2048</div></div>
      </div>
      <div style={{marginTop:30,height:1,background:'#1c292520'}}/>
      <div style={{display:'flex',alignItems:'center',gap:16,marginTop:25,fontSize:26,color:C.green}}><Check color={C.green} progress={reserved} size={35}/>{collected>.5?'Retirada confirmada':reserved>.5?'Reserva confirmada':'Escolha. Reserve. Vá buscar.'}</div>
      <div style={{fontSize:18,color:'#1c292580',marginTop:12}}>Código ilustrativo</div>
    </Panel>
    <div style={{position:'absolute',left:130,top:1290,width:320,height:320,borderRadius:'50%',overflow:'hidden',opacity:rise(f,36),transform:`scale(${.9+.1*rise(f,36)})`,mixBlendMode:'multiply'}}><Img src={staticFile('illustrations/RePassa.jpg')} style={{position:'absolute',width:697,height:380,left:-190,top:-35,maxWidth:'none'}}/></div>
    <div style={{position:'absolute',left:500,top:1355,right:90,opacity:rise(f,47)}}><div style={{width:62,height:62,borderRadius:'50%',background:C.green,display:'grid',placeItems:'center',transform:`scale(${rise(f,57)})`}}><Check progress={collected}/></div><div style={{fontFamily:'Georgia',fontSize:42,lineHeight:1.1,marginTop:20}}>Pronto para<br/>seguir com você.</div></div>
    <Footer step="05 / 06" label="RESERVE • RETIRE • APRENDA"/>
  </Stage>;
};
