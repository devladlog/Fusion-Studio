/**
 * PowerFx Parser
 * Parses tokens into an Abstract Syntax Tree (AST)
 */

import { Token, TokenType, PowerFxTokenizer } from './tokenizer';

// AST Node Types
export type ASTNode = 
    | ProgramNode
    | ExpressionNode;

export type ExpressionNode =
    | LiteralNode
    | IdentifierNode
    | BinaryExpressionNode
    | UnaryExpressionNode
    | CallExpressionNode
    | MemberExpressionNode
    | RecordExpressionNode
    | TableExpressionNode
    | IfExpressionNode
    | ChainExpressionNode;

export interface NodeBase {
    type: string;
    start: number;
    end: number;
    line: number;
    column: number;
}

export interface ProgramNode extends NodeBase {
    type: 'Program';
    body: ExpressionNode;
}

export interface LiteralNode extends NodeBase {
    type: 'Literal';
    valueType: 'number' | 'string' | 'boolean';
    value: string | number | boolean;
    raw: string;
}

export interface IdentifierNode extends NodeBase {
    type: 'Identifier';
    name: string;
    isGlobal: boolean;
    isThisRecord: boolean;
    isParent: boolean;
    isSelf: boolean;
}

export interface BinaryExpressionNode extends NodeBase {
    type: 'BinaryExpression';
    operator: string;
    left: ExpressionNode;
    right: ExpressionNode;
}

export interface UnaryExpressionNode extends NodeBase {
    type: 'UnaryExpression';
    operator: string;
    argument: ExpressionNode;
    prefix: boolean;
}

export interface CallExpressionNode extends NodeBase {
    type: 'CallExpression';
    callee: IdentifierNode;
    arguments: ExpressionNode[];
}

export interface MemberExpressionNode extends NodeBase {
    type: 'MemberExpression';
    object: ExpressionNode;
    property: IdentifierNode | LiteralNode;
    computed: boolean;  // true for bracket notation [x], false for dot notation .x
}

export interface RecordExpressionNode extends NodeBase {
    type: 'RecordExpression';
    properties: PropertyNode[];
}

export interface PropertyNode extends NodeBase {
    type: 'Property';
    key: IdentifierNode;
    value: ExpressionNode;
}

export interface TableExpressionNode extends NodeBase {
    type: 'TableExpression';
    elements: RecordExpressionNode[];
}

export interface IfExpressionNode extends NodeBase {
    type: 'IfExpression';
    condition: ExpressionNode;
    consequent: ExpressionNode;
    alternate: ExpressionNode | null;
}

export interface ChainExpressionNode extends NodeBase {
    type: 'ChainExpression';
    expressions: ExpressionNode[];
}

export interface ParseError {
    message: string;
    line: number;
    column: number;
    token?: Token;
}

export interface ParseResult {
    ast: ProgramNode | null;
    errors: ParseError[];
}

/**
 * PowerFx Parser - Recursive Descent Parser
 */
export class PowerFxParser {
    private tokens: Token[] = [];
    private current: number = 0;
    private errors: ParseError[] = [];
    
    /**
     * Parse a PowerFx formula string into an AST
     */
    parse(source: string): ParseResult {
        const tokenizer = new PowerFxTokenizer(source);
        const tokenResult = tokenizer.tokenize();
        
        this.tokens = tokenResult.tokens;
        this.current = 0;
        this.errors = tokenResult.errors.map(e => ({
            message: e.message,
            line: e.line,
            column: e.column
        }));
        
        if (this.errors.length > 0) {
            return { ast: null, errors: this.errors };
        }
        
        try {
            const body = this.parseExpression();
            
            if (!this.isAtEnd() && this.peek().type !== TokenType.EOF) {
                this.error(`Unexpected token: ${this.peek().value}`);
            }
            
            const program: ProgramNode = {
                type: 'Program',
                body,
                start: 0,
                end: source.length,
                line: 1,
                column: 1
            };
            
            return { ast: program, errors: this.errors };
        } catch (e) {
            if (e instanceof Error) {
                this.errors.push({
                    message: e.message,
                    line: this.peek()?.line ?? 1,
                    column: this.peek()?.column ?? 1
                });
            }
            return { ast: null, errors: this.errors };
        }
    }
    
    // Expression parsing with precedence climbing
    
    private parseExpression(): ExpressionNode {
        return this.parseChainExpression();
    }
    
    private parseChainExpression(): ExpressionNode {
        const expressions: ExpressionNode[] = [this.parseOrExpression()];
        
        while (this.match(TokenType.Semicolon)) {
            if (!this.isAtEnd() && this.peek().type !== TokenType.EOF) {
                expressions.push(this.parseOrExpression());
            }
        }
        
        if (expressions.length === 1) {
            return expressions[0];
        }
        
        return {
            type: 'ChainExpression',
            expressions,
            start: expressions[0].start,
            end: expressions[expressions.length - 1].end,
            line: expressions[0].line,
            column: expressions[0].column
        };
    }
    
    private parseOrExpression(): ExpressionNode {
        let left = this.parseAndExpression();
        
        while (this.match(TokenType.Or)) {
            const operator = this.previous();
            const right = this.parseAndExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parseAndExpression(): ExpressionNode {
        let left = this.parseComparisonExpression();
        
        while (this.match(TokenType.And)) {
            const operator = this.previous();
            const right = this.parseComparisonExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parseComparisonExpression(): ExpressionNode {
        let left = this.parseConcatExpression();
        
        while (this.matchAny(
            TokenType.Equal,
            TokenType.NotEqual,
            TokenType.LessThan,
            TokenType.GreaterThan,
            TokenType.LessOrEqual,
            TokenType.GreaterOrEqual
        )) {
            const operator = this.previous();
            const right = this.parseConcatExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parseConcatExpression(): ExpressionNode {
        let left = this.parseAdditiveExpression();
        
        while (this.match(TokenType.Ampersand)) {
            const operator = this.previous();
            const right = this.parseAdditiveExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parseAdditiveExpression(): ExpressionNode {
        let left = this.parseMultiplicativeExpression();
        
        while (this.matchAny(TokenType.Plus, TokenType.Minus)) {
            const operator = this.previous();
            const right = this.parseMultiplicativeExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parseMultiplicativeExpression(): ExpressionNode {
        let left = this.parsePowerExpression();
        
        while (this.matchAny(TokenType.Multiply, TokenType.Divide)) {
            const operator = this.previous();
            const right = this.parsePowerExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parsePowerExpression(): ExpressionNode {
        let left = this.parseUnaryExpression();
        
        // Power is right-associative
        if (this.match(TokenType.Power)) {
            const operator = this.previous();
            const right = this.parsePowerExpression();
            left = this.createBinaryNode(left, operator.value, right);
        }
        
        return left;
    }
    
    private parseUnaryExpression(): ExpressionNode {
        if (this.matchAny(TokenType.Not, TokenType.Minus)) {
            const operator = this.previous();
            const argument = this.parseUnaryExpression();
            return {
                type: 'UnaryExpression',
                operator: operator.value,
                argument,
                prefix: true,
                start: operator.start,
                end: argument.end,
                line: operator.line,
                column: operator.column
            };
        }
        
        return this.parseMemberExpression();
    }
    
    private parseMemberExpression(): ExpressionNode {
        let object = this.parsePrimary();
        
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.match(TokenType.Dot)) {
                const property = this.consume(TokenType.Identifier, 'Expected property name after "."');
                object = {
                    type: 'MemberExpression',
                    object,
                    property: this.createIdentifierNode(property),
                    computed: false,
                    start: object.start,
                    end: property.end,
                    line: object.line,
                    column: object.column
                };
            } else if (this.match(TokenType.LeftBracket)) {
                const property = this.parseExpression();
                const closeBracket = this.consume(TokenType.RightBracket, 'Expected "]" after index');
                object = {
                    type: 'MemberExpression',
                    object,
                    property: property as IdentifierNode | LiteralNode,
                    computed: true,
                    start: object.start,
                    end: closeBracket.end,
                    line: object.line,
                    column: object.column
                };
            } else if (this.match(TokenType.LeftParen)) {
                // Function call
                const args = this.parseArguments();
                const closeParen = this.consume(TokenType.RightParen, 'Expected ")" after arguments');
                
                if (object.type !== 'Identifier') {
                    this.error('Function calls must be on identifiers');
                }
                
                object = {
                    type: 'CallExpression',
                    callee: object as IdentifierNode,
                    arguments: args,
                    start: object.start,
                    end: closeParen.end,
                    line: object.line,
                    column: object.column
                };
            } else {
                break;
            }
        }
        
        return object;
    }
    
    private parsePrimary(): ExpressionNode {
        // Boolean literals
        if (this.match(TokenType.Boolean)) {
            const token = this.previous();
            return {
                type: 'Literal',
                valueType: 'boolean',
                value: token.value.toLowerCase() === 'true',
                raw: token.value,
                start: token.start,
                end: token.end,
                line: token.line,
                column: token.column
            };
        }
        
        // Number literals
        if (this.match(TokenType.Number)) {
            const token = this.previous();
            return {
                type: 'Literal',
                valueType: 'number',
                value: parseFloat(token.value),
                raw: token.value,
                start: token.start,
                end: token.end,
                line: token.line,
                column: token.column
            };
        }
        
        // String literals
        if (this.match(TokenType.String)) {
            const token = this.previous();
            return {
                type: 'Literal',
                valueType: 'string',
                value: token.value,
                raw: `"${token.value}"`,
                start: token.start,
                end: token.end,
                line: token.line,
                column: token.column
            };
        }
        
        // Special identifiers
        if (this.match(TokenType.ThisRecord)) {
            const token = this.previous();
            return this.createIdentifierNode(token, false, true, false, false);
        }
        
        if (this.match(TokenType.Parent)) {
            const token = this.previous();
            return this.createIdentifierNode(token, false, false, true, false);
        }
        
        if (this.match(TokenType.Self)) {
            const token = this.previous();
            return this.createIdentifierNode(token, false, false, false, true);
        }
        
        // Regular identifiers and function names
        if (this.matchAny(
            TokenType.Identifier,
            TokenType.If, TokenType.Switch, TokenType.ForAll,
            TokenType.Filter, TokenType.LookUp, TokenType.Patch,
            TokenType.Collect, TokenType.Set, TokenType.UpdateContext,
            TokenType.Navigate
        )) {
            const token = this.previous();
            return this.createIdentifierNode(token);
        }
        
        // Record expression { key: value, ... }
        if (this.match(TokenType.LeftBrace)) {
            return this.parseRecordExpression();
        }
        
        // Table expression [ {}, {}, ... ]
        if (this.match(TokenType.LeftBracket)) {
            return this.parseTableExpression();
        }
        
        // Grouped expression ( expr )
        if (this.match(TokenType.LeftParen)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RightParen, 'Expected ")" after expression');
            return expr;
        }
        
        throw new Error(`Unexpected token: ${this.peek().value}`);
    }
    
    private parseRecordExpression(): RecordExpressionNode {
        const startToken = this.previous();
        const properties: PropertyNode[] = [];
        
        if (!this.check(TokenType.RightBrace)) {
            do {
                const key = this.consume(TokenType.Identifier, 'Expected property name');
                this.consume(TokenType.Colon, 'Expected ":" after property name');
                const value = this.parseExpression();
                
                properties.push({
                    type: 'Property',
                    key: this.createIdentifierNode(key),
                    value,
                    start: key.start,
                    end: value.end,
                    line: key.line,
                    column: key.column
                });
            } while (this.match(TokenType.Comma));
        }
        
        const endToken = this.consume(TokenType.RightBrace, 'Expected "}" after record');
        
        return {
            type: 'RecordExpression',
            properties,
            start: startToken.start,
            end: endToken.end,
            line: startToken.line,
            column: startToken.column
        };
    }
    
    private parseTableExpression(): TableExpressionNode {
        const startToken = this.previous();
        const elements: RecordExpressionNode[] = [];
        
        if (!this.check(TokenType.RightBracket)) {
            do {
                if (this.match(TokenType.LeftBrace)) {
                    elements.push(this.parseRecordExpression());
                } else {
                    throw new Error('Table elements must be records');
                }
            } while (this.match(TokenType.Comma));
        }
        
        const endToken = this.consume(TokenType.RightBracket, 'Expected "]" after table');
        
        return {
            type: 'TableExpression',
            elements,
            start: startToken.start,
            end: endToken.end,
            line: startToken.line,
            column: startToken.column
        };
    }
    
    private parseArguments(): ExpressionNode[] {
        const args: ExpressionNode[] = [];
        
        if (!this.check(TokenType.RightParen)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(TokenType.Comma));
        }
        
        return args;
    }
    
    // Helper methods
    
    private createBinaryNode(left: ExpressionNode, operator: string, right: ExpressionNode): BinaryExpressionNode {
        return {
            type: 'BinaryExpression',
            operator,
            left,
            right,
            start: left.start,
            end: right.end,
            line: left.line,
            column: left.column
        };
    }
    
    private createIdentifierNode(
        token: Token,
        isGlobal = false,
        isThisRecord = false,
        isParent = false,
        isSelf = false
    ): IdentifierNode {
        return {
            type: 'Identifier',
            name: token.value,
            isGlobal,
            isThisRecord,
            isParent,
            isSelf,
            start: token.start,
            end: token.end,
            line: token.line,
            column: token.column
        };
    }
    
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    
    private matchAny(...types: TokenType[]): boolean {
        return this.match(...types);
    }
    
    private check(type: TokenType): boolean {
        if (this.isAtEnd()) {return false;}
        return this.peek().type === type;
    }
    
    private advance(): Token {
        if (!this.isAtEnd()) {this.current++;}
        return this.previous();
    }
    
    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }
    
    private peek(): Token {
        return this.tokens[this.current];
    }
    
    private previous(): Token {
        return this.tokens[this.current - 1];
    }
    
    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) {return this.advance();}
        throw new Error(`${message}, got ${this.peek().value}`);
    }
    
    private error(message: string): void {
        this.errors.push({
            message,
            line: this.peek().line,
            column: this.peek().column,
            token: this.peek()
        });
    }
}

/**
 * Convenience function to parse a PowerFx formula
 */
export function parse(formula: string): ParseResult {
    const parser = new PowerFxParser();
    return parser.parse(formula);
}
