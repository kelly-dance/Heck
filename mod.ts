import * as builtins from './builtins.ts';
import { Scope, Expression } from './language.ts';
import { parse } from './parsing.ts';

const file = Deno.args[0];
const code = new TextDecoder().decode(Deno.readFileSync(file));

const [program] = parse(code);
if(!program) throw new Error('Failed to parse Program')
// console.log(Deno.inspect(program, { depth: 1000, colors: true }));

const globalScope = new Scope();

Object.entries(builtins).forEach(([key, fn]) => globalScope.set(key, fn as Expression, 'local'));

// console.log('====EXECUTING====')

const finalReturn = builtins.show.execute(globalScope, program).getValue(globalScope);

console.log(`Program returned: ${finalReturn}`);
