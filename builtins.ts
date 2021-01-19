import { BuiltInFnExpression, ConstantExpression, Callable, Expression, Scope, ArrayValue, FunctionValue, ReferenceExpression, FunctionCall } from './language.ts';

export const show = new BuiltInFnExpression((scope, args): ConstantExpression<string> => {
  const val = args.getValue(scope);
  if(Array.isArray(val)) return new ConstantExpression(val.map(v => getAsStr(scope, show.execute(scope, v))).join(', '));
  return new ConstantExpression(val + '');
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

export const equal = new BuiltInFnExpression((scope, args) => {
  const [a, b] = getAsArr(scope, args);
  return new ConstantExpression(a.getValue(scope) === b.getValue(scope));
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

export const arrayAccess = new BuiltInFnExpression((scope, args) => {
  const [arr, pos] = unpack<[Expression[], number]>(scope, args, [getAsArr, getAsNum]);
  return arr[pos];
}, true);

export const identity = new BuiltInFnExpression((scope, args) => {
  return args.resolve(scope); // I have no clue why removing the resolve here breaks it
}, true);

export const compose = new BuiltInFnExpression((scope, args) => {
  const fns = getAsFnArr(scope, args);
  const arg = new ReferenceExpression('arg');
  return fns.reduce((prev, cur) => new FunctionValue(new FunctionCall(cur, new FunctionCall(prev, arg)), arg, false, scope), identity)
}, true);

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
