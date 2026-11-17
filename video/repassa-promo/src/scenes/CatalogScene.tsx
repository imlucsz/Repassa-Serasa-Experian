import {useCurrentFrame} from 'remotion';
import {Book} from '../components/Book';
import {C,Footer,Headline,Label,Panel,Pill,rise,Stage,tween} from '../components/Motion';

const materials=[{title:'Matemática',kind:1},{title:'Ciências da natureza',kind:0},{title:'Linguagens',kind:2},{title:'Química',kind:3}];
export const CatalogScene = () => {
  const f=useCurrentFrame(), browse=tween(f,38,70), select=tween(f,85,102);
  return <Stage dark>
    <div style={{position:'absolute',left:90,top:175}}><Label light>Uma estante de possibilidades</Label></div>
    <Headline lines={['Encontre o que','você precisa.']} light delay={3}/>
    <div style={{position:'absolute',left:90,right:90,top:560,height:85,border:'1px solid #f5f1e850',borderRadius:45,display:'flex',alignItems:'center',gap:20,paddingLeft:30,fontSize:27,color:C.cream,opacity:rise(f,10)}}><svg width="30" height="30" viewBox="0 0 30 30"><circle cx="12" cy="12" r="8" stroke={C.cream} strokeWidth="2" fill="none"/><path d="M18 18L27 27" stroke={C.cream} strokeWidth="2"/></svg>O que você quer aprender?</div>
    <div style={{position:'absolute',left:90,top:685,display:'flex',gap:18}}>{['Todos','Ciências','Linguagens'].map((cat,i)=><div key={cat} style={{padding:'16px 28px',fontSize:25,borderRadius:35,border:'1px solid #ffffff30',background:(browse>.5?i===1:i===0)?C.coral:'transparent',color:(browse>.5?i===1:i===0)?C.ink:C.cream,transform:`translateY(${(1-rise(f,13+i*3))*30}px)`}}>{cat}</div>)}</div>
    <div style={{position:'absolute',left:0,top:820,width:2200,height:620,perspective:1500,transform:`translateX(${-browse*430}px)`}}>
      {materials.map((m,i)=>{
        const arrive=rise(f,15+i*5),active=i===1;
        return <Panel key={m.title} style={{position:'absolute',left:90+i*430,width:390,height:570,padding:30,boxSizing:'border-box',transformOrigin:'50% 80%',transform:`translateY(${(1-arrive)*240-(active?select*45:0)}px) rotateY(${(1-browse)*(i-1)*-12}deg) rotateZ(${(1-arrive)*(i-1)*8}deg) scale(${active?1+select*.035:1})`,opacity:arrive,boxShadow:active&&select>.5?'0 0 0 4px #E78A66, 0 40px 70px #0004':'0 30px 70px #0003'}}>
          <div style={{height:337,display:'flex',justifyContent:'center',alignItems:'center',background:'#267a6209',borderRadius:22}}><Book width={235} kind={m.kind}/></div>
          <div style={{fontFamily:'Georgia',fontSize:37,lineHeight:1.08,marginTop:24,height:80}}>{m.title}</div><div style={{display:'flex',justifyContent:'space-between',fontSize:21,color:C.green}}><span>Ensino médio</span><span>↗</span></div>
        </Panel>;
      })}
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1415,height:18,background:'#f5f1e83b',transform:'perspective(900px) rotateX(35deg)',boxShadow:'0 24px 45px #0006'}}/>
    <div style={{position:'absolute',top:1510,left:90,display:'flex',gap:22,alignItems:'center',opacity:rise(f,35)}}><Pill coral>Disponível para reservar</Pill><span style={{fontSize:23,color:'#f5f1e899'}}>Novas leituras. Novos caminhos.</span></div>
    <Footer step="04 / 06" label="EXPLORE O ACERVO" light/>
  </Stage>;
};
