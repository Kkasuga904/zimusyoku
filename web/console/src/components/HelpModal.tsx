import { useEffect, useRef, type MouseEvent } from "react";
import type { Strings } from "../i18n/strings";

type HelpStrings = Strings["help"];

type HelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  strings: HelpStrings;
};

const focusableSelectors = [
  "a[href]",
  "button:not([disabled])",
  "textarea",
  "input[type='text']",
  "input[type='radio']",
  "input[type='checkbox']",
  "select",
  "[tabindex]:not([tabindex='-1'])",
];

const HelpModal = ({ isOpen, onClose, strings }: HelpModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) {
      return;
    }

    const dialog = dialogRef.current;
    const focusableElements = () =>
      dialog.querySelectorAll<HTMLElement>(focusableSelectors.join(", "));

    const focusFirstElement = () => {
      const first = focusableElements()[0];
      if (first) {
        first.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const nodes = focusableElements();
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }

      const [first, last] = [nodes[0], nodes[nodes.length - 1]];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || active === dialog) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    focusFirstElement();
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="modal-header">
          <h2 id="help-modal-title">{strings.title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={strings.close}
            onClick={onClose}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="modal-body">
          <p>{strings.intro}</p>
          <ul>
            {strings.featureList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>{strings.stepsTitle}</h3>
          <ol>
            {strings.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <h3>{strings.waitingTitle}</h3>
          <ul>
            {strings.waiting.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <h3>{strings.issuesTitle}</h3>
          <ul>
            {strings.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <h3>{strings.securityTitle}</h3>
          <ul>
            {strings.security.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>{strings.diagramTitle}</h3>
          <pre aria-label={strings.diagramTitle}>
            {strings.diagramLines.join("\n")}
          </pre>
        </div>
        <div className="modal-footer">
          <button type="button" className="primary-button" onClick={onClose}>
            {strings.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;

