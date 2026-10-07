/**
 * Tabs — ARIA tabs pattern with roving tabindex and arrow-key navigation.
 *
 * Markup contract:
 *   <div data-kit-tabs>
 *     <div class="kit-tabs__list" role="tablist">
 *       <button role="tab" aria-controls="p1" aria-selected="true">One</button>
 *       …
 *     </div>
 *     <div role="tabpanel" id="p1">…</div>
 *     …
 *   </div>
 */
const WIRED = 'data-kit-tabs-wired';

function tabsOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
}

function isRtl(container: HTMLElement): boolean {
  const dir =
    container.closest<HTMLElement>('[dir]')?.dir || document.documentElement.dir || 'ltr';
  return dir === 'rtl';
}

function selectTab(container: HTMLElement, active: HTMLElement): void {
  for (const tab of tabsOf(container)) {
    const selected = tab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) panel.hidden = !selected;
  }
}

function wireTabs(container: HTMLElement): void {
  if (container.hasAttribute(WIRED)) return;
  container.setAttribute(WIRED, '');

  const tabs = tabsOf(container);
  const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
  if (selected) selectTab(container, selected);

  container.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest<HTMLElement>('[role="tab"]');
    if (tab && container.contains(tab)) selectTab(container, tab);
  });

  container.addEventListener('keydown', (event) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const list = tabsOf(container).filter((tab) => !tab.hasAttribute('disabled'));
    if (list.length === 0) return;
    const current = document.activeElement;
    const index = list.findIndex((tab) => tab === current);
    let nextIndex: number;
    const forward = isRtl(container) ? -1 : 1;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = list.length - 1;
    else if (index === -1) nextIndex = 0;
    else nextIndex = (index + forward + list.length) % list.length;
    const next = list[nextIndex];
    if (!next) return;
    event.preventDefault();
    selectTab(container, next);
    next.focus();
  });
}

/** Wire every [data-kit-tabs] container under root. Safe to call repeatedly. */
export function initTabs(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-kit-tabs]').forEach(wireTabs);
}
