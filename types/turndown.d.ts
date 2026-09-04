declare module "turndown" {
  export interface Options {
    headingStyle?: "setext" | "atx";
    hr?: string;
    bulletListMarker?: "-" | "_" | "*";
    codeBlockStyle?: "indented" | "fenced";
    fence?: "```" | "~~~";
    emDelimiter?: "_" | "*";
    strongDelimiter?: "**" | "__";
    linkStyle?: "inlined" | "referenced";
    linkReferenceStyle?: "full" | "collapsed" | "shortcut";
    preformattedCode?: boolean;
  }

  export type Filter =
    | string
    | string[]
    | ((node: HTMLElement, options: Options) => boolean);

  export interface Rule {
    filter: Filter;
    replacement: (
      content: string,
      node: HTMLElement,
      options: Options
    ) => string;
  }

  export default class TurndownService {
    constructor(options?: Options);
    turndown(html: string | HTMLElement): string;
    remove(filter: Filter): this;
    keep(filter: Filter): this;
    addRule(key: string, rule: Rule): this;
  }
}
