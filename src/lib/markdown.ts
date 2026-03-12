import MarkdownIt from "markdown-it";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import xssModule from "xss";

const { FilterXSS, getDefaultWhiteList } =
  xssModule as unknown as typeof import("xss");

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: false,
});

const xssFilter = new FilterXSS({
  whiteList: {
    ...getDefaultWhiteList(),
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    p: [],
    br: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    del: [],
    ul: [],
    ol: [],
    li: [],
    blockquote: [],
    pre: [],
    code: ["class"],
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title"],
    hr: [],
    table: [],
    thead: [],
    tbody: [],
    tr: [],
    th: [],
    td: [],
  },
  onTagAttr(tag: string, name: string, value: string) {
    if (tag === "a" && name === "href") {
      if (/^(?:https?:|mailto:)/i.test(value) || value.startsWith("/")) {
        return `href="${value}" target="_blank" rel="noopener noreferrer"`;
      }
      return "";
    }
    if (tag === "code" && name === "class") {
      if (/^language-[\w-]+$/.test(value)) {
        return `class="${value}"`;
      }
      return "";
    }
  },
  stripIgnoreTag: true,
});

export function renderMarkdown(source: string | null | undefined): string {
  if (!source || !source.trim()) return "";
  const rawHtml = md.render(source);
  return xssFilter.process(rawHtml);
}
