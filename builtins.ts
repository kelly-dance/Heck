import * as path from "https://deno.land/std@0.83.0/path/mod.ts";
import { BuiltInFnExpression, ConstantExpression, Callable, Expression, Scope, ArrayValue, FunctionValue, ReferenceExpression, FunctionCall, CodeBlockDeclaration } from './language.ts';
import { Parser } from "./parsing.ts";

export const show = new BuiltInFnExpression((scope, args): ConstantExpression<string> => {
  const internal = (e: Expression, depth: number): string => {
    const val = e.getValue(scope);
    if(Array.isArray(val)) {
      if(depth <= 0) return '...';
      return '['+val.map(v => internal(v, depth - 1)).join(', ')+']';
    }
    return val + '';
  }
  return new ConstantExpression(internal(args, 10));
}, true)

export const print = new BuiltInFnExpression((scope, args) => {
  const show = scope.fetch('show') as Callable;
  const str = getAsStr(scope, show.execute(scope, args));
  console.log(str);
  return new ConstantExpression(undefined);
}, false);

export const sum = new BuiltInFnExpression((scope, args) => {
  try{
    const nums = getAsNumArr(scope, args);
    return new ConstantExpression(nums.reduce((a, n) => a + n, 0));
  }catch(e){
    const strs = getAsStrArr(scope, args);
    return new ConstantExpression(strs.reduce((a, n) => a + n, ''));
  }
  
}, true);

export const sub = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsNumArr(scope, args);
  return new ConstantExpression(a - b);
}, true);

export const pow = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsNumArr(scope, args);
  return new ConstantExpression(a ** b);
}, true);

export const product = new BuiltInFnExpression((scope, args) => {
  const nums = getAsNumArr(scope, args);
  return new ConstantExpression(nums.reduce((a, n) => a * n, 1));
}, true);

export const divide = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsNumArr(scope, args);
  return new ConstantExpression(a / b);
}, true);

export const intDivide = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsNumArr(scope, args);
  return new ConstantExpression(Math.floor(a / b));
}, true);

export const modulo = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsNumArr(scope, args);
  return new ConstantExpression(a >= 0 ? a % b : (b + (a % b)) % b);
}, true);

export const sqrt = new BuiltInFnExpression((scope, args) => {
  const n = getAsNum(scope, args);
  return new ConstantExpression(Math.sqrt(n));
}, true);

export const succ = new BuiltInFnExpression((scope, args) => {
  const n = getAsNum(scope, args);
  return new ConstantExpression(n + 1);
}, true);

export const floor = new BuiltInFnExpression((scope, args) => {
  const n = getAsNum(scope, args);
  return new ConstantExpression(Math.floor(n));
}, true);

export const ceil = new BuiltInFnExpression((scope, args) => {
  const n = getAsNum(scope, args);
  return new ConstantExpression(Math.ceil(n));
}, true);

export const range = new BuiltInFnExpression((scope, args) => {
  const [start, end] = getAsNumArr(scope, args);
  return new ArrayValue(Array.from({length: end - start}, (_, i) => new ConstantExpression(start + i)));
}, true);

export const map = new BuiltInFnExpression((scope, args) => {
  const [vals, mapper] = unpack<[Expression[], Callable]>(scope, args, [getAsArr, getAsFn]);
  return new ArrayValue(vals.map(expr => mapper.execute(scope, expr)));
}, true);

export const filter = new BuiltInFnExpression((scope, args) => {
  const [vals, mapper] = unpack<[Expression[], Callable]>(scope, args, [getAsArr, getAsFn]);
  return new ArrayValue(vals.filter(expr => mapper.execute(scope, expr).getValue(scope)));
}, true);

export const length = new BuiltInFnExpression((scope, args) => {
  const n = getAsArr(scope, args);
  return new ConstantExpression(n.length);
}, true);

export const equal = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) === b.getValue(scope));
}, true);

export const notEqual = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) !== b.getValue(scope));
}, true);

export const greaterThan = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) > b.getValue(scope));
}, true);

export const lessThan = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) < b.getValue(scope));
}, true);

export const greaterThanEqual = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) >= b.getValue(scope));
}, true);

export const lessThanEqual = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) <= b.getValue(scope));
}, true);

export const any = new BuiltInFnExpression((scope, args) => {
  const vals = getAsArr(scope, args);
  return new ConstantExpression(vals.some(v => v.getValue(scope)));
}, true);

export const every = new BuiltInFnExpression((scope, args) => {
  const vals = getAsArr(scope, args);
  return new ConstantExpression(vals.every(v => v.getValue(scope)));
}, true);

export const not = new BuiltInFnExpression((scope, args) => {
  const val = getAsBool(scope, args);
  return new ConstantExpression(!val);
}, true);

export const min = new BuiltInFnExpression((scope, args) => {
  const vals = getAsNumArr(scope, args);
  return new ConstantExpression(Math.min(...vals));
}, true);

export const max = new BuiltInFnExpression((scope, args) => {
  const vals = getAsNumArr(scope, args);
  return new ConstantExpression(Math.max(...vals));
}, true);

export const zip = new BuiltInFnExpression((scope, args) => {
  const expArr = getAsArr(scope, args);
  const finArr = expArr.map(e => {
    const val = e.getValue(scope);
    if(!Array.isArray(val)) throw new Error('Cannot zip non array');
    return val;
  })
  const length = Math.max(...finArr.map(a => a.length));
  return new ArrayValue(Array.from({length}, (_, i) => new ConstantExpression(finArr.map(a => a[i]))));
}, true);

export const enumerate = new BuiltInFnExpression((scope, args) => {
  const expArr = getAsArr(scope, args);
  return new ArrayValue(expArr.map((v, i) => new ArrayValue([v, new ConstantExpression(i)])))
}, true);

export const arrayAccess = new BuiltInFnExpression((scope, args) => {
  const [arr, pos] = unpack<[Expression[], number]>(scope, args, [getAsArr, getAsNum]);
  return arr[pos];
}, true);

export const arrayAssignment = new BuiltInFnExpression((scope, args) => {
  const [arr, pos, value] = unpack<[ArrayValue, number, Expression]>(scope, args, [getAsIs, getAsNum, getAsIs]);
  (arr.force(scope) as ArrayValue).setExpressionAt(pos, value.resolve(scope));
  return value;
}, false);

export const identity = new BuiltInFnExpression((scope, args) => {
  return args.resolve(scope); // I have no clue why removing the resolve here breaks it
}, true);

export const compose = new BuiltInFnExpression((scope, args) => {
  const fns = getAsFnArr(scope, args);
  const arg = new ReferenceExpression('arg');
  return fns.reduce((prev, cur) => new FunctionValue(new FunctionCall(cur, new FunctionCall(prev, arg)), arg, false, scope), identity);
}, true);

export const force = new BuiltInFnExpression((scope, args) => {
  return args.force(scope);
}, false);

export const forceDeep = new BuiltInFnExpression((scope, args) => {
  return args.forceDeep(scope);
}, false);

export const fst = new BuiltInFnExpression((scope, args) => {
  const forced = getAsArr(scope, args);
  return forced[0];
}, false);

export const snd = new BuiltInFnExpression((scope, args) => {
  const forced = getAsArr(scope, args);
  return forced[1];
}, false);

export const take = new BuiltInFnExpression((scope, args) => {
  let [numArg, ll] = getAsArr(scope, args);
  let num = getAsNum(scope, numArg);
  num = Math.floor(num);
  if(num < 0) return new ArrayValue([]);
  const vals: Expression[] = [];
  while(num){
    ll = ll.force(scope);
    if(!(ll instanceof ArrayValue)) break;
    vals.push(ll.getExpressionAt(0));
    ll = ll.getExpressionAt(1);
    num--;
  }
  return new ArrayValue(vals);
}, false);

export const takeWhile = new BuiltInFnExpression((scope, args) => {
  let [pred, ll] = unpack<[Callable, Expression]>(scope, args, [getAsFn, getAsIs]);
  const vals: Expression[] = [];
  while(true){
    ll = ll.force(scope);
    if(!(ll instanceof ArrayValue)) break;
    if(!pred.execute(scope, ll.getExpressionAt(0)).getValue(scope)) break;
    vals.push(ll.getExpressionAt(0));
    ll = ll.getExpressionAt(1);
  }
  return new ArrayValue(vals);
}, false);

export const load = new BuiltInFnExpression((scope, args) => {
  const file = getAsStr(scope, args);
  const prevLocation = scope.fetch('location')?.getValue(scope) || '.';
  const relPath = '.' + path.SEP + path.join(path.dirname(prevLocation), file);
  const code = new TextDecoder().decode(Deno.readFileSync(relPath));
  const [ast] = parse(code);
  if(!ast) throw new Error(`Failed to parse ${relPath}`);
  // console.log(Deno.inspect(ast, { depth: 100 }));
  const fileScope = new Scope(scope.root);
  fileScope.set('location', new ConstantExpression(relPath));
  return ast.copyLock(fileScope);
}, false);

export const forLoop = new BuiltInFnExpression((scope, args) => {
  const [header, body] = unpack<[ArrayValue, Callable]>(scope, args, [getAsIs, getAsFn]);
  const [init, condition, afterthought] = unpack<[Expression, Callable, Callable]>(scope, header, [getAsIs, getAsFn, getAsFn]);
  for(let control = init; condition.execute(scope, control).getValue(scope); control = afterthought.execute(scope, control)){
    body.execute(scope, control).force(scope);
  }
  return new ConstantExpression(undefined);
}, false);

const getAsIs = <T>(scope: Scope, args: T): T => args;

const getAsNum = (scope: Scope, args: Expression): number => {
  const val = args.getValue(scope);
  if(typeof val !== 'number') throw new Error('Invalid argument');
  return val;
};

const getAsStr = (scope: Scope, args: Expression): string => {
  const val = args.getValue(scope);
  if(typeof val !== 'string') throw new Error('Invalid argument');
  return val;
};

const getAsFn = (scope: Scope, args: Expression): Callable => {
  const val = args.getValue(scope);
  if(!(val instanceof Callable)) throw new Error('Invalid argument');
  return val;
};

const getAsBool = (scope: Scope, args: Expression): boolean => {
  const val = args.getValue(scope);
  if(typeof val !== 'boolean') throw new Error('Invalid argument');
  return val;
};

const getAsTypeArr = <T>(type: (scope: Scope, args: Expression) => T) => (scope: Scope, args: Expression, ): T[] => {
  const numExprs = getAsArr(scope, args);
  return numExprs.map(expr => type(scope, expr));
};

const getAsNumArr = getAsTypeArr(getAsNum);

const getAsStrArr = getAsTypeArr(getAsStr);

const getAsFnArr = getAsTypeArr(getAsFn);

const getAsArr = (scope: Scope, args: Expression): Expression[] => {
  const exprs = args.getValue(scope);
  if(!Array.isArray(exprs)) throw new Error('Invalid argument');
  return exprs;
};

const unpack = <T extends any[]>(scope: Scope, args: Expression, types: ((scope: Scope, args: Expression) => any)[]): T => {
  const arr = getAsArr(scope, args);
  return types.map((fn, i) => fn(scope, arr[i])) as T;
};

let parse: Parser;
export const loadingPromise = import('./parsing.ts').then(imports => {
  parse = imports.parse;
})
