export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const settingsBasePath = '/api/settings';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${settingsBasePath}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (!response.ok) throw new Error(`Settings request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const encoded = (value: string) => encodeURIComponent(value);

export const getAppSettings = () => request<Record<string, JsonValue>>('/app');
export const getAppSetting = <T extends JsonValue>(key: string) => request<T>(`/app/${encoded(key)}`);
export const setAppSetting = (key: string, value: JsonValue) =>
  request<JsonValue>(`/app/${encoded(key)}`, { method: 'PUT', body: JSON.stringify(value) });
export const deleteAppSetting = (key: string) =>
  request<void>(`/app/${encoded(key)}`, { method: 'DELETE' });

export const getThemeSettings = (themeId: string) => request<Record<string, JsonValue>>(`/themes/${encoded(themeId)}`);
export const getThemeSetting = <T extends JsonValue>(themeId: string, key: string) =>
  request<T>(`/themes/${encoded(themeId)}/${encoded(key)}`);
export const setThemeSetting = (themeId: string, key: string, value: JsonValue) =>
  request<JsonValue>(`/themes/${encoded(themeId)}/${encoded(key)}`, { method: 'PUT', body: JSON.stringify(value) });
export const deleteThemeSetting = (themeId: string, key: string) =>
  request<void>(`/themes/${encoded(themeId)}/${encoded(key)}`, { method: 'DELETE' });

export const getWidgetSettings = (widgetId: string) => request<Record<string, JsonValue>>(`/widgets/${encoded(widgetId)}`);
export const getWidgetSetting = <T extends JsonValue>(widgetId: string, key: string) =>
  request<T>(`/widgets/${encoded(widgetId)}/${encoded(key)}`);
export const setWidgetSetting = (widgetId: string, key: string, value: JsonValue) =>
  request<JsonValue>(`/widgets/${encoded(widgetId)}/${encoded(key)}`, { method: 'PUT', body: JSON.stringify(value) });
export const deleteWidgetSetting = (widgetId: string, key: string) =>
  request<void>(`/widgets/${encoded(widgetId)}/${encoded(key)}`, { method: 'DELETE' });
