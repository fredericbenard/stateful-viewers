/**
 * True when the app is running on Hugging Face Spaces (e.g. *.hf.space).
 * Used to hide Ollama (not available on HF) and similar host-specific behavior.
 */
export function isHfSpace(): boolean {
  if (typeof window === 'undefined') return false;
  return /\.hf\.space$/i.test(window.location.hostname);
}
