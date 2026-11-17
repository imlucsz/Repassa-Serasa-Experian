import {IllustratedBook} from '../scenes/IntroScene';
import {C} from './Motion';
export const Book = ({width=220,kind=0}:{width?:number;kind?:number}) => <div style={{width,height:width*680/530,position:'relative',flexShrink:0}}>
  <div style={{width:530,height:680,transform:`scale(${width/530})`,transformOrigin:'0 0'}}>
    {kind===0?<IllustratedBook/>:<svg width="530" height="680" viewBox="0 0 530 680">
      <rect x="52" y="55" width="410" height="585" rx="18" fill={C.ink}/><rect x="70" y="65" width="380" height="560" rx="12" fill={C.cream}/><rect x="45" y="35" width="398" height="570" rx="18" fill={kind===1?C.coral:kind===2?C.ink:C.green}/>
      <path d="M74 36V602" stroke={C.cream} strokeOpacity=".25" strokeWidth="3"/>
      {kind===1?<g fill="none" stroke={C.cream} strokeWidth="4"><circle cx="250" cy="310" r="130"/><path d="M120 440L250 180L380 440ZM120 180H380V440H120ZM120 310H380M250 180V440"/></g>:kind===2?<g fill={C.cream}><text x="118" y="300" fontFamily="Georgia" fontSize="160">Aa</text><path d="M120 360H360V364H120ZM120 388H310V392H120Z"/></g>:<g fill="none" stroke={C.cream} strokeWidth="5"><ellipse cx="250" cy="310" rx="145" ry="58" transform="rotate(60 250 310)"/><ellipse cx="250" cy="310" rx="145" ry="58" transform="rotate(-60 250 310)"/><ellipse cx="250" cy="310" rx="145" ry="58"/><circle cx="250" cy="310" r="14" fill={C.coral}/></g>}
      <text x="114" y="120" fontFamily="Arial" fontSize="23" fill={C.cream} letterSpacing="5">{kind===1?'MATEMÁTICA':kind===2?'LINGUAGENS':'QUÍMICA'}</text><path d="M114 540H370" stroke={C.cream} strokeWidth="2"/>
    </svg>}
  </div>
</div>;
