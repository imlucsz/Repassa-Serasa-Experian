import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../styles/theme';
export const C = theme.colors;
export const clamp = {extrapolateLeft:'clamp', extrapolateRight:'clamp'} as const;
export const tween = (f:number,a:number,b:number,x=0,y=1) => interpolate(f,[a,b],[x,y],{...clamp,easing:Easing.inOut(Easing.cubic)});
export const rise = (f:number,delay=0) => spring({frame:f-delay,fps:30,config:{damping:22,stiffness:125,mass:0.9}});

export const OfficialLogo = ({width=580}: {width?:number}) => (
  <div style={{width,height:width*145/590,position:'relative',overflow:'hidden',mixBlendMode:'multiply'}}>
    <div style={{transform:`scale(${width/590})`,transformOrigin:'0 0'}}>
      <Img src={staticFile('brand/RePassa.jpg')} style={{position:'absolute',width:1408,height:768,maxWidth:'none',left:-70,top:-207}} />
    </div>
  </div>
);

export const Stage = ({children,dark=false,green=false}: {children:ReactNode;dark?:boolean;green?:boolean}) => (
  <AbsoluteFill style={{backgroundColor:green?C.green:dark?C.ink:C.cream,color:dark||green?C.cream:C.ink,fontFamily:theme.fonts.sans,overflow:'hidden',perspective:1800}}>
    <div style={{position:'absolute',width:1300,height:1300,border:`1px solid ${dark||green?'#ffffff12':'#267A6212'}`,borderRadius:'50%',left:-650,top:450}} />
    {children}
  </AbsoluteFill>
);

export const Label = ({children,light=false}: {children:ReactNode;light?:boolean}) => <div style={{fontSize:22,letterSpacing:5,textTransform:'uppercase',color:light?C.cream:C.green,display:'flex',alignItems:'center',gap:20}}><span style={{width:48,height:3,background:C.coral}} />{children}</div>;

export const Headline = ({lines,delay=0,light=false,top=265,size=94}: {lines:string[];delay?:number;light?:boolean;top?:number;size?:number}) => {
  const f=useCurrentFrame();
  return <div style={{position:'absolute',top,left:90,right:70,fontFamily:theme.fonts.editorial,fontWeight:400,fontSize:size,lineHeight:1.09,letterSpacing:-3}}>
    {lines.map((line,i)=><div key={line} style={{overflow:'hidden',paddingBottom:8}}><div style={{transform:`translateY(${(1-rise(f,delay+i*4))*125}%)`,color:i===lines.length-1?(light?C.coral:C.green):undefined,fontStyle:i===lines.length-1?'italic':'normal'}}>{line}</div></div>)}
  </div>;
};

export const Panel = ({children,style={}}:{children:ReactNode;style?:CSSProperties}) => <div style={{background:C.cream,color:C.ink,borderRadius:40,border:'2px solid #ffffff80',boxShadow:'0 40px 90px #071a1726',...style}}>{children}</div>;

export const Check = ({progress=1,size=44,color=C.cream}:{progress?:number;size?:number;color?:string}) => <svg width={size} height={size} viewBox="0 0 48 48"><path d="M10 25L20 35L39 13" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1-progress}/></svg>;

export const Pill = ({children,coral=false}:{children:ReactNode;coral?:boolean}) => <div style={{borderRadius:30,padding:'14px 24px',background:coral?C.coral:'#267A6214',color:coral?C.ink:C.green,fontSize:24,fontWeight:600,display:'inline-flex',gap:12,alignItems:'center'}}>{children}</div>;

export const Action = ({children,done=false,progress=1}:{children:ReactNode;done?:boolean;progress?:number}) => <div style={{height:90,borderRadius:24,background:done?C.green:C.coral,color:done?C.cream:C.ink,display:'flex',alignItems:'center',justifyContent:'center',gap:16,fontSize:29,fontWeight:600,boxShadow:'0 12px 20px #1c292510'}}>{done&&<Check progress={progress} size={36}/>} {children} {!done&&<span style={{fontSize:36,marginLeft:20}}>↗</span>}</div>;

export const Footer = ({step,label,light=false}:{step:string;label:string;light?:boolean}) => <div style={{position:'absolute',left:90,right:90,bottom:150,display:'flex',alignItems:'center',gap:24,color:light?C.cream:C.ink,fontSize:20,letterSpacing:3}}><span>{step}</span><div style={{height:1,flex:1,background:light?'#ffffff35':'#1c292535'}}/><span>{label}</span></div>;

export const Institution = ({width=650}:{width?:number}) => <svg width={width} height={width*.72} viewBox="0 0 700 504" aria-label="Instituição de ensino ilustrativa">
  <path d="M50 205L350 52L650 205Z" fill={C.green}/><path d="M85 211H615V462H85Z" fill={C.cream}/><path d="M615 211L660 183V435L615 462Z" fill="#ddd8cc"/>
  {[140,245,455].map(x=><g key={x}><rect x={x} y="250" width="68" height="110" rx="32" fill={C.ink}/><path d={`M${x+34} 250V360M${x} 302H${x+68}`} stroke={C.cream} strokeWidth="4"/></g>)}
  <rect x="345" y="294" width="76" height="168" rx="38" fill={C.green}/><path d="M40 462H664V482H40Z" fill={C.coral}/><circle cx="350" cy="153" r="27" fill={C.cream}/><path d="M350 136V153L365 163" stroke={C.green} strokeWidth="4" fill="none"/>
</svg>;

export const Wipes = () => {
  const f=useCurrentFrame();
  const boundary=[270,360,480,570].find(b=>f>=b-8&&f<=b+8);
  if(!boundary)return null;
  const x=tween(f,boundary-8,boundary+8,-1650,1300);
  return <AbsoluteFill style={{pointerEvents:'none'}}><div style={{position:'absolute',inset:'-200px auto -200px 0',width:1650,background:boundary===570?C.cream:C.green,transform:`translateX(${x}px) skewX(-9deg)`,boxShadow:`-60px 0 0 ${C.coral}`}}/></AbsoluteFill>;
};
