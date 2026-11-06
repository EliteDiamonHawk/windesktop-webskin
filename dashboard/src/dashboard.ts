import './dashboard.css';

type Theme = {
  id: string;
  name: string;
  entry_url: string;
  preview?: string | null;
};

const search = document.querySelector<HTMLInputElement>('[data-theme-search]');
const count = document.querySelector<HTMLElement>('[data-theme-count]');
const status = document.querySelector<HTMLElement>('[data-theme-status]');
const grid = document.querySelector<HTMLElement>('[data-theme-grid]');

let themes: Theme[] = [];
let loadState: 'loading' | 'ready' | 'error' = 'loading';

const isTheme = (value: unknown): value is Theme => {
  if (!value || typeof value !== 'object') return false;
  const theme = value as Record<string, unknown>;
  return (
    typeof theme.id === 'string' &&
    typeof theme.name === 'string' &&
    Boolean(theme.name.trim()) &&
    typeof theme.entry_url === 'string' &&
    (theme.preview === undefined || theme.preview === null || typeof theme.preview === 'string')
  );
};

const getPreviewUrl = (source: string) => {
  try {
    return new URL(source, window.location.href).href;
  } catch {
    return source;
  }
};

const setStatus = (message: string, visible: boolean) => {
  if (!status) return;
  status.textContent = message;
  status.hidden = !visible;
};

const createThemeCard = (theme: Theme) => {
  const card = document.createElement('article');
  card.className = 'theme-card';

  const link = document.createElement('a');
  link.className = 'theme-card-link';
  link.href = theme.entry_url;
  link.setAttribute('aria-label', `Open ${theme.name} theme`);

  const preview = document.createElement('span');
  preview.className = 'theme-preview';

  if (theme.preview) {
    preview.classList.add('has-image');
    const image = document.createElement('img');
    image.src = getPreviewUrl(theme.preview);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.remove();
      preview.classList.remove('has-image');
    }, { once: true });
    preview.append(image);
  }

  const footer = document.createElement('span');
  footer.className = 'theme-card-footer';

  const name = document.createElement('span');
  name.className = 'theme-name';
  name.textContent = theme.name;

  const arrow = document.createElement('span');
  arrow.className = 'card-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';

  footer.append(name, arrow);
  link.append(preview, footer);
  card.append(link);
  return card;
};

const render = () => {
  if (!grid || !count) return;

  const query = search?.value.trim().toLowerCase() ?? '';
  const visibleThemes = themes.filter((theme) => theme.name.toLowerCase().includes(query));
  count.textContent = `${visibleThemes.length} ${visibleThemes.length === 1 ? 'theme' : 'themes'}`;
  grid.replaceChildren(...visibleThemes.map(createThemeCard));

  if (loadState === 'loading') {
    grid.hidden = true;
    setStatus('Loading themes…', true);
    return;
  }

  if (loadState === 'error') {
    grid.hidden = true;
    setStatus('Themes are unavailable right now.', true);
    return;
  }

  if (visibleThemes.length === 0) {
    grid.hidden = true;
    setStatus(query ? 'No themes match your search.' : 'No themes found.', true);
    return;
  }

  grid.hidden = false;
  setStatus('', false);
};

const loadThemes = async () => {
  try {
    const response = await fetch('/api/themes', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Theme request failed: ${response.status}`);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Theme response was not an array');

    themes = payload.filter(isTheme);
    loadState = 'ready';
  } catch (error) {
    console.error('Could not load themes', error);
    themes = [];
    loadState = 'error';
  }
  render();
};

search?.addEventListener('input', render);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== search) {
    event.preventDefault();
    search?.focus();
  }
});

render();
void loadThemes();
