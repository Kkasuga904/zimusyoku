import { renderHook } from "@testing-library/react";
import { ja, useStrings } from "./strings";

describe("useStrings", () => {
  it("returns Japanese strings by default", () => {
    const { result } = renderHook(() => useStrings());

    expect(result.current.nav.help).toBe(ja.nav.help);
    expect(result.current.jobs.statusLabels.Queued).toBe(
      ja.jobs.statusLabels.Queued,
    );
  });
});

