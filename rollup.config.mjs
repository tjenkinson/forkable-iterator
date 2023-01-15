import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/forkable-iterator.ts',
  plugins: [typescript(), resolve(), commonjs()],
  onwarn: (e) => {
    throw new Error(e);
  },
  output: [
    {
      name: 'ForkableIterator',
      file: 'dist/forkable-iterator.js',
      format: 'umd',
    },
    {
      file: 'dist/forkable-iterator.es.js',
      format: 'es',
    },
  ],
};
