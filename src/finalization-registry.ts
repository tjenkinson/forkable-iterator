// here so that can be mocked out for testing

export function buildFinalizationRegistry<T>(
  cleanupCallback: (heldValue: T) => void
): FinalizationRegistry<T> {
  return new FinalizationRegistry(cleanupCallback);
}
