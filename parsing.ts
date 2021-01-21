import {
  Expression,
  ConstantExpression,
  FunctionCall,
  CodeBlock,
  ReferenceExpression,
  AssignmentExpression,
  ArrayValue,
  AST,
  BuiltInFnExpression,
  BinaryMathExpression,
  IfElseExpression,
  ReturnExpression,
  FunctionDeclaration,
  CodeBlockDeclaration,
} from './language.ts';
import * as builtins from './builtins.ts';

export type Parser = (code: string) => [Expression | undefined, string];

const reservedWords = [
  'if',
  'else',
  'fn',
  'then',
  'true',
  'false',
]

const parseConstantString = (str: string): Parser => code => {
  if(code.startsWith(str)) return [new ConstantExpression(str), code.substring(str.length)];
  return [undefined, code];
}

const parseNumber: Parser = code => {
  const match = code.match(/^-?\d+(\.\d+)?/);
  if(!match) return [undefined, code];
  return [new ConstantExpression(parseFloat(match[0])), code.substring(match[0].length)];
}

const parseString: Parser = code => {
  if(!code.startsWith('"')) return [undefined, code];
  let s = '';
  let i = 1;
  while(i < code.length){
    const cur = code.charAt(i);
    if(cur === '"') return [new ConstantExpression(s), code.substring(i + 1)];
    s += cur;
    i++;
  }
  return [undefined, code];
}

const parseVariableReference: Parser = code => {
  const nameMatch = code.match(/^[_a-zA-Z](\w+)?/);
  if(!nameMatch) return [undefined, code];
  const name = nameMatch[0];
  if(reservedWords.includes(name)) return [undefined, code];
  const rest = code.substring(name.length);
  return [new ReferenceExpression(name), rest];
}

const parseVarRefOrList: Parser = code => {
  const varRef = parseVariableReference(code);
  if(varRef[0]) return varRef
  else return parseList(code);
}

const parseVariableAssignment: Parser = code => {
  const local = code.startsWith('local') ? 'local' : code.startsWith('nonlocal') ? 'nonlocal' : '';
  let rest = code.substring(local.length).trim();
  let varRefResult = parseVarRefOrList(rest);
  let varRef = varRefResult[0];
  if(!varRef) return [undefined, code];
  rest = varRefResult[1].trim();
  if(rest.charAt(0) !== '=') return [undefined, code];
  rest = rest.substring(1).trim();
  const data = parseExpression(rest);
  const dataRef = data[0];
  if(!dataRef) return [undefined, code];
  rest = data[1];
  return [new AssignmentExpression(varRef, dataRef, local || 'any'), rest];
}

const parseFunctionCall: Parser = code => {
  const fnRefResult = parseAny([parseGroup, parseVariableReference])(code);
  const fnRef = fnRefResult[0];
  if(!fnRef) return [undefined, code];
  let rest = fnRefResult[1].trim();
  const data = parseExpression(rest);
  const dataRef = data[0];
  if(!dataRef) return [undefined, code];
  rest = data[1];
  return [new FunctionCall(fnRef, dataRef), rest];
}

const parseReturn: Parser = code => {
  if(!code.startsWith('return ')) return [undefined, code];
  const [dataRef, rest] = parseExpression(code.substring(7));
  if(!dataRef) return [undefined, code];
  return [new ReturnExpression(dataRef), rest];
}

const parseComma: Parser = parseConstantString(',');

const parseList: Parser = code => {
  const openBracket = parseConstantString('[')(code);
  if(!openBracket[0]) return [undefined, code];
  let rest = openBracket[1].trim();
  const vals: Expression[] = [];
  while(true){
    const val = parseExpression(rest);
    if(!val[0]) break;
    vals.push(val[0]);
    rest = val[1].trim();
    const comma = parseComma(rest);
    if(!comma[0]) break;
    rest = comma[1].trim();
  }
  const closeBracket = parseConstantString(']')(rest);
  if(!closeBracket[0]) return [undefined, code];
  rest = closeBracket[1].trim();
  return [new ArrayValue(vals), rest];
}

const parseFunction: Parser = code => {
  const fnOpen = parseConstantString('fn')(code);
  if(!fnOpen[0]) return [undefined, code];
  let rest = fnOpen[1].trim();
  const bang = parseConstantString('!')(rest);
  const immediate = !!bang[0];
  if(immediate) rest = bang[1].trim();
  const params = parseVarRefOrList(rest);
  if(!params[0]) return [undefined, code];
  rest = params[1].trim();
  if(!rest.startsWith(':')) return [undefined, code];
  rest = rest.substring(1).trim();
  const body = parseExpression(rest);
  if(!body[0]) return [undefined, code];
  rest = body[1].trim();
  return [new FunctionDeclaration(new ReturnExpression(body[0]), params[0], !immediate), rest];
}

const parseCodeBlock: Parser = code => {
  const openCurly = parseConstantString('{')(code);
  if(!openCurly[0]) return [undefined, code];
  let rest = openCurly[1].trim();
  const bang = parseConstantString('!')(rest);
  let lazy = true;
  if(bang[0]) {
    lazy = false;
    rest = bang[1].trim();
  }
  const vals: AST = [];
  while(true){
    const val = parseExpression(rest);
    if(!val[0]) {
      if(!rest.startsWith(';')) break;
      rest = rest.substring(1).trim();
      continue;
    }
    vals.push(val[0]);
    rest = val[1].trim();
  }
  const closeCurly = parseConstantString('}')(rest);
  if(!closeCurly[0]) return [undefined, code];
  rest = closeCurly[1].trim();
  return [new CodeBlockDeclaration(vals, lazy), rest];
}

const parseGroup: Parser = code => {
  if(!code.startsWith('(')) return [undefined, code];
  const content = parseExpression(code.substring(1).trim());
  if(!content[0]) return [undefined, code];
  const rest = content[1].trim();
  if(!rest.startsWith(')')) return [undefined, code];
  return [content[0], rest.substring(1)];
}

const parseBoolean: Parser = code => {
  let rest = code.trim();
  if(rest.startsWith('false')) return [new ConstantExpression(false), rest.substring(5)];
  if(rest.startsWith('true')) return [new ConstantExpression(true), rest.substring(4)];
  return [undefined, rest];
}

const parseInfixOp: Parser = code => {
  const stages: [string, BuiltInFnExpression][][] = [
    [
      ['&', builtins.every],
      ['|', builtins.any],
    ],
    [
      ['==', builtins.equal],
      ['!=', builtins.notEqual],
      ['<', builtins.lessThan],
      ['>', builtins.greaterThan],
      ['<=', builtins.lessThanEqual],
      ['>=', builtins.greaterThanEqual],
    ],
    [
      ['+', builtins.sum],
      ['-', builtins.sub],
    ],
    [
      ['*', builtins.product],
      ['/', builtins.divide],
      ['//', builtins.intDivide],
      ['%', builtins.modulo],
    ],
    [
      ['^', builtins.pow],
    ],
    [
      ['@', builtins.arrayAccess],
    ]
  ];
  for(const stage of stages){
    const options = stage
      .map(([op, fn]) => [code.indexOf(op), op, fn] as const)
      .filter(([i]) => i !== -1)
      .sort(([a], [b]) => a - b);
    for(const [pos, op, fn] of options){
      if(!op) continue;
      const left = parseExpression(code.substring(0, pos));
      if(!left[0] || left[1].trim() !== '') continue;
      let rest = code.substring(pos + op.length).trim();
      const right = parseExpression(rest);
      if(!right[0]) continue;
      return [new BinaryMathExpression(left[0], right[0], fn), right[1].trim()];
    }
  }
  return [undefined, code];
}

// if EXPRESSION then EXPRESSION?> else EXPRESSION
export const parseIfElse: Parser = code => {
  let rest = code.trim();
  if(!rest.startsWith('if')) return [undefined, code];
  rest = rest.substring(2).trim();
  const condition = parseExpression(rest);
  if(!condition[0]) return [undefined, code];
  rest = condition[1].trim();
  if(!rest.startsWith('then')) return [undefined, code];
  rest = rest.substring(4).trim();
  const onTrue = parseExpression(rest);
  if(!onTrue[0]) return [undefined, code];
  rest = onTrue[1].trim();
  if(!rest.startsWith('else')) return [new IfElseExpression(condition[0], onTrue[0]), rest];
  rest = rest.substring(4).trim();
  const onFalse = parseExpression(rest);
  if(!onFalse[0]) return [undefined, code];
  return [new IfElseExpression(condition[0], onTrue[0], onFalse[0]), onFalse[1]];
}

const parseAny = (parsers: Parser[]): Parser => (code: string) => {
  for(const parser of parsers){
    const [result, rest] = parser(code);
    if(result) return [result, rest];
  }
  return [undefined, code];
}

const parsers: Parser[] = [
  parseBoolean,
  parseIfElse,
  parseReturn,
  parseFunction,
  parseFunctionCall,
  parseVariableAssignment,
  parseInfixOp,
  parseGroup,
  parseCodeBlock,
  parseList,
  parseString,
  parseNumber,
  parseVariableReference,
];

export const parseExpression: Parser = parseAny(parsers);

export const parse: Parser = code => {
  const expressions: AST = [];
  let rest = code.trim();
  while(rest.length && !rest.startsWith('}')){
    const [expression, extra] = parseExpression(rest);
    // console.log({expression, extra})
    if(!expression) {
      if(!rest.startsWith(';')) return [undefined, code];
      rest = rest.substring(1).trim();
      continue;
    }
    expressions.push(expression);
    rest = extra.trim();
  }
  return [new CodeBlock(expressions, false), rest.substring(1)];
}