import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  addQueuedGameToRotation: vi.fn(),
  applyQueueCommand: vi.fn(),
  bulkUpdateGames: vi.fn(),
  fillRotationFromQueue: vi.fn(),
  getGameVisibilitySnapshot: vi.fn(),
  markGameWontCompleteFromSuggestion: vi.fn(),
  parkGameForLater: vi.fn(),
  rebalanceUserQueue: vi.fn(),
  returnParkedGameToQueue: vi.fn(),
  setCurrentRotation: vi.fn(),
  setInstalled: vi.fn(),
  skipRotationSuggestion: vi.fn(),
  sortUserQueue: vi.fn(),
  updateGameFields: vi.fn(),
  updateGameStatus: vi.fn(),
}));
const cookieMocks = vi.hoisted(() => ({
  set: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieMocks),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "user@example.com", role: "authenticated" })),
}));

vi.mock("@/lib/db/repository", () => repositoryMocks);

import {
  queueCommandFeedbackAction,
  returnParkedGameToQueueFeedbackAction,
  sortQueueFeedbackAction,
} from "@/server/actions/game-actions";
import { ACTION_FEEDBACK_COOKIE, parseActionFeedback } from "@/lib/action-feedback";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("game action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms when a game is forced into Up next", async () => {
    await queueCommandFeedbackAction(formData({ gameId: "game-1", command: "force_next_in_queue" }));

    expect(repositoryMocks.applyQueueCommand).toHaveBeenCalledWith(
      { id: "user-1", email: "user@example.com", role: "authenticated" },
      { gameId: "game-1", command: "force_next_in_queue", targetGameId: undefined },
    );
    expect(cookieMocks.set).toHaveBeenCalledWith(
      ACTION_FEEDBACK_COOKIE,
      expect.any(String),
      expect.objectContaining({ maxAge: 30, path: "/", sameSite: "lax" }),
    );
    expect(parseActionFeedback(cookieMocks.set.mock.calls[0][1])).toMatchObject({
      status: "success",
      message: "Moved to Up next.",
    });
  });

  it("returns queue action errors for user-visible feedback", async () => {
    repositoryMocks.applyQueueCommand.mockRejectedValueOnce(new Error("Locked queue items cannot be moved."));

    await queueCommandFeedbackAction(formData({ gameId: "game-1", command: "promote" }));

    expect(parseActionFeedback(cookieMocks.set.mock.calls[0][1])).toMatchObject({
      status: "error",
      message: "Locked queue items cannot be moved.",
    });
  });

  it("confirms sort and return-to-queue actions", async () => {
    await sortQueueFeedbackAction(formData({ preset: "app_recommendation" }));
    await returnParkedGameToQueueFeedbackAction(formData({ gameId: "game-1" }));

    expect(repositoryMocks.sortUserQueue).toHaveBeenCalledWith(
      { id: "user-1", email: "user@example.com", role: "authenticated" },
      "app_recommendation",
    );
    expect(repositoryMocks.returnParkedGameToQueue).toHaveBeenCalledWith(
      { id: "user-1", email: "user@example.com", role: "authenticated" },
      "game-1",
    );
    expect(parseActionFeedback(cookieMocks.set.mock.calls[0][1])).toMatchObject({
      status: "success",
      message: "Queue sorted.",
    });
    expect(parseActionFeedback(cookieMocks.set.mock.calls[1][1])).toMatchObject({
      status: "success",
      message: "Returned to queue.",
    });
  });
});
