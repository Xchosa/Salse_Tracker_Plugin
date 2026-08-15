export class Component {
  register(_callback: () => unknown): void {}
  registerEvent(_eventRef: unknown): void {}
}

export class Plugin extends Component {
  app: unknown;
  manifest: unknown;

  constructor(app: unknown, manifest: unknown) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(_command: unknown): unknown {
    return _command;
  }

  registerView(_type: string, _creator: (leaf: unknown) => unknown): void {}
}

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

export class ItemView extends Component {
  app: unknown;
  contentEl: HTMLElement;

  constructor(public leaf: unknown) {
    super();
    this.contentEl = decorateElement(document.createElement("div"));
  }
}

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}

export function setIcon(element: HTMLElement, icon: string): void {
  element.dataset.icon = icon;
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
