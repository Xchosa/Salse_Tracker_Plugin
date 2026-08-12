import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const stylesheet = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe("Client Kanban styles", () => {
  it("gives an empty scoped card list a touch-sized drop area", () => {
    const style = document.createElement("style");
    style.textContent = stylesheet;
    document.head.append(style);
    const view = document.createElement("div");
    view.className = "client-kanban-view";
    const list = document.createElement("div");
    list.className = "client-kanban-card-list";
    view.append(list);
    document.body.append(view);

    const computed = getComputedStyle(list);
    expect(computed.minHeight).toBe("5rem");
    expect(computed.paddingTop).toBe("0.25rem");
    expect(computed.paddingRight).toBe("0.25rem");
    expect(computed.paddingBottom).toBe("0.25rem");
    expect(computed.paddingLeft).toBe("0.25rem");
  });
});
