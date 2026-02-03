/**
 * Web Share API: share text/URL or file. Falls back to copy or open share URL.
 */
export async function canShare() {
  return typeof navigator !== 'undefined' && navigator.share != null;
}

export async function shareReport(options) {
  const { title = 'Field Report', text, url } = options;
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: text || '',
        url: url || window.location.href
      });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      throw e;
    }
  }
  if (url && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  }
  return false;
}

export async function shareFile(file, title = 'Report') {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title,
      files: [file]
    });
    return true;
  }
  return false;
}
