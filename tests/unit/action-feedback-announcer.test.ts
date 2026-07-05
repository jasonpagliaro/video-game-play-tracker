import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionFeedbackAnnouncer } from "@/components/ui/action-feedback-announcer";

describe("ActionFeedbackAnnouncer", () => {
  it("renders a visible status panel for action feedback", () => {
    const html = renderToStaticMarkup(
      createElement(ActionFeedbackAnnouncer, {
        feedback: {
          id: "feedback-1",
          status: "success",
          message: "Moved to Up next.",
        },
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Moved to Up next.");
    expect(html).toContain("action-feedback-dismiss");
  });

  it("renders nothing when there is no feedback", () => {
    const html = renderToStaticMarkup(createElement(ActionFeedbackAnnouncer, { feedback: null }));

    expect(html).toBe("");
  });
});
