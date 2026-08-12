export class Plugin {}

export class PluginSettingTab {}

type CreateOptions = {
  cls?: string;
  text?: string;
  attr?: Record<string, string>;
};

function decorateElement<T extends HTMLElement>(element: T): T {
  Object.assign(element, {
    createDiv(options: CreateOptions = {}) {
      return appendElement(element, "div", options);
    },
    createEl(tag: string, options: CreateOptions = {}) {
      return appendElement(element, tag, options);
    },
    empty() {
      element.replaceChildren();
    }
  });
  return element;
}

function appendElement(parent: HTMLElement, tag: string, options: CreateOptions): HTMLElement {
  const element = decorateElement(document.createElement(tag));
  if (options.cls) element.className = options.cls;
  if (options.text !== undefined) element.textContent = options.text;
  for (const [name, value] of Object.entries(options.attr ?? {})) element.setAttribute(name, value);
  parent.appendChild(element);
  return element;
}

export class ItemView {
  app: unknown;
  contentEl: HTMLElement;

  constructor(public leaf: unknown) {
    this.contentEl = decorateElement(document.createElement("div"));
  }
}

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}

const notices: string[] = [];

export function recordedNotices(): string[] {
  return notices;
}

export function clearNotices(): void {
  notices.length = 0;
}

export class TAbstractFile {
  path: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").at(-1) ?? path;
  }
}

export class TFile extends TAbstractFile {
  extension: string;
  basename: string;

  constructor(path: string) {
    super(path);
    const extensionStart = this.name.lastIndexOf(".");
    this.extension = extensionStart === -1 ? "" : this.name.slice(extensionStart + 1);
    this.basename = extensionStart === -1 ? this.name : this.name.slice(0, extensionStart);
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[];

  constructor(path: string, children: TAbstractFile[] = []) {
    super(path);
    this.children = children;
  }
}
