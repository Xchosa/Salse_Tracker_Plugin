export class Plugin {}

export class PluginSettingTab {}

export class ItemView {}

export class Notice {}

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
