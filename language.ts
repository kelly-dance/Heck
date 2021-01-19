export abstract class Expression {
  resolve(scope: Scope){
    return this as Expression;
  };

  getValue(scope: Scope): any {
    return this.resolve(scope).getValue(scope);
  }
  
  force(scope: Scope): Expression {
    const next = this.resolve(scope);
    if(next === this) return next;
    else return next.force(scope);
  }

  forceDeep(scope: Scope): Expression {
    const next = this.resolve(scope);
    if(next === this) return next;
    else return next.forceDeep(scope);
  }
}

export class ConstantExpression<T> extends Expression {
  constructor(protected value: T){
    super();
  }

  getValue(scope: Scope): T {
    return this.value;
  }
}

export class LazyExpression extends Expression {
  constructor(private resolver: () => Expression){
    super();
  }

  resolve(scope: Scope){
    return this.resolver().resolve(scope);
  }
}

export class ReferenceExpression extends Expression {
  constructor(private name: string) {
    super();
  }

  resolve(scope: Scope){
    return scope.fetch(this.name);
  }

  assign(scope: Scope, value: Expression, local: Local){
    scope.set(this.name, value.resolve(scope), local);
  }
}

export type Local = 'local' | 'any' | 'nonlocal';

export class Scope {
  private values: Map<string, Expression>

  constructor(private parent?: Scope){
    this.values = new Map();
  }

  fetch(key: string): Expression {
    if(this.values.has(key)) return this.values.get(key) as Expression;
    if(this.parent) return this.parent.fetch(key);
    return new ConstantExpression(undefined);
  }

  exists(key: string, local: Local): boolean {
    if(local === 'local') return this.values.has(key);
    if(local === 'any') return !!(this.values.has(key) || (this.parent && this.parent.exists(key, 'any')));
    if(local === 'nonlocal') return !!(this.parent && this.parent.exists(key, 'any'));
    return false; // never
  }

  set(key: string, value: Expression, local: Local){
    if(local === 'local') this.values.set(key, value);
    else if(local === 'nonlocal') (this.parent || this).set(key, value, 'any');
    else if(local === 'any'){
      if(this.exists(key, 'local')) this.values.set(key, value);
      else if(!this.parent) this.values.set(key, value);
      else this.parent.set(key, value, 'any');
    }
    // never;
  }
}

export abstract class Callable extends Expression {
  abstract execute(scope: Scope, args: Expression): Expression;

  getValue(scope: Scope){
    return this;
  }
}

export class FunctionValue extends Callable {
  constructor(private code: Expression, private argRef: Expression, private lazy: boolean, private parentScope: Scope){
    super();
  }

  getValue(scope: Scope){
    return super.getValue(scope);
  }

  execute(scope: Scope, args: Expression): Expression {
    const go = () => {
      const localScope = new Scope(this.parentScope);
      localScope.set('recurse', this, 'local');
      assignToScope(localScope, scope, this.argRef, args, 'local');
      return this.code.resolve(localScope);
    }
    if(this.lazy){
      return new LazyExpression(go);
    }
    return go();
  }
}

export class FunctionDeclaration extends Callable {
  constructor(private code: Expression, private argRef: Expression, private lazy: boolean){
    super();
  }

  resolve(scope: Scope){
    return new FunctionValue(this.code, this.argRef, this.lazy, scope);
  }

  execute(scope: Scope, args: Expression){
    return this.resolve(scope).execute(scope, args);
  }
}

export class BuiltInFnExpression extends Callable {
  constructor(private  fn:(scope: Scope, args: Expression) => Expression, private lazy: boolean = true){
    super();
  }

  execute(scope: Scope, args: Expression): Expression {
    if(this.lazy) return new LazyExpression(() => this.fn(scope, args));
    return this.fn(scope, args);
  }
}

export class ArrayValue extends ConstantExpression<Expression[]> {
  getExpressionAt(index: number){
    return this.value[index] || new ConstantExpression(undefined);
  }

  length(){
    return this.value.length;
  }

  forceDeep(scope: Scope){
    return new ArrayValue(this.value.map(e => e.forceDeep(scope)));
  }
}

export class FunctionCall extends Expression {
  constructor(private fn: Expression, private args: Expression){
    super();
  }

  resolve(scope: Scope){
    const resolvedFn = this.fn.getValue(scope);
    if(resolvedFn instanceof Callable) return resolvedFn.execute(scope, this.args);
    throw new Error(`Can not call ${resolvedFn}`);
  }

  getValue(scope: Scope){
    return super.getValue(scope);
  }
}

export class CodeBlock extends Expression {
  constructor(private code: AST){
    super();
  }

  resolve(scope: Scope){
    const localScope = new Scope(scope);
    // console.log(Deno.inspect(localScope, { depth: 100, colors: true }));
    for(const expr of this.code){
      if(expr instanceof ReturnExpression) return expr.resolve(localScope);
      expr.resolve(localScope);
    }
    return new ConstantExpression(undefined);
  }
}

export class BinaryMathExpression extends Expression {
  constructor(private left: Expression, private right: Expression, private op: Expression){
    super();
  }

  resolve(scope: Scope){
    const resolvedOp = this.op.getValue(scope);
    if(!(resolvedOp instanceof Callable)) throw new Error('Invalid operator');
    return new LazyExpression(() => resolvedOp.execute(scope, new ArrayValue([this.left, this.right])));
  }
}

export class AssignmentExpression extends Expression {
  constructor(private location: Expression, private data: Expression, private local: Local){
    super();
  }

  resolve(scope: Scope){
    assignToScope(scope, scope, this.location, this.data.resolve(scope), this.local);
    return this.data;
  }
}

export class ReturnExpression extends Expression {
  constructor(private returnValue: Expression){
    super();
  }

  resolve(scope: Scope){
    return this.returnValue.forceDeep(scope);
  }
}

export class IfElseExpression extends Expression {
  constructor(private condition: Expression, private onTrue: Expression, private onFalse?: Expression){
    super();
  }

  resolve(scope: Scope){
    if(this.condition.getValue(scope)) return this.onTrue;
    else return this.onFalse || new ConstantExpression(undefined);
  }
}

export const assignToScope = (scope: Scope, oldScope: Scope, location: Expression, data: Expression, local: Local) => {
  data = data.forceDeep(oldScope);
  if(location instanceof ReferenceExpression) location.assign(scope, data, local);
  else {
    location = location.force(scope);
    if(location instanceof ArrayValue && data instanceof ArrayValue) {
      for(let i = 0; i < location.length(); i++){
        assignToScope(scope, oldScope, location.getExpressionAt(i), data.getExpressionAt(i), local);
      }
    }
    else throw new Error('Invalid assignment');
  }
}

export type AST = Expression[];
