/**
 * Dialog behavior — built on native <dialog> so focus trap, Esc and
 * focus restoration come from the platform.
 *
 * Markup contract:
 *   <button data-kit-open="confirm">Open</button>
 *   <dialog class="kit-dialog" id="confirm">…</dialog>
 *   Inside the dialog: any [data-kit-close] closes it.
 */
function findDialog(id: string | null): HTMLDialogElement | null {
  if (!id) return null;
  const el = document.getElementById(id);
  if (el instanceof HTMLDialogElement) return el;
  const nested = el?.querySelector('dialog');
  return nested instanceof HTMLDialogElement ? nested : null;
}

let initialized = false;

export function initDialogs(doc: Document = document): void {
  if (initialized) return;
  initialized = true;

  doc.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const opener = target.closest<HTMLElement>('[data-kit-open]');
    if (opener) {
      const dialog = findDialog(opener.getAttribute('data-kit-open'));
      if (dialog && !dialog.open) dialog.showModal();
      return;
    }

    const closer = target.closest<HTMLElement>('[data-kit-close]');
    if (closer) {
      const dialog = closer.closest('dialog');
      if (dialog?.open) dialog.close();
      return;
    }

    // Click on the backdrop (event target is the dialog element itself).
    const clicked = target;
    if (clicked instanceof HTMLDialogElement && clicked.open && event.target === clicked) {
      clicked.close();
    }
  });
}
