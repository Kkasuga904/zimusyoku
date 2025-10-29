import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyUnauthorized, subscribeToUnauthorized } from "./authEvents";

const subscriptions: Array<() => void> = [];

afterEach(() => {
  while (subscriptions.length > 0) {
    const unsubscribe = subscriptions.pop();
    if (unsubscribe) {
      unsubscribe();
    }
  }
});

describe("authEvents", () => {
  it("notifies subscribers and supports unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToUnauthorized(handler);
    subscriptions.push(unsubscribe);

    notifyUnauthorized();
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    notifyUnauthorized();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("logs errors but continues notifying other handlers", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const succeeding = vi.fn();

    const unsubscribeFailing = subscribeToUnauthorized(failing);
    const unsubscribeSucceeding = subscribeToUnauthorized(succeeding);
    subscriptions.push(unsubscribeFailing, unsubscribeSucceeding);

    notifyUnauthorized();

    expect(failing).toHaveBeenCalledTimes(1);
    expect(succeeding).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
