jest.mock('./finalization-registry');
import {
  buildForkableIterator,
  ForkableIterator,
  fork,
} from './forkable-iterator';
// @ts-ignore
import { cleanupSpy } from './finalization-registry';

if (!globalThis.gc) {
  throw new Error('node --expose-gc flag required');
}

const gc: () => void = globalThis.gc;

describe('ForkableIterator', () => {
  let iterator: ForkableIterator<number, string>;
  beforeEach(() => {
    iterator = buildForkableIterator(
      (function* () {
        yield 1;
        yield 2;
        yield 3;
        return 'return';
      })()
    );
  });

  it('yields the correct items', () => {
    const child1 = fork(iterator);
    expect(child1.next()).toStrictEqual({ value: 1, done: false });
    expect(child1.next()).toStrictEqual({ value: 2, done: false });

    expect(iterator.next()).toStrictEqual({ value: 1, done: false });

    const child2 = fork(iterator);
    expect(iterator.next()).toStrictEqual({ value: 2, done: false });

    expect(child2.next()).toStrictEqual({ value: 2, done: false });

    expect(iterator.next()).toStrictEqual({ value: 3, done: false });
    expect(iterator.next()).toStrictEqual({ value: 'return', done: true });
    expect(iterator.next()).toStrictEqual({ value: undefined, done: true });

    expect(child1.next()).toStrictEqual({ value: 3, done: false });
    expect(child1.next()).toStrictEqual({ value: 'return', done: true });
    expect(child1.next()).toStrictEqual({ value: undefined, done: true });

    expect(child2.next()).toStrictEqual({ value: 3, done: false });
    expect(child2.next()).toStrictEqual({ value: 'return', done: true });
    expect(child2.next()).toStrictEqual({ value: undefined, done: true });
  });

  it('gcs a fork when it is no longer referenced', async () => {
    const child1 = fork(iterator);
    child1.next();

    const child2 = new WeakRef(fork(iterator));

    await new Promise((resolve) => setTimeout(resolve, 0));
    gc();

    return new Promise<void>((resolve) => {
      cleanupSpy.mockImplementation(() => {
        expect(child2.deref()).toBe(undefined);
        resolve();
      });
    });
  });

  it('throws an error if `next()` is given a value', () => {
    const child = fork(iterator);
    // @ts-expect-error
    expect(() => child.next('something')).toThrowError(
      '`ForkableIterator` `next()` cannot take a value'
    );
  });

  it('throws an error if `fork()` is given something that is not a `ForkableIterator`', () => {
    const error =
      'The provided value was not a `ForkableIterator` from `buildForkableIterator()`';

    [undefined, null, 1, 'test', [].values()].forEach((value) => {
      // @ts-expect-error
      expect(() => fork(value)).toThrowError(error);
    });
  });
});
