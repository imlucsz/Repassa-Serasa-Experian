import {useCurrentFrame} from 'remotion';
import {Book} from '../components/Book';
import {C,Check,Footer,Headline,Institution,Label,Panel,rise,Stage,tween} from '../components/Motion';

export const InstitutionScene = () => {
  const f=useCurrentFrame(), deposit=tween(f,14,49), confirm=rise(f,48);
  return <Stage>
    <div style={{position:'absolute',left:90,top:175}}><Label>Ponto de encontro</Label></div>
    <Headline lines={['Na instituição,','um novo começo.']} delay={4} size={88}/>
    <div style={{position:'absolute',top:650,left:115,transform:`translateY(${(1-rise(f,3))*100}px)`,opacity:rise(f,3)}}><Institution width={850}/></div>
    <div style={{position:'absolute',left:205+deposit*215,top:635+deposit*465,transform:`scale(${.65-deposit*.27}) rotate(${(-12+deposit*12)}deg)`,transformOrigin:'0 0',opacity:1-tween(f,44,52)}}><Book width={530}/></div>
    <div style={{position:'absolute',left:155,top:1130,width:770,height:175,background:C.green,borderRadius:'18px 18px 30px 30px',boxShadow:'0 30px 60px #1c292523'}}>
      <div style={{height:15,margin:'-6px 40px 0',background:C.ink,borderRadius:10}}/>
      <div style={{padding:'43px 48px',fontSize:30,color:C.cream,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>Instituição de ensino<br/><span style={{fontSize:20,opacity:.7}}>Ponto de recebimento</span></span><span style={{fontSize:50}}>↓</span></div>
    </div>
    <Panel style={{position:'absolute',left:155,top:1360,width:770,padding:30,boxSizing:'border-box',display:'flex',alignItems:'center',gap:25,opacity:confirm,transform:`translateY(${(1-confirm)*45}px)`}}><div style={{width:70,height:70,borderRadius:35,background:C.green,display:'grid',placeItems:'center'}}><Check progress={tween(f,51,65)}/></div><div><div style={{fontSize:32,fontWeight:600}}>Material recebido</div><div style={{fontSize:23,marginTop:10,color:C.green}}>Conferido e adicionado ao acervo</div></div></Panel>
    <Footer step="03 / 06" label="INSTITUIÇÃO ILUSTRATIVA"/>
  </Stage>;
};
