export const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Marks the report's own words. The color only repeats the word. */
export function highlight(text: string): string {
  return escape(text)
    .replace(/^(\d+\. )(PROBLEM)/gm, '$1<span class="v-bad">$2</span>')
    .replace(/^(\d+\. )(COULD NOT CHECK)/gm, '$1<span class="v-warn">$2</span>')
    .replace(/^(OPEN FINDINGS|NOT CHECKED)(?=:)/gm, '<span class="v-warn">$1</span>')
    .replace(/^CHECKED CLEAN(?=:)/gm, '<span class="v-ok">CHECKED CLEAN</span>')
    .replace(/^\$ .*$/gm, '<span class="cmd">$&</span>')
    .replace(/^\[exit \d+\]$/gm, '<span class="dim">$&</span>');
}

/** A text excerpt of real command output. `caption` is trusted HTML. */
export const excerpt = (caption: string, text: string): string =>
  `<figure class="excerpt"><figcaption>${caption}</figcaption><pre tabindex="0">${highlight(text.replace(/\n+$/, ""))}</pre></figure>`;
