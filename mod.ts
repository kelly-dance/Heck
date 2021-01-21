import * as builtins from './builtins.ts';
import { Scope, Expression, ConstantExpression } from './language.ts';

const file = Deno.args[0];

const globalScope = new Scope();

Object.entries(builtins).forEach(([key, fn]) => {
  if(fn instanceof Expression) globalScope.set(key, fn, 'local');
});

globalScope.set('location', new ConstantExpression('.'), 'local');

// console.log('====EXECUTING====')

await builtins.loadingPromise;

const finalReturn = builtins.show.execute(
  globalScope,
  builtins.load.execute(globalScope, new ConstantExpression(file))
).getValue(globalScope);

// const finalReturn = builtins.show.execute(globalScope, program).getValue(globalScope);

console.log(`Program returned: ${finalReturn}`);
