type UnauthorizedHandler = () => void;

const unauthorizedHandlers = new Set<UnauthorizedHandler>();

export const subscribeToUnauthorized = (
  handler: UnauthorizedHandler,
): (() => void) => {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
};

export const notifyUnauthorized = () => {
  for (const handler of unauthorizedHandlers) {
    try {
      handler();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[authEvents] unauthorized handler failed", error);
    }
  }
};
