export abstract class Expression {
  protected forcedScope?: Scope;

  lock(scope: Scope): this {
    this.forcedScope = scope;
    return this;
  };

  abstract copyLock(scope: Scope): Expression;

  resolve(scope: Scope){
    return this as Expression;
  };

  getValue(scope: Scope): any {
    return this.resolve(this.forcedScope || scope).getValue(this.forcedScope || scope);
  }
  
  force(scope: Scope): Expression {
    const next = this.resolve(this.forcedScope || scope);
    if(next === this) return next;
    else return next.force(this.forcedScope || scope);
  }

  forceDeep(scope: Scope): Expression {
    const next = this.resolve(this.forcedScope || scope);
    if(next === this) return next;
    else return next.forceDeep(this.forcedScope || scope);
  }
}

export class ConstantExpression<T> extends Expression {
  constructor(protected value: T){
    super();
  }

  getValue(scope: Scope): T {
    return this.value;
  }

  copyLock(scope: Scope): Expression {
    return new ConstantExpression<T>(this.value);
  }
}

export class LazyExpression extends Expression {
  private cache?: Expression;

  constructor(private resolver: () => Expression){
    super();
  }

  resolve(scope: Scope){
    if(this.cache) return this.cache;
    this.cache = this.resolver().resolve(this.forcedScope || scope);
    return this.cache;
  }

  copyLock(scope: Scope){
    return new LazyExpression(this.resolver).lock(scope);
  }
}

export class ReferenceExpression extends Expression {
  constructor(private name: string) {
    super();
  }

  resolve(scope: Scope){
    return (this.forcedScope || scope).fetch(this.name);
  }

  assign(scope: Scope, value: Expression, local: Local){
    (this.forcedScope || scope).set(this.name, value.resolve((this.forcedScope || scope)), local);
  }

  copyLock(scope: Scope){
    return new ReferenceExpression(this.name).lock(scope);
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

  get root(): Scope {
    if(!this.parent) return this;
    return this.parent.root;
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
    return super.getValue((this.forcedScope || scope));
  }

  execute(scope: Scope, args: Expression): Expression {
    const go = () => {
      const localScope = new Scope(this.parentScope);
      localScope.set('recurse', this, 'local');
      assignToScope(localScope, this.forcedScope || scope, this.argRef, args, 'local');
      return this.code.resolve(localScope).resolve(localScope); // resolves twices because expression is wrapped in a ReturnExpression
    }
    if(this.lazy) return new LazyExpression(go);
    return go();
  }

  copyLock(scope: Scope){
    return new FunctionValue(this.code.copyLock(scope), this.argRef.copyLock(scope), this.lazy, this.parentScope).lock(scope);
  }
}

export class FunctionDeclaration extends Callable {
  constructor(private code: Expression, private argRef: Expression, private lazy: boolean){
    super();
  }

  resolve(scope: Scope){
    return new FunctionValue(this.code, this.argRef, this.lazy, (this.forcedScope || scope));
  }

  execute(scope: Scope, args: Expression){
    return this.resolve((this.forcedScope || scope)).execute((this.forcedScope || scope), args);
  }

  copyLock(scope: Scope){
    return new FunctionDeclaration(this.code.copyLock(scope), this.argRef, this.lazy).lock(scope);
  }
}

export class BuiltInFnExpression extends Callable {
  constructor(private  fn:(scope: Scope, args: Expression) => Expression, private lazy: boolean = true){
    super();
  }

  execute(scope: Scope, args: Expression): Expression {
    if(this.lazy) return new LazyExpression(() => this.fn((this.forcedScope || scope), args));
    return this.fn((this.forcedScope || scope), args);
  }

  copyLock(scope: Scope) {
    return new BuiltInFnExpression(this.fn, this.lazy).lock(scope);
  }
}

export class ArrayValue extends ConstantExpression<Expression[]> {
  getExpressionAt(index: number){
    return this.value[index] || new ConstantExpression(undefined);
  }

  setExpressionAt(index: number, value: Expression){
    this.value[index] = value;
  }

  length(){
    return this.value.length;
  }

  forceDeep(scope: Scope){
    return new ArrayValue(this.value.map(e => e.forceDeep((this.forcedScope || scope))));
  }

  copyLock(scope: Scope): Expression {
    return new ArrayValue(this.value.map(e => e.copyLock(scope))).lock(scope);
  }
}

export class FunctionCall extends Expression {
  constructor(private fn: Expression, private args: Expression){
    super();
  }

  resolve(scope: Scope){
    const resolvedFn = this.fn.getValue((this.forcedScope || scope));
    if(resolvedFn instanceof Callable) return resolvedFn.execute((this.forcedScope || scope), this.args);
    throw new Error(`Can not call ${resolvedFn}`);
  }

  getValue(scope: Scope){
    return super.getValue((this.forcedScope || scope));
  }

  copyLock(scope: Scope){
    return new FunctionCall(this.fn.copyLock(scope), this.args.copyLock(scope)).lock(scope);
  }
}

export class CodeBlock extends Expression {
  private cache?: Expression;

  constructor(private code: AST, private lazy: boolean){
    super();
  }

  resolve(scope: Scope){
    if(this.cache) return this.cache;
    const go = () => {
      const localScope = new Scope((this.forcedScope || scope));
      for(const expr of this.code){
        if(expr instanceof ReturnExpression) return expr.resolve(localScope);
        expr.resolve(localScope);
      }
      return new ConstantExpression(undefined);
    }
    this.cache = this.lazy ? new LazyExpression(go) : go();
    return this.cache;
  }

  copyLock(scope: Scope){
    return new CodeBlock(this.code.map(e => e.copyLock(scope)), this.lazy).lock(scope);
  }
}

export class CodeBlockDeclaration extends Expression {
  constructor(private code: AST, private lazy: boolean){
    super();
  }

  resolve(scope: Scope){
    return new CodeBlock(this.code, this.lazy).resolve(this.forcedScope || scope);
  }

  copyLock(scope: Scope){
    return new CodeBlockDeclaration(this.code.map(e => e.copyLock(scope)), this.lazy).lock(scope);
  }
}

export class BinaryMathExpression extends Expression {
  constructor(private left: Expression, private right: Expression, private op: Expression){
    super();
  }

  resolve(scope: Scope){
    const resolvedOp = this.op.getValue((this.forcedScope || scope));
    if(!(resolvedOp instanceof Callable)) throw new Error('Invalid operator');
    return new LazyExpression(() => resolvedOp.execute((this.forcedScope || scope), new ArrayValue([this.left, this.right])));
  }

  copyLock(scope: Scope){
    return new BinaryMathExpression(this.left.copyLock(scope), this.right.copyLock(scope), this.op.copyLock(scope)).lock(scope);
  }
}

export class AssignmentExpression extends Expression {
  constructor(private location: Expression, private data: Expression, private local: Local){
    super();
  }

  resolve(scope: Scope){
    assignToScope((this.forcedScope || scope), (this.forcedScope || scope), this.location, this.data.copyLock((this.forcedScope || scope)), this.local);
    return this.data;
  }

  copyLock(scope: Scope){
    return new AssignmentExpression(this.location.copyLock(scope), this.data.copyLock(scope), this.local).lock(scope);
  }
}

export class ReturnExpression extends Expression {
  constructor(private returnValue: Expression){
    super();
  }

  resolve(scope: Scope){
    return this.returnValue.copyLock(scope).resolve(scope);
  }

  copyLock(scope: Scope){
    return new ReturnExpression(this.returnValue.copyLock(scope)).lock(scope);
  }
}

export class IfElseExpression extends Expression {
  constructor(private condition: Expression, private onTrue: Expression, private onFalse?: Expression){
    super();
  }

  resolve(scope: Scope){
    if(this.condition.getValue((this.forcedScope || scope))) return this.onTrue.resolve(scope);
    else return this.onFalse?.resolve(scope) || new ConstantExpression(undefined);
  }

  copyLock(scope: Scope){
    return new IfElseExpression(this.condition.copyLock(scope), this.onTrue.copyLock(scope), this.onFalse?.copyLock(scope)).lock(scope);
  }
}

export const assignToScope = (scope: Scope, oldScope: Scope, location: Expression, data: Expression, local: Local) => {
  if(location instanceof ReferenceExpression) location.assign(scope, data, local);
  else {
    location = location.force(scope);
    if(location instanceof ArrayValue){
      data = data.force(oldScope);
      if(data instanceof ArrayValue) {
        for(let i = 0; i < location.length(); i++){
          assignToScope(scope, oldScope, location.getExpressionAt(i), data.getExpressionAt(i), local);
        }
      }
    }
    else throw new Error('Invalid assignment');
  }
}

export type AST = Expression[];
