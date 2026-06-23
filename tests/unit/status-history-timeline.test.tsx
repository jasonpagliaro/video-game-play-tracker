import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusHistoryTimeline } from "@/components/backlog/status-history-timeline";
import type { GameStatusHistoryEntry } from "@/lib/backlog/types";

const history: GameStatusHistoryEntry[] = [
  {
    id: "status-2",
    previousStatus: "installed",
    newStatus: "in_progress",
    changedAt: new Date(2026, 0, 2, 10, 30),
    notes: "Started from detail page",
  },
  {
    id: "status-1",
    previousStatus: null,
    newStatus: "installed",
    changedAt: new Date(2026, 0, 1, 9, 15),
    notes: null,
  },
];

describe("StatusHistoryTimeline", () => {
  it("renders an empty state when no status history exists", () => {
    const html = renderToStaticMarkup(createElement(StatusHistoryTimeline, { history: [] }));

    expect(html).toContain("Status history");
    expect(html).toContain("No status changes recorded yet.");
  });

  it("renders recorded transitions, timestamps, and notes", () => {
    const html = renderToStaticMarkup(createElement(StatusHistoryTimeline, { history }));

    expect(html).toContain("Jan 2, 2026");
    expect(html).toContain("Installed");
    expect(html).toContain("In Progress");
    expect(html).toContain("Started from detail page");
  });

  it("renders null previous statuses as initial status sets", () => {
    const html = renderToStaticMarkup(createElement(StatusHistoryTimeline, { history }));

    expect(html).toContain("Set to");
    expect(html).toContain("Installed");
  });
});
