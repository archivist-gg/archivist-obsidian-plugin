import { setIcon } from "obsidian";

/**
 * Enhance fenced code blocks inside the given container with a language label
 * and a one-click copy button.  Already-enhanced blocks (identified by the
 * `.archivist-code-enhanced` class on the `<pre>`) are skipped so the function
 * is safe to call repeatedly on the same container.
 */
export function enhanceCodeBlocks(container: HTMLElement): void {
  const codeEls = container.querySelectorAll("pre > code");

  for (const codeEl of Array.from(codeEls)) {
    const pre = codeEl.parentElement as HTMLPreElement;
    if (!pre || pre.classList.contains("archivist-code-enhanced")) continue;

    // Extract language from class list (e.g. "language-python" -> "python")
    let language = "Code";
    const langClass = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
    if (langClass) {
      language = langClass.replace("language-", "");
    }

    pre.classList.add("archivist-code-enhanced");

    // Build wrapper that will contain header + pre
    const wrapper = document.createElement("div");
    wrapper.className = "archivist-inquiry-code-wrapper";

    // Header row: language label + copy button
    const header = document.createElement("div");
    header.className = "archivist-inquiry-code-header";

    const langLabel = document.createElement("span");
    langLabel.className = "archivist-inquiry-code-lang";
    langLabel.textContent = language;
    header.appendChild(langLabel);

    const copyBtn = document.createElement("span");
    copyBtn.className = "archivist-inquiry-code-copy";
    setIcon(copyBtn, "copy");
    const copyLabel = document.createElement("span");
    copyLabel.textContent = "Copy";
    copyBtn.appendChild(copyLabel);
    header.appendChild(copyBtn);

    // Copy handler
    copyBtn.addEventListener("click", () => {
      const text = codeEl.textContent ?? "";
      void navigator.clipboard.writeText(text);
      copyBtn.empty();
      setIcon(copyBtn, "check");
      const copiedLabel = document.createElement("span");
      copiedLabel.textContent = "Copied";
      copyBtn.appendChild(copiedLabel);
      setTimeout(() => {
        copyBtn.empty();
        setIcon(copyBtn, "copy");
        const resetLabel = document.createElement("span");
        resetLabel.textContent = "Copy";
        copyBtn.appendChild(resetLabel);
      }, 2000);
    });

    // Insert wrapper into the DOM in place of pre, then move header + pre inside
    pre.parentNode!.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  }
}
