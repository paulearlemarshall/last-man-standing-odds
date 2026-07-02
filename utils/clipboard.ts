const CLIPBOARD_TIMEOUT_MS = 1_000;

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Clipboard write timed out')), CLIPBOARD_TIMEOUT_MS)
        ),
      ]);
      return true;
    }
  } catch {
    // Fall through to the synchronous compatibility path.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
