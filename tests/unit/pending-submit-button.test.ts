import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const formStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({
      pending: formStatus.pending,
      data: null,
      method: null,
      action: null,
    }),
  };
});

import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

describe("PendingSubmitButton", () => {
  it("renders the normal submit label when the parent form is idle", () => {
    formStatus.pending = false;

    const html = renderToStaticMarkup(
      createElement(PendingSubmitButton, { pendingLabel: "Adding..." }, "Add to rotation"),
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain("Add to rotation");
    expect(html).not.toContain("Adding...");
    expect(html).not.toContain(" disabled=");
    expect(html).not.toContain('aria-busy="true"');
  });

  it("disables the button and swaps to the pending label while submitting", () => {
    formStatus.pending = true;

    const html = renderToStaticMarkup(
      createElement(PendingSubmitButton, { pendingLabel: "Adding..." }, "Add to rotation"),
    );

    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Adding...");
    expect(html).not.toContain("Add to rotation");
    expect(html).toContain("animate-spin");
  });
});
