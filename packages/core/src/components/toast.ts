/**
 * Toast — imperative API:
 *   toast({ title, description, variant: 'info'|'success'|'warning'|'danger', duration })
 * Creates a fixed region (#kit-toasts) on first use.
 */
import { i18n } from '../i18n/index';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  /** Auto-dismiss delay in ms (0 = stay until closed). Default: 5000. */
  duration?: number;
}

const REGION_ID = 'kit-toasts';
const LEAVE_MS = 180;

function ensureRegion(): HTMLElement {
  let region = document.getElementById(REGION_ID);
  if (!region) {
    region = document.createElement('div');
    region.id = REGION_ID;
    region.className = 'kit-toast-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', i18n.t('toast.region'));
    document.body.appendChild(region);
  }
  return region;
}

function dismiss(toast: HTMLElement): void {
  if (toast.classList.contains('kit-toast--leaving')) return;
  toast.classList.add('kit-toast--leaving');
  window.setTimeout(() => toast.remove(), LEAVE_MS);
}

export function toast(options: ToastOptions = {}): void {
  const region = ensureRegion();
  const { title, description, variant = 'info', duration = 5000 } = options;

  const el = document.createElement('div');
  el.className = `kit-toast kit-toast--${variant}`;
  el.setAttribute('role', 'status');

  const content = document.createElement('div');
  content.className = 'kit-toast__content';
  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'kit-toast__title';
    titleEl.textContent = title;
    content.appendChild(titleEl);
  }
  if (description) {
    const descEl = document.createElement('div');
    descEl.className = 'kit-toast__desc';
    descEl.textContent = description;
    content.appendChild(descEl);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'kit-toast__close';
  close.setAttribute('aria-label', i18n.t('toast.dismiss'));
  close.textContent = '✕';
  close.addEventListener('click', () => dismiss(el));

  el.append(content, close);
  region.appendChild(el);

  if (duration > 0) {
    window.setTimeout(() => dismiss(el), duration);
  }
}
