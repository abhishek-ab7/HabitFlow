/**
 * Safe, pure-TS CodeAct math evaluator for HabitFlow Finance AI.
 * Zero eval() / new Function() — recursive-descent parser only.
 */

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const MAX_EXPRESSION_LENGTH = 240;

function tokenize(expr: string, variables: Record<string, number>): Token[] {
  if (expr.length > MAX_EXPRESSION_LENGTH) {
    throw new Error('Expression too long');
  }
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < expr.length && /[0-9._]/.test(expr[i])) {
        if (expr[i] !== '_') numStr += expr[i];
        i++;
      }
      const value = Number(numStr);
      if (!Number.isFinite(value)) throw new Error(`Invalid number: ${numStr}`);
      tokens.push({ type: 'num', value });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      if (!Object.prototype.hasOwnProperty.call(variables, ident)) {
        throw new Error(`Unknown variable: ${ident}`);
      }
      const val = variables[ident];
      if (!Number.isFinite(val)) throw new Error(`Invalid variable value: ${ident}`);
      tokens.push({ type: 'num', value: val });
      continue;
    }
    throw new Error(`Disallowed character in expression: "${ch}"`);
  }

  return tokens;
}

class ExprParser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const result = this.parseAddSub();
    if (this.pos < this.tokens.length) throw new Error('Unexpected trailing token');
    if (!Number.isFinite(result)) throw new Error('Non-finite arithmetic result');
    return Math.round(result * 10000) / 10000;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (true) {
      const tok = this.peek();
      if (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
        this.pos++;
        const right = this.parseMulDiv();
        left = tok.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parsePower();
    while (true) {
      const tok = this.peek();
      if (tok?.type === 'op' && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
        this.pos++;
        const right = this.parsePower();
        if ((tok.value === '/' || tok.value === '%') && right === 0) {
          throw new Error('Division by zero');
        }
        left = tok.value === '*' ? left * right : tok.value === '/' ? left / right : left % right;
      } else {
        break;
      }
    }
    return left;
  }

  private parsePower(): number {
    const base = this.parseUnary();
    const tok = this.peek();
    if (tok?.type === 'op' && tok.value === '^') {
      this.pos++;
      const exp = this.parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  private parseUnary(): number {
    const tok = this.peek();
    if (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      this.pos++;
      const val = this.parseUnary();
      return tok.value === '-' ? -val : val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.type === 'num') {
      this.pos++;
      return tok.value;
    }
    if (tok.type === 'lparen') {
      this.pos++;
      const val = this.parseAddSub();
      if (this.peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
      this.pos++;
      return val;
    }
    throw new Error('Unexpected token in expression');
  }
}

export function evaluateFinanceMath(
  expression: string,
  variables: Record<string, number> = {}
): number {
  const tokens = tokenize(expression.trim(), variables);
  if (tokens.length === 0) throw new Error('Empty expression');
  return new ExprParser(tokens).parse();
}

export function calculateEmi(principal: number, annualRatePct: number, months: number): {
  monthlyEmi: number;
  totalPayment: number;
  totalInterest: number;
} {
  if (principal <= 0 || months <= 0) throw new Error('Principal and months must be positive');
  const r = annualRatePct / 12 / 100;
  const monthlyEmi =
    r === 0
      ? principal / months
      : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const totalPayment = monthlyEmi * months;
  return {
    monthlyEmi: Math.round(monthlyEmi * 100) / 100,
    totalPayment: Math.round(totalPayment * 100) / 100,
    totalInterest: Math.round((totalPayment - principal) * 100) / 100,
  };
}

export function calculateSipFutureValue(
  monthlyAmount: number,
  annualRatePct: number,
  months: number
): {
  invested: number;
  futureValue: number;
  estimatedGain: number;
} {
  if (monthlyAmount <= 0 || months <= 0) throw new Error('Monthly SIP and months must be positive');
  const r = annualRatePct / 12 / 100;
  const invested = monthlyAmount * months;
  const futureValue =
    r === 0 ? invested : monthlyAmount * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  return {
    invested: Math.round(invested * 100) / 100,
    futureValue: Math.round(futureValue * 100) / 100,
    estimatedGain: Math.round((futureValue - invested) * 100) / 100,
  };
}
