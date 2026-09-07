/** `image` / `thumbnail` wikilinks to `![[...]]` embed strings for the markdown fill (shared by condition and monster). */
export function imageEmbeds(image: string | string[] | undefined): string[] {
  const values = image === undefined ? [] : Array.isArray(image) ? image : [image];
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => {
      if (value.startsWith("![[")) return value;
      return value.startsWith("[[") ? `!${value}` : `![[${value}]]`;
    });
}
