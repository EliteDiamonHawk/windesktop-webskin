import { Component, type ReactNode } from 'react';
import { getThemeInstanceSettings, setThemeInstanceSetting, type JsonValue } from '../api/settings';
import './widgets.css';

export type WidgetProps = {
  /** Stable within a theme; used to load this widget instance's settings. */
  id?: string;
  /** Optional for widgets that only use theme-provided props. */
  themeId?: string;
  /** The widget's presentation preset. */
  preset?: string;
};

export type WidgetSettingType = 'string' | 'number' | 'boolean' | 'color' | 'select';

export type WidgetSettingOption = {
  label: string;
  value: string | number | boolean;
};

export type WidgetSetting = {
  key: string;
  label: string;
  type: WidgetSettingType;
  defaultValue?: JsonValue;
  description?: string;
  options?: readonly WidgetSettingOption[];
};

type WidgetSettings = Record<string, JsonValue>;

type WidgetSettingsState = {
  persistedSettings: WidgetSettings;
  runtimeOverrides: WidgetSettings;
};

export type SetWidgetValueOptions = {
  persist?: boolean;
};

const pollingIntervalMs = 2000;
let generatedWidgetId = 0;

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
};

/** Base class for every renderable widget. */
export abstract class Widget<Props extends WidgetProps = WidgetProps, State extends object = Record<string, never>>
  extends Component<Props, State & WidgetSettingsState> {
  private pollingTimer?: number;
  private refreshController?: AbortController;
  private refreshInFlight = false;
  private disposed = false;
  private readonly generatedId = `widget-${++generatedWidgetId}`;

  state = {
    persistedSettings: {},
    runtimeOverrides: {},
  } as State & WidgetSettingsState;

  componentDidMount() {
    if (this.shouldLoadWidgetSettings()) void this.refreshWidgetSettings();
    if (this.shouldLoadWidgetSettings()) {
      this.pollingTimer = window.setInterval(() => void this.refreshWidgetSettings(), pollingIntervalMs);
    }
  }

  componentDidUpdate(previousProps: Readonly<Props>) {
    if (previousProps.themeId !== this.props.themeId || previousProps.id !== this.props.id) {
      void this.refreshWidgetSettings();
    }
  }

  componentWillUnmount() {
    this.disposed = true;
    if (this.pollingTimer !== undefined) window.clearInterval(this.pollingTimer);
    this.refreshController?.abort();
  }

  /** Returns settings for the requested preset. Styled is the default preset. */
  getWidgetSettings(preset: string = this.props.preset ?? 'styled'): readonly WidgetSetting[] {
    return preset === 'plain' ? this.getPlainWidgetSettings() : this.getStyledWidgetSettings();
  }

  /** Compatibility-friendly name for callers discovering widget settings. */
  getAvailableSettings(preset: string = this.props.preset ?? 'styled'): readonly WidgetSetting[] {
    return this.getWidgetSettings(preset);
  }

  getWidgetValue<T extends JsonValue>(key: string, preset: string = this.props.preset ?? 'styled'): T | undefined {
    const settings = this.getWidgetSettings(preset);
    if (!settings.some((setting) => setting.key === key)) return undefined;

    const defaults = settings.find((setting) => setting.key === key)?.defaultValue;
    const propValue = this.props[key as keyof Props];
    const values: WidgetSettings = {
      ...(defaults === undefined ? {} : { [key]: defaults }),
      ...(isJsonValue(propValue) ? { [key]: propValue } : {}),
      ...this.state.persistedSettings,
      ...this.state.runtimeOverrides,
    };
    return values[key] as T | undefined;
  }

  getWidgetId() {
    return this.props.id ?? this.generatedId;
  }

  private patchWidgetState(
    patch: Partial<WidgetSettingsState> | ((current: Readonly<WidgetSettingsState>) => Partial<WidgetSettingsState>),
  ) {
    if (typeof patch === 'function') {
      this.setState((current) => patch(current) as State & WidgetSettingsState);
    } else {
      this.setState(patch as State & WidgetSettingsState);
    }
  }

  async setWidgetValue(key: string, value: JsonValue, options: SetWidgetValueOptions = {}): Promise<void> {
    const validKey = this.getWidgetSettings().some((setting) => setting.key === key);
    if (!validKey) throw new Error(`Unknown widget setting: ${key}`);

    this.patchWidgetState((current) => ({
      runtimeOverrides: { ...current.runtimeOverrides, [key]: value },
    }));

    if (options.persist && this.props.themeId && this.props.id) {
      await setThemeInstanceSetting(this.props.themeId, this.props.id, key, value);
      if (!this.disposed) {
        this.patchWidgetState((current) => ({
          persistedSettings: { ...current.persistedSettings, [key]: value },
          runtimeOverrides: Object.fromEntries(
            Object.entries(current.runtimeOverrides).filter(([settingKey]) => settingKey !== key),
          ),
        }));
      }
    }
  }

  resetWidgetValue(key: string) {
    this.patchWidgetState((current) => ({
      runtimeOverrides: Object.fromEntries(
        Object.entries(current.runtimeOverrides).filter(([settingKey]) => settingKey !== key),
      ),
    }));
  }

  protected async refreshWidgetSettings() {
    const { themeId } = this.props;
    if (!themeId || !this.props.id || !this.shouldLoadWidgetSettings() || this.refreshInFlight || this.disposed) return;
    this.refreshInFlight = true;
    this.refreshController?.abort();
    this.refreshController = new AbortController();

    try {
      const settings = await getThemeInstanceSettings(themeId, this.props.id, this.refreshController.signal);
      if (!this.disposed) this.patchWidgetState({ persistedSettings: settings });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        // Settings are optional; retain the last valid values and retry on the next poll.
        console.warn(`Could not load settings for widget ${this.getWidgetId()}`, error);
      }
    } finally {
      this.refreshInFlight = false;
    }
  }

  protected getPlainWidgetSettings(): readonly WidgetSetting[] {
    return [];
  }

  protected shouldLoadWidgetSettings() {
    return Boolean(this.props.themeId && this.getWidgetSettings().length > 0);
  }

  protected getStyledWidgetSettings(): readonly WidgetSetting[] {
    return this.getPlainWidgetSettings();
  }

  protected abstract renderPlain(): ReactNode;

  /** Widgets without a styled implementation automatically use their plain renderer. */
  protected renderStyled(): ReactNode {
    return this.renderPlain();
  }

  render() {
    return (this.props.preset ?? 'styled') === 'plain' ? this.renderPlain() : this.renderStyled();
  }
}
