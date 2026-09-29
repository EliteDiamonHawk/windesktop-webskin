import { type CSSProperties, type ReactNode } from 'react';
import { Widget, type WidgetProps, type WidgetSetting } from '../Widget';

export type ClockPreset =
  | 'plain'
  | 'preframed'
  | 'analog-plain'
  | 'analog-preframed'
  | 'analog-digitalized-preframed';

export type ClockFormat = string;
export type DigitalPosition = 'left' | 'right' | 'top' | 'bottom';

export type ClockProps = Omit<WidgetProps, 'preset'> & {
  preset?: ClockPreset;
  /** Format tokens plus [literal words], /n line breaks, /t tabs, and // literal slashes. */
  format?: ClockFormat;
  color?: string;
  frameColor?: string;
  backgroundColor?: string;
  textColor?: string;
  analogColor?: string;
  fontFamily?: string;
  fontSize?: CSSProperties['fontSize'];
  fontWeight?: CSSProperties['fontWeight'];
  letterSpacing?: CSSProperties['letterSpacing'];
  lineHeight?: CSSProperties['lineHeight'];
  size?: CSSProperties['width'];
  lineThickness?: number;
  showSeconds?: boolean;
  backgroundOpacity?: number;
  borderOpacity?: number;
  borderRadius?: CSSProperties['borderRadius'];
  borderWidth?: CSSProperties['borderWidth'];
  padding?: CSSProperties['padding'];
  digitalPosition?: DigitalPosition;
  showAmPm?: boolean;
  className?: string;
  style?: CSSProperties;
};

const defaultFormat: ClockFormat = 'hh:mm:ss A';
const defaultColor = 'currentColor';
const defaultBackgroundOpacity = 12;
const defaultClockPreset: ClockPreset = 'preframed';

const pad = (value: number) => String(value).padStart(2, '0');

function formatTime(time: Date, format: string, showAmPm: boolean) {
  const hours = time.getHours();
  const twelveHour = hours % 12 || 12;
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const tokens: Record<string, string> = {
    HH: pad(hours), H: String(hours), hh: pad(twelveHour), h: String(twelveHour),
    mm: pad(time.getMinutes()), m: String(time.getMinutes()), ss: pad(time.getSeconds()), s: String(time.getSeconds()),
    A: showAmPm ? meridiem : '', a: showAmPm ? meridiem.toLowerCase() : '',
  };
  const tokenNames = ['HH', 'hh', 'mm', 'ss', 'A', 'a', 'H', 'h', 'm', 's'];
  let result = '';

  for (let index = 0; index < format.length;) {
    const character = format[index];
    if (character === '[') {
      const closingBracket = format.indexOf(']', index + 1);
      if (closingBracket !== -1) {
        result += format.slice(index + 1, closingBracket);
        index = closingBracket + 1;
        continue;
      }
    }
    if (character === '/') {
      const escaped = format[index + 1];
      if (escaped === undefined) result += '/';
      else if (escaped === 'n') result += '\n';
      else if (escaped === 't') result += '\t';
      else result += escaped;
      index += escaped === undefined ? 1 : 2;
      continue;
    }
    const token = tokenNames.find((name) => format.startsWith(name, index));
    if (token) {
      result += tokens[token];
      index += token.length;
    } else {
      result += character;
      index += 1;
    }
  }

  return result.split('\n').map((line) => line.replace(/[ \t]{2,}/g, ' ').trim()).join('\n');
}

const clockHands = (time: Date) => ({
  hour: ((time.getHours() % 12) + time.getMinutes() / 60) * 30,
  minute: (time.getMinutes() + time.getSeconds() / 60) * 6,
  second: time.getSeconds() * 6,
});

function AnalogClock({ time, color, size, styled, lineThickness = 1, showSeconds = true, data }: {
  time: Date;
  color?: string;
  size?: CSSProperties['width'];
  styled: boolean;
  lineThickness?: number;
  showSeconds?: boolean;
  data: { widget: string; id: string; preset: ClockPreset };
}) {
  const hands = clockHands(time);
  return (
    <svg
      className={styled ? 'clock-analog clock-analog--styled' : undefined}
      data-widget={data.widget}
      data-widget-id={data.id}
      data-widget-preset={data.preset}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Analog clock"
      style={styled ? {
        color,
        width: size,
        height: size,
        '--clock-hand-scale': lineThickness,
        '--clock-hour-width': 3.5 * lineThickness,
        '--clock-minute-width': 2.4 * lineThickness,
        '--clock-second-width': lineThickness,
      } as CSSProperties : undefined}
    >
      <circle className="clock-analog__face" cx="50" cy="50" r="45" />
      <line className="clock-analog__hand clock-analog__hand--hour" x1="50" y1="50" x2="50" y2="27" transform={`rotate(${hands.hour} 50 50)`} />
      <line className="clock-analog__hand clock-analog__hand--minute" x1="50" y1="50" x2="50" y2="17" transform={`rotate(${hands.minute} 50 50)`} />
      {showSeconds && <line className="clock-analog__hand clock-analog__hand--second" x1="50" y1="53" x2="50" y2="13" transform={`rotate(${hands.second} 50 50)`} />}
      <circle className="clock-analog__pin" cx="50" cy="50" r="2.5" />
    </svg>
  );
}

export class Clock extends Widget<ClockProps, { time: Date }> {
  state = { time: new Date(), persistedSettings: {}, runtimeOverrides: {} };
  private timer?: number;

  componentDidMount() {
    super.componentDidMount();
    this.timer = window.setInterval(() => this.setState({ time: new Date() }), 1000);
  }

  componentWillUnmount() {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    super.componentWillUnmount();
  }

  private getClockPreset(): ClockPreset {
    return this.props.preset ?? defaultClockPreset;
  }

  private isThemeOwnedPreset(preset = this.getClockPreset()) {
    return preset === 'plain' || preset === 'analog-plain';
  }

  private isCustomizablePreset(preset = this.getClockPreset()) {
    return preset === 'preframed' || preset === 'analog-preframed' || preset === 'analog-digitalized-preframed';
  }

  getWidgetSettings(preset: string = this.getClockPreset()): readonly WidgetSetting[] {
    const selectedPreset = preset as ClockPreset;
    if (this.isThemeOwnedPreset(selectedPreset) || !this.isCustomizablePreset(selectedPreset)) return [];
    return this.getStyledWidgetSettings(selectedPreset);
  }

  protected getPlainWidgetSettings(): readonly WidgetSetting[] {
    return [];
  }

  protected getStyledWidgetSettings(forPreset = this.getClockPreset()): readonly WidgetSetting[] {
    const preset = forPreset;
    const settings: WidgetSetting[] = [
      { key: 'format', label: 'Format', type: 'string', defaultValue: defaultFormat, description: 'Tokens: HH/H, hh/h, mm/m, ss/s, A/a. Use [words] for literals and /n for line breaks.' },
      { key: 'showAmPm', label: 'Show AM/PM', type: 'boolean', defaultValue: true },
      { key: 'color', label: 'Color', type: 'color', defaultValue: defaultColor },
      { key: 'frameColor', label: 'Frame color', type: 'color', defaultValue: defaultColor },
      { key: 'backgroundColor', label: 'Background color', type: 'color', defaultValue: defaultColor },
      { key: 'textColor', label: 'Text color', type: 'color', defaultValue: defaultColor },
      { key: 'fontFamily', label: 'Font', type: 'string', defaultValue: 'inherit' },
      { key: 'fontSize', label: 'Size', type: 'string', defaultValue: 'inherit' },
      { key: 'fontWeight', label: 'Weight', type: 'number', defaultValue: 400 },
      { key: 'letterSpacing', label: 'Letter spacing', type: 'string', defaultValue: 'normal' },
      { key: 'lineHeight', label: 'Line height', type: 'string', defaultValue: 'normal' },
      { key: 'backgroundOpacity', label: 'Background transparency', type: 'number', defaultValue: defaultBackgroundOpacity },
      { key: 'borderOpacity', label: 'Border opacity', type: 'number', defaultValue: 100 },
      { key: 'borderRadius', label: 'Corner radius', type: 'string', defaultValue: '14px' },
      { key: 'borderWidth', label: 'Border width', type: 'string', defaultValue: '1px' },
      { key: 'padding', label: 'Padding', type: 'string', defaultValue: '.75rem 1rem' },
    ];
    if (preset === 'analog-preframed' || preset === 'analog-digitalized-preframed') {
      settings.push(
        { key: 'analogColor', label: 'Analog color', type: 'color', defaultValue: defaultColor },
        { key: 'size', label: 'Analog size', type: 'string', defaultValue: '8rem' },
        { key: 'lineThickness', label: 'Hand thickness', type: 'number', defaultValue: 1 },
        { key: 'showSeconds', label: 'Show seconds hand', type: 'boolean', defaultValue: true },
      );
    }
    if (preset === 'analog-digitalized-preframed') {
      settings.push({
        key: 'digitalPosition', label: 'Digital position', type: 'select', defaultValue: 'top',
        options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }, { label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }],
      });
    }
    return settings;
  }

  private getFormat() { return this.getWidgetValue<string>('format') ?? this.props.format ?? defaultFormat; }
  private getShowAmPm() { return this.getWidgetValue<boolean>('showAmPm') ?? this.props.showAmPm ?? true; }

  private getPreframedStyle(): CSSProperties {
    const clampOpacity = (value: number | undefined, fallback: number) => `${Math.min(100, Math.max(0, value ?? fallback))}%`;
    return {
      '--clock-preframed-color': this.getWidgetValue<string>('textColor') ?? this.props.textColor ?? this.getWidgetValue<string>('color') ?? this.props.color ?? defaultColor,
      '--clock-preframed-frame-color': this.getWidgetValue<string>('frameColor') ?? this.props.frameColor ?? this.getWidgetValue<string>('color') ?? this.props.color ?? defaultColor,
      '--clock-preframed-background-color': this.getWidgetValue<string>('backgroundColor') ?? this.props.backgroundColor ?? this.getWidgetValue<string>('color') ?? this.props.color ?? defaultColor,
      '--clock-preframed-font-family': this.getWidgetValue<string>('fontFamily') ?? this.props.fontFamily ?? 'inherit',
      '--clock-preframed-font-size': this.getWidgetValue<string | number>('fontSize') ?? this.props.fontSize ?? '2rem',
      '--clock-preframed-font-weight': this.getWidgetValue<string | number>('fontWeight') ?? this.props.fontWeight ?? 400,
      '--clock-preframed-letter-spacing': this.getWidgetValue<string | number>('letterSpacing') ?? this.props.letterSpacing ?? 'normal',
      '--clock-preframed-line-height': this.getWidgetValue<string | number>('lineHeight') ?? this.props.lineHeight ?? 1,
      '--clock-preframed-background-opacity': clampOpacity(this.getWidgetValue<number>('backgroundOpacity') ?? this.props.backgroundOpacity, defaultBackgroundOpacity),
      '--clock-preframed-border-opacity': clampOpacity(this.getWidgetValue<number>('borderOpacity') ?? this.props.borderOpacity, 100),
      '--clock-preframed-border-radius': this.getWidgetValue<string>('borderRadius') ?? this.props.borderRadius ?? '14px',
      '--clock-preframed-border-width': this.getWidgetValue<string>('borderWidth') ?? this.props.borderWidth ?? '1px',
      '--clock-preframed-padding': this.getWidgetValue<string>('padding') ?? this.props.padding ?? '.75rem 1rem',
      ...this.props.style,
    } as CSSProperties;
  }

  private renderPreframed(content: ReactNode, analog = false, digitalPosition?: DigitalPosition) {
    const className = ['clock-preframed', analog ? 'clock-preframed--analog' : undefined, analog && digitalPosition ? `clock-preframed--digital-${digitalPosition}` : undefined, this.props.className].filter(Boolean).join(' ') || undefined;
    return <div className={className} style={this.getPreframedStyle()}>{content}</div>;
  }

  protected renderPlain() {
    const preset = this.getClockPreset();
    if (preset === 'analog-plain') return <AnalogClock time={this.state.time} styled={false} data={{ widget: 'clock', id: this.getWidgetId(), preset }} />;
    return <time data-widget="clock" data-widget-id={this.getWidgetId()} data-widget-preset={preset}>
      {formatTime(this.state.time, this.props.format ?? defaultFormat, this.props.showAmPm ?? true)}
    </time>;
  }

  private renderDigital(styled: boolean) {
    const className = styled ? this.props.className : undefined;
    const color = styled ? this.getWidgetValue<string>('color') ?? this.props.color ?? defaultColor : undefined;
    const style = styled ? {
      color,
      fontFamily: this.getWidgetValue<string>('fontFamily') ?? this.props.fontFamily,
      fontSize: this.getWidgetValue<string | number>('fontSize') ?? this.props.fontSize,
      fontWeight: this.getWidgetValue<string | number>('fontWeight') ?? this.props.fontWeight,
      letterSpacing: this.getWidgetValue<string | number>('letterSpacing') ?? this.props.letterSpacing,
      lineHeight: this.getWidgetValue<string | number>('lineHeight') ?? this.props.lineHeight,
      ...this.props.style,
    } : undefined;
    return <time data-widget="clock" data-widget-id={this.getWidgetId()} data-widget-preset={this.getClockPreset()} className={className} dateTime={this.state.time.toISOString()} style={style}>
      {formatTime(this.state.time, this.getFormat(), this.getShowAmPm())}
    </time>;
  }

  protected renderStyled() {
    const preset = this.getClockPreset();
    if (preset === 'analog-plain') return this.renderPlain();
    if (preset === 'analog-preframed' || preset === 'analog-digitalized-preframed') {
      const color = this.getWidgetValue<string>('analogColor') ?? this.props.analogColor ?? this.getWidgetValue<string>('color') ?? this.props.color;
      const size = this.getWidgetValue<string | number>('size') ?? this.props.size;
      const lineThickness = this.getWidgetValue<number>('lineThickness') ?? this.props.lineThickness ?? 1;
      const showSeconds = this.getWidgetValue<boolean>('showSeconds') ?? this.props.showSeconds ?? true;
      const digitalPosition = this.getWidgetValue<DigitalPosition>('digitalPosition') ?? this.props.digitalPosition ?? 'top';
      const content = <>
        <AnalogClock time={this.state.time} styled data={{ widget: 'clock', id: this.getWidgetId(), preset }} color={color} size={size} lineThickness={lineThickness} showSeconds={showSeconds} />
        {preset === 'analog-digitalized-preframed' && <span className="clock-analog__digital">{formatTime(this.state.time, this.getFormat(), this.getShowAmPm())}</span>}
      </>;
      return this.renderPreframed(content, true, digitalPosition);
    }
    return preset === 'preframed' ? this.renderPreframed(this.renderDigital(true)) : this.renderDigital(false);
  }

  render() {
    return this.isThemeOwnedPreset() ? this.renderPlain() : this.renderStyled();
  }
}
