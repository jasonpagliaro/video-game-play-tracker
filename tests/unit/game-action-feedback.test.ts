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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "user@example.com", role: "authenticated" })),
}));

vi.mock("@/lib/db/repository", () => repositoryMocks);

import {
  queueCommandFeedbackAction,
  returnParkedGameToQueueFeedbackAction,
  sortQueueFeedbackAction,
  type ActionFeedbackState,
} from "@/server/actions/game-actions";

const idleState: ActionFeedbackState = {
  status: "idle",
  message: null,
  submittedAt: 0,
};

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
    const result = await queueCommandFeedbackAction(
      idleState,
      formData({ gameId: "game-1", command: "force_next_in_queue" }),
    );

    expect(repositoryMocks.applyQueueCommand).toHaveBeenCalledWith(
      { id: "user-1", email: "user@example.com", role: "authenticated" },
      { gameId: "game-1", command: "force_next_in_queue", targetGameId: undefined },
    );
    expect(result.status).toBe("success");
    expect(result.message).toBe("Moved to Up next.");
    expect(result.submittedAt).toBeGreaterThan(0);
  });

  it("returns queue action errors for user-visible feedback", async () => {
    repositoryMocks.applyQueueCommand.mockRejectedValueOnce(new Error("Locked queue items cannot be moved."));

    const result = await queueCommandFeedbackAction(
      idleState,
      formData({ gameId: "game-1", command: "promote" }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("Locked queue items cannot be moved.");
  });

  it("confirms sort and return-to-queue actions", async () => {
    const sorted = await sortQueueFeedbackAction(idleState, formData({ preset: "app_recommendation" }));
    const returned = await returnParkedGameToQueueFeedbackAction(idleState, formData({ gameId: "game-1" }));

    expect(repositoryMocks.sortUserQueue).toHaveBeenCalledWith(
      { id: "user-1", email: "user@example.com", role: "authenticated" },
      "app_recommendation",
    );
    expect(repositoryMocks.returnParkedGameToQueue).toHaveBeenCalledWith(
      { id: "user-1", email: "user@example.com", role: "authenticated" },
      "game-1",
    );
    expect(sorted).toMatchObject({ status: "success", message: "Queue sorted." });
    expect(returned).toMatchObject({ status: "success", message: "Returned to queue." });
  });
});
