import { LinkedList, InternedString } from 'glimmer-util';
import { OpSeq, Opcode } from '../opcodes';
import { OpenPrimitiveElementOpcode, CloseElementOpcode } from '../compiled/opcodes/dom';
import { ShadowAttributesOpcode } from '../compiled/opcodes/component';
import { Program } from '../syntax';
import { Environment } from '../environment';
import { ComponentDefinition } from '../component/interfaces';
import SymbolTable from '../symbol-table';

import {
  EntryPointCompiler,
  LayoutCompiler,
  CompiledComponentParts,
  InlineBlockCompiler
} from '../compiler';

export interface BlockOptions {
  children: InlineBlock[];
  program: Program;
  ops?: OpSeq;
  symbolTable?: SymbolTable;
}

export abstract class Block {
  public children: InlineBlock[];
  public ops: OpSeq;
  public program: Program;
  public symbolTable: SymbolTable;

  constructor(options: BlockOptions) {
    this.ops = options.ops || null;
    this.symbolTable = options.symbolTable || null;
    this.children = options.children;
    this.program = options.program;
  }
}

export interface InlineBlockOptions extends BlockOptions {
  locals: InternedString[];
}

export class InlineBlock extends Block {
  locals: InternedString[];

  constructor(options: InlineBlockOptions) {
    super(options);
    this.locals = options.locals;
  }

  hasPositionalParameters(): boolean {
    return !!this.locals.length;
  }

  compile(env: Environment) {
    this.ops = this.ops || new InlineBlockCompiler(this, env).compile();
  }
}

export abstract class TopLevelTemplate extends Block {
  initBlocks(blocks = this['children'], parentTable = this['symbolTable']): this {
    blocks.forEach(block => {
      let table = SymbolTable.initForBlock({ parent: parentTable, block });
      this.initBlocks(block['children'], table);
    });
    return this;
  }
}

export class EntryPoint extends TopLevelTemplate {
  static create(options: BlockOptions): EntryPoint {
    let top = new EntryPoint(options);
    SymbolTable.initForEntryPoint(top);
    return top;
  }

  compile(env: Environment) {
    this.ops = this.ops || new EntryPointCompiler(this, env).compile();
  }
}

export interface LayoutOptions extends BlockOptions {
  parts?: CompiledComponentParts;
  named: InternedString[];
  yields: InternedString[];
  program: Program;
}

export class Layout extends TopLevelTemplate {
  static create(options: LayoutOptions): Layout {
    let layout = new Layout(options);
    SymbolTable.initForLayout(layout);
    return layout;
  }

  private parts: CompiledComponentParts;
  public named: InternedString[];
  public yields: InternedString[];

  constructor({ children, parts, named, yields, program }: LayoutOptions) {
    super({ children, program });
    this.parts = parts;

    // positional params in Ember may want this
    // this.locals = locals;
    this.named = named;
    this.yields = yields;
  }

  compile(definition: ComponentDefinition, env: Environment) {
    if (this.ops) return;

    this.parts = this.parts || new LayoutCompiler(this, env, definition).compile();
    let { tag, preamble, main } = this.parts;

    let ops = new LinkedList<Opcode>();
    ops.append(new OpenPrimitiveElementOpcode({ tag }));
    ops.spliceList(preamble.clone(), null);
    ops.append(new ShadowAttributesOpcode());
    ops.spliceList(main.clone(), null);
    ops.append(new CloseElementOpcode());
    this.ops = ops;
  }

  hasNamedParameters(): boolean {
    return !!this.named.length;
  }

  hasYields(): boolean {
    return !!this.yields.length;
  }
}
