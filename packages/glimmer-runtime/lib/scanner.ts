import { Program, Statement as StatementSyntax } from './syntax';
import buildStatement from './syntax/statements';
import { TopLevelTemplate, EntryPoint, InlineBlock, Layout } from './compiled/blocks';
import Environment from './environment';
import { EMPTY_SLICE, LinkedList } from 'glimmer-util';
import { SerializedTemplate, SerializedBlock, Statement as SerializedStatement } from 'glimmer-compiler';

export default class Scanner {
  private spec: SerializedTemplate;
  private env: Environment;

  constructor(spec: SerializedTemplate, env: Environment) {
    this.spec = spec;
    this.env = env;
  }

  scanEntryPoint(): EntryPoint {
    return this.scanTop<EntryPoint>(({ program, children }) => {
      return EntryPoint.create({ children, ops: null, program });
    });
  }

  scanLayout(): Layout {
    return this.scanTop<Layout>(({ program, children }) => {
      let { named, yields } = this.spec;
      return Layout.create({ children, program, named, yields });
    });
  }

  private scanTop<T extends TopLevelTemplate>(makeTop: (options: { program: Program, children: InlineBlock[] }) => T): T {
    let { spec } = this;
    let { blocks: specBlocks } = spec;

    let blocks: InlineBlock[] = [];

    for (let i = 0, block: SerializedBlock; block = specBlocks[i]; i++) {
      blocks.push(this.buildBlock(block, blocks));
    }

    return makeTop(this.buildStatements(spec, blocks)).initBlocks();
  }

  private buildBlock(block: SerializedBlock, blocks: InlineBlock[]): InlineBlock{
    let { program, children } = this.buildStatements(block, blocks);
    return new InlineBlock({ children, locals: block.locals, program });
  }

  private buildStatements({ statements }: SerializedBlock, blocks: InlineBlock[]): ScanResults {
    if (statements.length === 0) return EMPTY_PROGRAM;
    return new BlockScanner(statements, blocks, this.env).scan();
  }
}

interface ScanResults {
  program: Program;
  children: InlineBlock[];
}

const EMPTY_PROGRAM = {
  program: EMPTY_SLICE,
  children: []
};

export class BlockScanner {
  public program = new LinkedList<StatementSyntax>();
  public children: InlineBlock[] = [];
  public env: Environment;
  private reader: SyntaxReader;

  constructor(statements: SerializedStatement[], blocks: InlineBlock[], env: Environment) {
    this.reader = new SyntaxReader(statements, blocks);
    this.env = env;
  }

  scan(): ScanResults {
    let { reader, program } = this;
    let statement: StatementSyntax;

    while (statement = reader.next()) {
      program.append(statement.scan(this));
    }

    return this;
  }

  addChild(block: InlineBlock) {
    this.children.push(block);
  }

  next(): StatementSyntax {
    return this.reader.next();
  }

  unput(statement: StatementSyntax) {
    this.reader.unput(statement);
  }
}

export class SyntaxReader {
  statements: SerializedStatement[];
  current: number = 0;
  blocks: InlineBlock[];
  last: StatementSyntax = null;

  constructor(statements: SerializedStatement[], blocks: InlineBlock[]) {
    this.statements = statements;
    this.blocks = blocks;
  }

  unput(statement: StatementSyntax) {
    this.last = statement;
  }

  next(): StatementSyntax {
    let last = this.last;
    if (last) {
      this.last = null;
      return last;
    } else if (this.current === this.statements.length) {
      return null;
    }

    let sexp = this.statements[this.current++];
    return buildStatement(sexp, this.blocks);
  }
}