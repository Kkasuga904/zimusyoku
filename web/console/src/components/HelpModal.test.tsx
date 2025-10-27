import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ja as strings } from "../i18n/strings";
import HelpModal from "./HelpModal";

describe("HelpModal", () => {
  it("focuses the close button when opened and closes on Escape", () => {
    const handleClose = vi.fn();

    render(<HelpModal isOpen onClose={handleClose} strings={strings.help} />);

    const [closeButton] = screen.getAllByRole("button", {
      name: strings.help.close,
    });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", () => {
    const handleClose = vi.fn();

    render(<HelpModal isOpen onClose={handleClose} strings={strings.help} />);

    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(handleClose).toHaveBeenCalled();
  });
});
