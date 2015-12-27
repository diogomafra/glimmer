import { assert } from "glimmer-util";
import { Stack, DictSet, InternedString, dict } from "glimmer-util";

import {
  SerializedBlock,
  SerializedTemplate,
  Core,
  Statement,
  Expression
} from './types';

type str = string;
type Params = Core.Params;
type Hash = Core.Hash;
type Path = Core.Path;
type StackValue = Expression | Params | Hash | str;

export class Block {
  statements: Statement[];
  positionals: string[];

  toJSON(): SerializedBlock {
    return {
      statements: this.statements,
      locals: this.positionals as InternedString[]
    };
  }

  push(statement: Statement) {
    this.statements.push(statement);
  }
}

export class Template extends Block {
  public statements: Statement[] = null;
  public meta: Object = null;

  public yields = new DictSet();
  public positionals: string[] = null;
  public named = new DictSet();
  public blocks: Block[] = [];

  toJSON(): SerializedTemplate {
    return {
      statements: this.statements,
      locals: this.positionals as InternedString[],
      named: this.named.toArray(),
      yields: this.yields.toArray(),
      blocks: this.blocks.map(b => b.toJSON()),
      meta: null
    };
  }
}

export default class JavaScriptCompiler {
  static process(opcodes): Template {
    let compiler = new JavaScriptCompiler(opcodes);
    return compiler.process();
  }

  private template: Template = new Template();
  private blocks = new Stack<Block>();
  private opcodes: any[];
  private values: StackValue[] = [];

  constructor(opcodes) {
    this.opcodes = opcodes;
    this.blocks.push(new Template());
  }

  process() {
    this.opcodes.forEach(([opcode, ...args]) => {
      if (!this[opcode]) { throw new Error(`unimplemented ${opcode} on JavaScriptCompiler`); }
      this[opcode](...args);
    });

    return this.template;
  }

  /// Nesting

  startProgram([program]) {
    this.template.positionals = program.blockParams;
    this.blocks.push(new Block());
  }

  endProgram() {
    let { template, blocks } = this;
    let block = blocks.pop();

    if (!this.blocks.isEmpty()) {
      template.blocks.push(block);
    } else {
      // top level
    }
  }

  /// Statements

  text(content: string) {
    this.push(['text', content]);
  }

  append(trusted: boolean) {
    this.push(['append', this.popValue<Expression>(), trusted]);
  }

  comment(value: string) {
    this.push(['comment', value]);
  }

  modifier(path: Path) {
    let params = this.popValue<Params>();
    let hash = this.popValue<Hash>();

    this.push(['modifier', path, params, hash]);
  }

  block(path: Path, template: number, inverse: number) {
    let params = this.popValue<Params>();
    let hash = this.popValue<Hash>();

    this.push(['block', path, params, hash, template, inverse]);
  }

  component(tag: str, template: number) {
    let attrs = this.popValue<Hash>();
    this.push(['component', tag, attrs, template]);
  }

  openElement(tag: str, blockParams: string[]) {
    this.push(['openElement', tag, blockParams]);
  }

  closeElement() {
    this.push(['closeElement']);
  }

  addClass() {
    let value = this.popValue<Expression>();
    this.push(['addClass', value]);
  }

  staticAttr(name: str, namespace: str) {
    let value = this.popValue<Expression>();
    this.push(['staticAttr', name, value, namespace]);
  }

  dynamicAttr(name: string, namespace: string) {
    let value = this.popValue<Expression>();
    this.push(['dynamicAttr', name, value, namespace]);
  }

  dynamicProp(name: string) {
    let value = this.popValue<Expression>();
    this.push(['dynamicProp', name, value]);
  }

  yield(to: string) {
    let params = this.popValue<Params>();
    this.push(['yield', to, params]);
    this.template.yields.add(to);
  }

  /// Expressions

  literal(value: any) {
    this.pushValue(value);
  }

  unknown(path: string[]) {
    this.pushValue(['unknown', path]);
  }

  attr(path: string[]) {
    this.template.named.add(path[0]);
    this.pushValue(['attr', path]);
  }

  get(path: string[]) {
    this.pushValue(['get', path]);
  }

  concat() {
    this.pushValue(['concat', this.popValue<Params>()]);
  }

  helper(path: string[]) {
    let params = this.popValue<Params>();
    let hash = this.popValue<Hash>();

    this.pushValue(['helper', path, params, hash]);
  }

  /// Stack Management Opcodes

  pushLiteral(literal: any) {
    this.pushValue(literal);
  }

  prepareArray(size: number) {
    let values = [];

    for (let i = 0; i < size; i++) {
      values.push(this.popValue());
    }

    this.pushValue(values);
  }

  prepareObject(size: number) {
    assert(this.values.length >= size, `Expected ${size} values on the stack, found ${this.values.length}`);

    let object = dict<Expression>();

    for (let i = 0; i < size; i++) {
      object[this.popValue<str>()] = this.popValue<Expression>();
    }

    this.pushValue(object);
  }

  /// Utilities

  push(args: Statement) {
    while (args[args.length - 1] === null) {
      args.pop();
    }

    this.blocks.current.push(args);
  }

  pushValue(val: Expression | Params | Hash) {
    this.values.push(val);
  }

  popValue<T extends StackValue>(): T {
    assert(this.values.length, "No expression found on stack");
    return this.values.pop() as T;
  }
}
