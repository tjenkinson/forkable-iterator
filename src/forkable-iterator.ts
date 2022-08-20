import { buildFinalizationRegistry } from './finalization-registry';

const forkSymbol = Symbol('fork');
const pendingItemsSymbol = Symbol('pendingItems');

export type ForkableIterator<T, TReturn = void> = Iterator<
  T,
  TReturn,
  never
> & {
  [forkSymbol](): ForkableIterator<T, TReturn>;
  [pendingItemsSymbol]: IteratorResult<T, TReturn>[];
};

/**
 * Returns a `ForkableIterator` from the provided `source` iterator, which has the same
 * API as `Iterator`, but can be forked.
 *
 * To create a fork use the exported `fork(forkableIterator)` function.
 *
 * The source iterator must not be read from directly as any forks will miss the
 * values.
 *
 * The returned `ForkableIterator` will not implement `return()` or `throw()` functions.
 */
export function buildForkableIterator<T, TReturn = void>(
  source: Iterator<T, TReturn>
): ForkableIterator<T, TReturn> {
  const onResult: Set<(item: IteratorResult<T, TReturn>) => void> = new Set();

  const registry = buildFinalizationRegistry<
    (item: IteratorResult<T, TReturn>) => void
  >((onResultCallback) => {
    onResult.delete(onResultCallback);
  });

  const readSource = (): void => {
    const result = source.next();
    onResult.forEach((fn) => fn(result));
  };

  const makeFork = (
    initialPendingItems: IteratorResult<T, TReturn>[]
  ): ForkableIterator<T, TReturn> => {
    const iterator: ForkableIterator<T, TReturn> = {
      [forkSymbol]() {
        return makeFork(this[pendingItemsSymbol]);
      },
      [pendingItemsSymbol]: initialPendingItems.slice(0),
      next(value: never): IteratorResult<T, TReturn> {
        if (value !== undefined) {
          throw new Error('`ForkableIterator` `next()` cannot take a value');
        }

        const pendingItems = this[pendingItemsSymbol];
        if (!pendingItems.length) {
          readSource();
        }
        return pendingItems.shift()!;
      },
    };

    const ref = new WeakRef(iterator);
    const callback = (item: IteratorResult<T, TReturn>): void => {
      const maybeIterator = ref.deref();
      /* istanbul ignore next */
      maybeIterator?.[pendingItemsSymbol].push(item);
    };
    registry.register(iterator, callback);
    onResult.add(callback);

    return iterator;
  };

  return makeFork([]);
}

/**
 * Create a fork of the provided `ForkableIterator` at the current point.
 */
export function fork<T, TReturn>(
  forkableIterator: ForkableIterator<T, TReturn>
): ForkableIterator<T, TReturn> {
  if (!forkableIterator || !forkableIterator[forkSymbol]) {
    throw new Error(
      'The provided value was not a `ForkableIterator` from `buildForkableIterator()`'
    );
  }
  return forkableIterator[forkSymbol]();
}
