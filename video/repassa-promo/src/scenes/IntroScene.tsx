import {AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {PromoProps} from '../Root';
import {theme} from '../styles/theme';

const {cream, ink, green, coral} = theme.colors;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Original vector cover illustration; no external images or 3D dependencies. */
export const IllustratedBook = () => (
  <svg width="530" height="680" viewBox="0 0 530 680" role="img" aria-label="Livro verde ilustrado com sol e folhas">
    <defs>
      <pattern id="pages" width="8" height="9" patternUnits="userSpaceOnUse">
        <path d="M0 1H8" stroke={ink} strokeOpacity="0.18" />
      </pattern>
    </defs>
    <path d="M75 60H443Q465 60 465 84V613Q465 638 440 638H77Q50 638 50 611V87Q50 60 75 60" fill={ink} />
    <path d="M83 85H451V602Q451 621 432 621H83Z" fill={cream} />
    <path d="M83 85H451V602Q451 621 432 621H83Z" fill="url(#pages)" />
    <path d="M357 563H394V651L375 636L357 651Z" fill={coral} />
    <rect x="48" y="39" width="397" height="557" rx="22" fill={green} />
    <path d="M74 40V594" stroke={ink} strokeWidth="3" opacity="0.45" />
    <rect x="99" y="84" width="302" height="465" rx="145" fill={cream} />
    <circle cx="250" cy="239" r="76" fill={coral} />
    <path d="M140 440Q194 353 248 398Q310 318 365 417V491H140Z" fill={green} />
    <path d="M254 487Q269 357 229 295" fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round" />
    <path d="M254 424Q180 419 177 359Q246 361 254 424M253 388Q312 387 326 326Q268 329 253 388M242 352Q187 342 193 293Q239 302 242 352" fill={ink} />
    <path d="M165 129H332M199 146H298" stroke={ink} strokeWidth="3" opacity="0.45" />
    <path d="M111 568H388" stroke={cream} strokeWidth="2" opacity="0.45" />
  </svg>
);

export const IntroScene = ({logoPath}: PromoProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({frame, fps, config: {damping: 19, stiffness: 90, mass: 0.9}});
  const textEntrance = interpolate(frame, [8, 25], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const transition = interpolate(frame, [65, 79], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  // Hold the green surface so the approved reveal flows into the digital scene.
  const exit = 1;
  const brandEntrance = interpolate(frame, [73, 81], [0, 1], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: cream, color: ink, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: 1 - transition}}>
        <div style={{position: 'absolute', top: 183, left: 104, right: 104, display: 'flex', alignItems: 'center', gap: 22, opacity: textEntrance}}>
          <span style={{height: 2, width: 58, backgroundColor: coral}} />
          <span style={{fontFamily: theme.fonts.sans, fontSize: 20, letterSpacing: 6}}>REPASSA</span>
        </div>
        <div style={{position: 'absolute', top: 327, width: '100%', textAlign: 'center', opacity: textEntrance, transform: `translateY(${(1 - textEntrance) * 30}px)`}}>
          <h1 style={{fontFamily: theme.fonts.editorial, fontSize: 104, lineHeight: 1.08, letterSpacing: -4, fontWeight: 400, margin: 0}}>
            Tem um livro<br /><span style={{fontStyle: 'italic', color: green}}>parado aí?</span>
          </h1>
        </div>
        <div style={{position: 'absolute', left: 315, top: 1325, width: 450, height: 40, borderRadius: '50%', backgroundColor: ink, filter: 'blur(24px)', opacity: entrance * 0.12, transform: `scale(${entrance})`}} />
        <div style={{position: 'absolute', top: 665, left: 275, opacity: interpolate(frame, [0, 9], [0, 1], clamp), transform: `translateY(${(1 - entrance) * 120}px) rotate(${-13 + entrance * 8 + Math.sin(frame / 27) * 1.3}deg) scale(${0.72 + entrance * 0.28})`}}>
          <IllustratedBook />
        </div>
        <div style={{position: 'absolute', left: 510, top: 1490, width: 60, height: 3, backgroundColor: coral, opacity: textEntrance}} />
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: transition * exit, backgroundColor: green, justifyContent: 'center', alignItems: 'center', transform: `translateY(${(1 - transition) * 1920}px)`, borderRadius: `${(1 - transition) * 180}px ${(1 - transition) * 180}px 0 0`}}>
        <div style={{opacity: brandEntrance, transform: `translateY(${(1 - brandEntrance) * 25}px)`}}>
          {logoPath ? (
            <Img src={staticFile(logoPath)} style={{width: 620, height: 240, objectFit: 'contain'}} />
          ) : (
            <span style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 116, letterSpacing: -6, color: cream}}>RePassa<span style={{color: coral}}>.</span></span>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
