import { useState, type CSSProperties } from 'react';
import { Clock, type ClockPreset } from '../../common/widgets/clock/Clock';
import { defaults } from './config/defaults';
import './theme.css';

type ThemeAnimation = 'none' | 'pulse' | 'fade' | 'slide' | 'bounce';
type ThemeHoverEffect = 'none' | 'highlight' | 'tilt' | 'glow';

const presetOptions: readonly { value: ClockPreset; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'preframed', label: 'Digital pre-framed' },
  { value: 'analog-plain', label: 'Analog plain' },
  { value: 'analog-preframed', label: 'Analog pre-framed' },
  { value: 'analog-digitalized-preframed', label: 'Analog + digital pre-framed' },
];

const isDigitalizedPreset = (preset: ClockPreset) => preset === 'plain' || preset === 'preframed' || preset === 'analog-digitalized-preframed';
const isCustomizablePreset = (preset: ClockPreset) => preset === 'preframed' || preset === 'analog-preframed' || preset === 'analog-digitalized-preframed';
const isAnalogPreset = (preset: ClockPreset) => preset === 'analog-plain' || preset === 'analog-preframed' || preset === 'analog-digitalized-preframed';

export function Theme() {
  const [preset, setPreset] = useState<ClockPreset>('preframed');
  const [format, setFormat] = useState('hh:mm:ss A');
  const [showAmPm, setShowAmPm] = useState(true);
  const [color, setColor] = useState('#7f56d9');
  const [frameColor, setFrameColor] = useState('#7f56d9');
  const [backgroundColor, setBackgroundColor] = useState('#7f56d9');
  const [analogColor, setAnalogColor] = useState('#7f56d9');
  const [fontFamily, setFontFamily] = useState('system-ui, sans-serif');
  const [fontSize, setFontSize] = useState('2rem');
  const [backgroundOpacity, setBackgroundOpacity] = useState(12);
  const [analogSize, setAnalogSize] = useState('7rem');
  const [lineThickness, setLineThickness] = useState(1);
  const [borderWidth, setBorderWidth] = useState('1px');
  const [borderRadius, setBorderRadius] = useState('14px');
  const [borderOpacity, setBorderOpacity] = useState(100);
  const [padding, setPadding] = useState('.75rem 1rem');
  const [showSeconds, setShowSeconds] = useState(true);
  const [digitalPosition, setDigitalPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [animation, setAnimation] = useState<ThemeAnimation>('none');
  const [animationDuration, setAnimationDuration] = useState('1.8s');
  const [entranceAnimation, setEntranceAnimation] = useState<ThemeAnimation>('fade');
  const [exitAnimation, setExitAnimation] = useState<ThemeAnimation>('fade');
  const [entranceDuration, setEntranceDuration] = useState('.45s');
  const [exitDuration, setExitDuration] = useState('.45s');
  const [hoverEffect, setHoverEffect] = useState<ThemeHoverEffect>('highlight');
  const [hoverStrength, setHoverStrength] = useState(55);
  const [isExiting, setIsExiting] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const customizable = isCustomizablePreset(preset);
  const digitalized = isDigitalizedPreset(preset);
  const analog = isAnalogPreset(preset);
  const animationClass = animation === 'none' ? '' : ` dev-theme-animation dev-theme-animation--${animation}`;
  const entranceClass = entranceAnimation === 'none' ? '' : ` dev-entrance-animation dev-entrance-animation--${entranceAnimation}`;
  const exitClass = isExiting && exitAnimation !== 'none' ? ` dev-exit-animation dev-exit-animation--${exitAnimation}` : '';
  const hoverClass = hoverEffect === 'none' ? '' : ` dev-theme-hover dev-theme-hover--${hoverEffect}`;
  const replayPreview = () => {
    setIsExiting(true);
    window.setTimeout(() => {
      setPreviewKey((value) => value + 1);
      setIsExiting(false);
    }, 450);
  };

  return (
    <main className="dev-theme">
      <section className="dev-showcase" aria-labelledby="dev-showcase-title">
        <header className="dev-showcase-header">
          <p className="dev-eyebrow">Widget playground</p>
          <h1 id="dev-showcase-title">Every clock preset</h1>
          <p>One example of every clock preset, showing which parts belong to the widget and which belong to the theme.</p>
        </header>

        <section className="dev-configurator" aria-labelledby="configurator-title">
          <div className="dev-configurator-heading">
            <div>
              <p className="dev-eyebrow">Interactive theme editor</p>
              <h2 id="configurator-title">Configure a clock preset</h2>
            </div>
            <p>Controls update the preview immediately. Plain presets leave styling entirely to this theme.</p>
          </div>
          <div className="dev-configurator-layout">
            <div className="dev-configurator-controls">
              <label>Preset<select value={preset} onChange={(event) => setPreset(event.target.value as ClockPreset)}>{presetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>Format<input value={format} disabled={!digitalized} onChange={(event) => setFormat(event.target.value)} /></label>
              <label className="dev-checkbox-control"><input type="checkbox" checked={showAmPm} disabled={!digitalized} onChange={(event) => setShowAmPm(event.target.checked)} /> Show AM/PM</label>
              <label>Text color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
              <label>Frame color<input type="color" value={frameColor} disabled={!customizable} onChange={(event) => setFrameColor(event.target.value)} /></label>
              <label>Background color<input type="color" value={backgroundColor} disabled={!customizable} onChange={(event) => setBackgroundColor(event.target.value)} /></label>
              <label>Analog color<input type="color" value={analogColor} disabled={!analog} onChange={(event) => setAnalogColor(event.target.value)} /></label>
              <label>Font<select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}><option value="system-ui, sans-serif">System UI</option><option value="Georgia, serif">Georgia</option><option value="ui-monospace, SFMono-Regular, Consolas, monospace">Monospace</option></select></label>
              <label>Font size<input value={fontSize} onChange={(event) => setFontSize(event.target.value)} /></label>
              <label>Analog size<input value={analogSize} disabled={!analog} onChange={(event) => setAnalogSize(event.target.value)} /></label>
              <label>Hand thickness<input type="range" min="0.5" max="3" step="0.1" value={lineThickness} disabled={!analog} onChange={(event) => setLineThickness(Number(event.target.value))} /><span>{lineThickness.toFixed(1)}×</span></label>
              <label>Border thickness<input value={borderWidth} disabled={!customizable} onChange={(event) => setBorderWidth(event.target.value)} /></label>
              <label>Corner radius<input value={borderRadius} disabled={!customizable} onChange={(event) => setBorderRadius(event.target.value)} /></label>
              <label>Border opacity<input type="range" min="0" max="100" value={borderOpacity} disabled={!customizable} onChange={(event) => setBorderOpacity(Number(event.target.value))} /><span>{borderOpacity}%</span></label>
              <label>Padding<input value={padding} disabled={!customizable} onChange={(event) => setPadding(event.target.value)} /></label>
              <label className="dev-checkbox-control"><input type="checkbox" checked={showSeconds} disabled={!analog} onChange={(event) => setShowSeconds(event.target.checked)} /> Show seconds hand</label>
              <label>Animation<select value={animation} onChange={(event) => setAnimation(event.target.value as ThemeAnimation)}><option value="none">None</option><option value="pulse">Pulse</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="bounce">Bounce</option></select></label>
              <label>Animation speed<input value={animationDuration} onChange={(event) => setAnimationDuration(event.target.value)} /></label>
              <label>Entrance animation<select value={entranceAnimation} onChange={(event) => setEntranceAnimation(event.target.value as ThemeAnimation)}><option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="bounce">Bounce</option></select></label>
              <label>Entrance speed<input value={entranceDuration} onChange={(event) => setEntranceDuration(event.target.value)} /></label>
              <label>Exit animation<select value={exitAnimation} onChange={(event) => setExitAnimation(event.target.value as ThemeAnimation)}><option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="bounce">Bounce</option></select></label>
              <label>Exit speed<input value={exitDuration} onChange={(event) => setExitDuration(event.target.value)} /></label>
              <label>Hover effect<select value={hoverEffect} onChange={(event) => setHoverEffect(event.target.value as ThemeHoverEffect)}><option value="none">None</option><option value="highlight">Highlight</option><option value="tilt">Tilt</option><option value="glow">Glow</option></select></label>
              <label>Hover strength<input type="range" min="0" max="100" value={hoverStrength} disabled={hoverEffect === 'none'} onChange={(event) => setHoverStrength(Number(event.target.value))} /><span>{hoverStrength}%</span></label>
              <label>Digital position<select value={digitalPosition} disabled={preset !== 'analog-digitalized-preframed'} onChange={(event) => setDigitalPosition(event.target.value as 'top' | 'bottom' | 'left' | 'right')}><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label>
              <label>Frame opacity<input type="range" min="0" max="100" value={backgroundOpacity} disabled={!customizable} onChange={(event) => setBackgroundOpacity(Number(event.target.value))} /><span>{backgroundOpacity}%</span></label>
              <button type="button" className="dev-replay-button" onClick={replayPreview}>Replay entrance / exit</button>
            </div>
            <div key={previewKey} className={`dev-configurator-preview${animationClass}${entranceClass}${exitClass}${hoverClass}`} style={{ color, fontFamily, fontSize, '--dev-animation-duration': animationDuration, '--dev-entrance-duration': entranceDuration, '--dev-exit-duration': exitDuration, '--dev-hover-strength': `${hoverStrength}%`, '--dev-hover-angle': `${Math.max(1, hoverStrength / 12)}deg`, '--dev-analog-size': analogSize, '--dev-hour-width': String(2.8 * lineThickness), '--dev-minute-width': String(1.8 * lineThickness), '--dev-second-width': String(.8 * lineThickness) } as CSSProperties}>
              <Clock id="interactive-clock" preset={preset} format={format} showAmPm={showAmPm} color={color} textColor={color} frameColor={frameColor} backgroundColor={backgroundColor} analogColor={analogColor} fontFamily={fontFamily} fontSize={fontSize} backgroundOpacity={backgroundOpacity} borderOpacity={borderOpacity} borderRadius={borderRadius} size={analogSize} lineThickness={lineThickness} showSeconds={showSeconds} borderWidth={borderWidth} padding={padding} digitalPosition={digitalPosition} />
            </div>
          </div>
        </section>

        <div className="dev-preset-grid">
          <article className="dev-preset-card dev-preset-card--plain">
            <div className="dev-card-heading">
              <div><p className="dev-card-kicker">Theme-owned</p><h2>Plain</h2></div>
              <span className="dev-badge">plain</span>
            </div>
            <div className="dev-preset-display dev-preset-display--plain">
              <Clock id="showcase-plain" preset="plain" format="hh:mm:ss A" />
            </div>
            <p className="dev-preset-note">Only syntax and identity come from the clock.</p>
          </article>

          <article className="dev-preset-card dev-preset-card--preframed">
            <div className="dev-card-heading">
              <div><p className="dev-card-kicker">Limited widget customization</p><h2>Digital pre-framed</h2></div>
              <span className="dev-badge">preframed</span>
            </div>
            <div className="dev-preset-display">
              <Clock id="showcase-preframed" themeId="dev" {...defaults.clock} />
            </div>
            <p className="dev-preset-note">Digital display with the built-in transparent rounded frame.</p>
          </article>

          <article className="dev-preset-card dev-preset-card--plain">
            <div className="dev-card-heading">
              <div><p className="dev-card-kicker">Theme-owned</p><h2>Analog plain</h2></div>
              <span className="dev-badge">analog-plain</span>
            </div>
            <div className="dev-preset-display dev-preset-display--analog-plain">
              <Clock id="showcase-analog-plain" preset="analog-plain" />
            </div>
            <p className="dev-preset-note">Bare analog output; the theme controls its entire presentation.</p>
          </article>

          <article className="dev-preset-card dev-preset-card--preframed">
            <div className="dev-card-heading">
              <div><p className="dev-card-kicker">Limited widget customization</p><h2>Analog pre-framed</h2></div>
              <span className="dev-badge">analog-preframed</span>
            </div>
            <div className="dev-preset-display dev-preset-display--analog-preframed">
              <Clock id="showcase-analog-preframed" themeId="dev" preset="analog-preframed" color="#7f56d9" size="7rem" />
            </div>
            <p className="dev-preset-note">Analog display with a customizable transparent rounded frame.</p>
          </article>

          <article className="dev-preset-card dev-preset-card--preframed dev-preset-card--wide">
            <div className="dev-card-heading">
              <div><p className="dev-card-kicker">Limited widget customization</p><h2>Analog + digital pre-framed</h2></div>
              <span className="dev-badge">analog-digitalized-preframed</span>
            </div>
            <div className="dev-preset-display dev-preset-display--analog-digitalized">
              <Clock id="showcase-analog-digitalized" themeId="dev" preset="analog-digitalized-preframed" color="#b42318" size="6rem" digitalPosition="right" format="HH:mm" showAmPm={false} />
            </div>
            <p className="dev-preset-note">Analog and digital output combined; digits can be placed top, left, or right.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
