import {AbsoluteFill, Audio, Composition, Sequence, staticFile} from 'remotion';
import {IntroScene} from './scenes/IntroScene';
import {theme, timing} from './styles/theme';
import {DigitalScene} from './scenes/DigitalScene';
import {InstitutionScene} from './scenes/InstitutionScene';
import {CatalogScene} from './scenes/CatalogScene';
import {ReserveScene} from './scenes/ReserveScene';
import {BrandScene} from './scenes/BrandScene';
import {Wipes} from './components/Motion';

export type PromoProps = {
  /** Relative to public/, e.g. brand/repassa-logo.svg. Null until supplied. */
  logoPath: string | null;
};

const RePassaPromo = ({logoPath}: PromoProps) => (
  <AbsoluteFill style={{backgroundColor: theme.colors.cream}}>
    <Sequence durationInFrames={timing.introFrames} name="Introdução · 3s">
      <IntroScene logoPath={logoPath} />
    </Sequence>
    <Sequence from={90} durationInFrames={180} name="Oportunidade → Doação"><DigitalScene/></Sequence>
    <Sequence from={270} durationInFrames={90} name="Instituição • Material recebido"><InstitutionScene/></Sequence>
    <Sequence from={360} durationInFrames={120} name="Descubra • Catálogo"><CatalogScene/></Sequence>
    <Sequence from={480} durationInFrames={90} name="Reserve e retire"><ReserveScene/></Sequence>
    <Sequence from={570} durationInFrames={90} name="Conhecimento merece circular"><BrandScene/></Sequence>
    <Wipes/>
  </AbsoluteFill>
);

const RePassaPromoAudio = (props: PromoProps) => <>
  <RePassaPromo {...props}/>
  <Audio src={staticFile('audio/master/repassa-master.wav')}/>
</>;

export const RemotionRoot = () => (<>
  <Composition
    id="RePassaPromo"
    component={RePassaPromo}
    width={1080}
    height={1920}
    fps={timing.fps}
    durationInFrames={timing.durationInFrames}
    defaultProps={{logoPath: null}}
  />
  <Composition id="RePassaPromoAudio" component={RePassaPromoAudio}
    width={1080} height={1920} fps={timing.fps} durationInFrames={timing.durationInFrames}
    defaultProps={{logoPath:null}} />
</>);
