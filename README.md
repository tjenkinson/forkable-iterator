# forkable-iterator

Make a JS [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators#iterators) forkable.

Be aware that if you have a fork that is not consuming values as it gets further and further behind more memory will be used. Make sure you `null` out references to forks that you no longer need to allow garbage collection to occur.

## Installation

```sh
npm install --save forkable-iterator
```

Also available on JSDelivr at "https://cdn.jsdelivr.net/npm/forkable-iterator@1".

## Usage

```ts
import { buildForkableIterator, fork } from 'forkable-iterator';

function* Source() {
  yield 1;
  yield 2;
  return 'return';
}

const forkableIterator = buildForkableIterator(source());

console.log(forkableIterator.next()); // { value: 1, done: false }

const child1 = fork(forkableIterator);
// { value: 2, done: false }
console.log(child1.next());
// { value: 2, done: false }
console.log(forkableIterator.next());

// { value: 'return', done: true }
console.log(child1.next());
// { value: 'return', done: true }
console.log(forkableIterator.next());
```

## API

### `buildForkableIterator(source)`

Returns a `ForkableIterator` from the provided `source` iterator, which has the same API as `Iterator`, but can be forked.

To create a fork use the exported [`fork(forkableIterator)`](#forkforkableiterator) function.

The source iterator must not be read from directly as any forks will miss the values.

The returned `ForkableIterator` will not implement `return()` or `throw()` functions.

### `fork(forkableIterator)`

Create a fork of the provided `ForkableIterator` at the current point.
