import { describe, expect, it } from "vitest";
import { chooseWorkspace } from "./workspace-selection";

const options = [
  { id: "account-a", name: "Alpha" },
  { id: "account-b", name: "Bravo" },
];

describe("workspace selection", () => {
  it("keeps an available selection", () => {
    expect(chooseWorkspace(options, "account-b")).toEqual(options[1]);
  });

  it("falls back to the first available workspace", () => {
    expect(chooseWorkspace(options, "missing")).toEqual(options[0]);
    expect(chooseWorkspace([], "missing")).toBeUndefined();
  });
});
