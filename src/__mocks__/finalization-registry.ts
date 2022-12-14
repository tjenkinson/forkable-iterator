export let cleanupSpy: jest.Mock<any, any>;

export function buildFinalizationRegistry<T>(
  cleanupCallback: (heldValue: T) => void
): FinalizationRegistry<T> {
  cleanupSpy = jest.fn();
  const registry = new FinalizationRegistry<T>((...args) => {
    cleanupCallback(...args);
    cleanupSpy(args[0]);
  });
  return registry;
}
