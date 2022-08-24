import { buildFinalizationRegistry } from './finalization-registry';

const forkSymbol = Symbol('fork');
const pendingResultsSymbol = Symbol('pendingResults');

export type ForkableIterator<T, TReturn = void> = Iterator<
  T,
  TReturn,
  never
> & {
  [forkSymbol](): ForkableIterator<T, TReturn>;
  [pendingResultsSymbol]: IteratorResult<T, TReturn>[];
};

export type ForkableAsyncIterator<T, TReturn = void> = AsyncIterator<
  T,
  TReturn,
  never
> & {
  [forkSymbol](): ForkableAsyncIterator<T, TReturn>;
  [pendingResultsSymbol]: Promise<IteratorResult<T, TReturn>>[];
};

type InternalResult<T, TReturn> =
  | IteratorResult<T, TReturn>
  | Promise<IteratorResult<T, TReturn>>;

type InternalIterator<T, TReturn> = {
  next: () => InternalResult<T, TReturn>;
  [forkSymbol](): InternalIterator<T, TReturn>;
  [pendingResultsSymbol]: InternalResult<T, TReturn>[];
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
 *
 * This supports both `Iterator` and `AsyncIterator`.
 */
export function buildForkableIterator<T, TReturn = void>(
  source: Iterator<T, TReturn>
): ForkableIterator<T, TReturn>;
export function buildForkableIterator<T, TReturn = void>(
  source: AsyncIterator<T, TReturn>
): ForkableAsyncIterator<T, TReturn>;
export function buildForkableIterator<T, TReturn = void>(
  source: Iterator<T, TReturn> | AsyncIterator<T, TReturn>
): ForkableIterator<T, TReturn> | ForkableAsyncIterator<T, TReturn> {
  const onResult: Set<(result: InternalResult<T, TReturn>) => void> = new Set();

  const registry = buildFinalizationRegistry<
    (result: InternalResult<T, TReturn>) => void
  >((onResultCallback) => {
    onResult.delete(onResultCallback);
  });

  const readSource = (): void => {
    const result = (source as Iterator<T, TReturn>).next();
    onResult.forEach((fn) => fn(result));
  };

  const makeFork = (
    initialPendingResults: InternalResult<T, TReturn>[]
  ): InternalIterator<T, TReturn> => {
    const iterator: InternalIterator<T, TReturn> = {
      [forkSymbol]() {
        return makeFork(this[pendingResultsSymbol]);
      },
      [pendingResultsSymbol]: initialPendingResults.slice(0),
      next(value?: never): InternalResult<T, TReturn> {
        if (value !== undefined) {
          throw new Error('`ForkableIterator` `next()` cannot take a value');
        }

        const pendingResults = this[pendingResultsSymbol];
        if (!pendingResults.length) {
          readSource();
        }
        return pendingResults.shift()!;
      },
    };

    const ref = new WeakRef(iterator);
    const callback = (result: InternalResult<T, TReturn>): void => {
      const maybeIterator = ref.deref();
      /* istanbul ignore next */
      maybeIterator?.[pendingResultsSymbol].push(result);
    };
    registry.register(iterator, callback);
    onResult.add(callback);

    return iterator;
  };

  return makeFork([]) as
    | ForkableIterator<T, TReturn>
    | ForkableAsyncIterator<T, TReturn>;
}

/**
 * Create a fork of the provided `ForkableIterator`/`ForkableAsyncIterator` at the current point.
 */
export function fork<
  T extends ForkableIterator<any, any> | ForkableAsyncIterator<any, any>
>(forkableIterator: T): T {
  if (!forkableIterator || !forkableIterator[forkSymbol]) {
    throw new Error(
      'The provided value was not a `ForkableIterator` from `buildForkableIterator()`'
    );
  }
  return forkableIterator[forkSymbol]() as T;
}
