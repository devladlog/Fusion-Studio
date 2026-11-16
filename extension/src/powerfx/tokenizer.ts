/**
 * PowerFx Tokenizer
 * Lexical analysis for PowerFx formulas
 */

export enum TokenType {
    // Literals
    Number = 'NUMBER',
    String = 'STRING',
    Boolean = 'BOOLEAN',
    
    // Identifiers
    Identifier = 'IDENTIFIER',
    GlobalIdentifier = 'GLOBAL_IDENTIFIER',  // [@GlobalVar]
    
    // Operators
    Plus = 'PLUS',
    Minus = 'MINUS',
    Multiply = 'MULTIPLY',
    Divide = 'DIVIDE',
    Power = 'POWER',
    Ampersand = 'AMPERSAND',  // String concatenation
    
    // Comparison
    Equal = 'EQUAL',
    NotEqual = 'NOT_EQUAL',
    LessThan = 'LESS_THAN',
    GreaterThan = 'GREATER_THAN',
    LessOrEqual = 'LESS_OR_EQUAL',
    GreaterOrEqual = 'GREATER_OR_EQUAL',
    
    // Logical
    And = 'AND',
    Or = 'OR',
    Not = 'NOT',
    
    // Delimiters
    LeftParen = 'LEFT_PAREN',
    RightParen = 'RIGHT_PAREN',
    LeftBracket = 'LEFT_BRACKET',
    RightBracket = 'RIGHT_BRACKET',
    LeftBrace = 'LEFT_BRACE',
    RightBrace = 'RIGHT_BRACE',
    Comma = 'COMMA',
    Semicolon = 'SEMICOLON',
    Colon = 'COLON',
    Dot = 'DOT',
    At = 'AT',
    
    // Special
    ThisRecord = 'THIS_RECORD',  // ThisRecord or ThisItem
    Parent = 'PARENT',
    Self = 'SELF',
    
    // Keywords (commonly used functions - treated as identifiers)
    If = 'IF',
    Switch = 'SWITCH',
    ForAll = 'FORALL',
    Filter = 'FILTER',
    LookUp = 'LOOKUP',
    Patch = 'PATCH',
    Collect = 'COLLECT',
    Set = 'SET',
    UpdateContext = 'UPDATECONTEXT',
    Navigate = 'NAVIGATE',
    
    // End of formula
    EOF = 'EOF',
    
    // Invalid
    Invalid = 'INVALID'
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    start: number;
    end: number;
}

export interface TokenizerError {
    message: string;
    line: number;
    column: number;
    position: number;
}

const KEYWORDS: Map<string, TokenType> = new Map([
    ['true', TokenType.Boolean],
    ['false', TokenType.Boolean],
    ['and', TokenType.And],
    ['or', TokenType.Or],
    ['not', TokenType.Not],
    ['if', TokenType.If],
    ['switch', TokenType.Switch],
    ['forall', TokenType.ForAll],
    ['filter', TokenType.Filter],
    ['lookup', TokenType.LookUp],
    ['patch', TokenType.Patch],
    ['collect', TokenType.Collect],
    ['set', TokenType.Set],
    ['updatecontext', TokenType.UpdateContext],
    ['navigate', TokenType.Navigate],
    ['thisrecord', TokenType.ThisRecord],
    ['thisitem', TokenType.ThisRecord],
    ['parent', TokenType.Parent],
    ['self', TokenType.Self],
]);

/**
 * Tokenizes a PowerFx formula string into tokens
 */
export class PowerFxTokenizer {
    private source: string;
    private tokens: Token[] = [];
    private errors: TokenizerError[] = [];
    
    private start: number = 0;
    private current: number = 0;
    private line: number = 1;
    private column: number = 1;
    private lineStart: number = 0;
    
    constructor(source: string) {
        this.source = source;
    }
    
    /**
     * Tokenize the source formula
     */
    tokenize(): { tokens: Token[]; errors: TokenizerError[] } {
        this.tokens = [];
        this.errors = [];
        
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }
        
        this.tokens.push({
            type: TokenType.EOF,
            value: '',
            line: this.line,
            column: this.column,
            start: this.current,
            end: this.current
        });
        
        return { tokens: this.tokens, errors: this.errors };
    }
    
    private scanToken(): void {
        const char = this.advance();
        
        switch (char) {
            // Single character tokens
            case '(': this.addToken(TokenType.LeftParen); break;
            case ')': this.addToken(TokenType.RightParen); break;
            case '[': this.addToken(TokenType.LeftBracket); break;
            case ']': this.addToken(TokenType.RightBracket); break;
            case '{': this.addToken(TokenType.LeftBrace); break;
            case '}': this.addToken(TokenType.RightBrace); break;
            case ',': this.addToken(TokenType.Comma); break;
            case ';': this.addToken(TokenType.Semicolon); break;
            case ':': this.addToken(TokenType.Colon); break;
            case '.': this.addToken(TokenType.Dot); break;
            case '+': this.addToken(TokenType.Plus); break;
            case '-': this.addToken(TokenType.Minus); break;
            case '*': this.addToken(TokenType.Multiply); break;
            case '/': 
                if (this.peek() === '/') {
                    // Line comment
                    while (this.peek() !== '\n' && !this.isAtEnd()) {
                        this.advance();
                    }
                } else if (this.peek() === '*') {
                    // Block comment
                    this.advance(); // consume *
                    while (!(this.peek() === '*' && this.peekNext() === '/') && !this.isAtEnd()) {
                        if (this.peek() === '\n') {
                            this.line++;
                            this.lineStart = this.current + 1;
                        }
                        this.advance();
                    }
                    if (!this.isAtEnd()) {
                        this.advance(); // consume *
                        this.advance(); // consume /
                    }
                } else {
                    this.addToken(TokenType.Divide);
                }
                break;
            case '^': this.addToken(TokenType.Power); break;
            case '&': this.addToken(TokenType.Ampersand); break;
            case '@': this.addToken(TokenType.At); break;
            
            // Two character tokens
            case '=': this.addToken(TokenType.Equal); break;
            case '<':
                if (this.match('=')) {
                    this.addToken(TokenType.LessOrEqual);
                } else if (this.match('>')) {
                    this.addToken(TokenType.NotEqual);
                } else {
                    this.addToken(TokenType.LessThan);
                }
                break;
            case '>':
                if (this.match('=')) {
                    this.addToken(TokenType.GreaterOrEqual);
                } else {
                    this.addToken(TokenType.GreaterThan);
                }
                break;
            
            // Whitespace
            case ' ':
            case '\r':
            case '\t':
                break;
            case '\n':
                this.line++;
                this.lineStart = this.current;
                break;
            
            // String literals
            case '"':
                this.string();
                break;
            
            default:
                if (this.isDigit(char)) {
                    this.number();
                } else if (this.isAlpha(char)) {
                    this.identifier();
                } else {
                    this.errors.push({
                        message: `Unexpected character: ${char}`,
                        line: this.line,
                        column: this.current - this.lineStart,
                        position: this.current - 1
                    });
                }
        }
    }
    
    private string(): void {
        while (this.peek() !== '"' && !this.isAtEnd()) {
            if (this.peek() === '\n') {
                this.line++;
                this.lineStart = this.current + 1;
            }
            // Handle escaped quotes
            if (this.peek() === '"' && this.peekNext() === '"') {
                this.advance();
            }
            this.advance();
        }
        
        if (this.isAtEnd()) {
            this.errors.push({
                message: 'Unterminated string',
                line: this.line,
                column: this.start - this.lineStart + 1,
                position: this.start
            });
            return;
        }
        
        this.advance(); // Closing "
        
        // Extract string value without quotes
        const value = this.source.substring(this.start + 1, this.current - 1)
            .replace(/""/g, '"'); // Unescape double quotes
        
        this.addToken(TokenType.String, value);
    }
    
    private number(): void {
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        
        // Look for decimal part
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            this.advance(); // consume .
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        
        // Scientific notation
        if (this.peek() === 'e' || this.peek() === 'E') {
            this.advance();
            if (this.peek() === '+' || this.peek() === '-') {
                this.advance();
            }
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        
        this.addToken(TokenType.Number);
    }
    
    private identifier(): void {
        while (this.isAlphaNumeric(this.peek())) {
            this.advance();
        }
        
        const text = this.source.substring(this.start, this.current);
        const keyword = KEYWORDS.get(text.toLowerCase());
        
        this.addToken(keyword ?? TokenType.Identifier);
    }
    
    // Helper methods
    private isAtEnd(): boolean {
        return this.current >= this.source.length;
    }
    
    private advance(): string {
        this.column++;
        return this.source.charAt(this.current++);
    }
    
    private peek(): string {
        if (this.isAtEnd()) {return '\0';}
        return this.source.charAt(this.current);
    }
    
    private peekNext(): string {
        if (this.current + 1 >= this.source.length) {return '\0';}
        return this.source.charAt(this.current + 1);
    }
    
    private match(expected: string): boolean {
        if (this.isAtEnd()) {return false;}
        if (this.source.charAt(this.current) !== expected) {return false;}
        
        this.current++;
        this.column++;
        return true;
    }
    
    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }
    
    private isAlpha(char: string): boolean {
        return (char >= 'a' && char <= 'z') ||
               (char >= 'A' && char <= 'Z') ||
               char === '_' || char === '!';  // ! for functions like If, Set, etc.
    }
    
    private isAlphaNumeric(char: string): boolean {
        return this.isAlpha(char) || this.isDigit(char);
    }
    
    private addToken(type: TokenType, literal?: string): void {
        const value = literal ?? this.source.substring(this.start, this.current);
        this.tokens.push({
            type,
            value,
            line: this.line,
            column: this.start - this.lineStart + 1,
            start: this.start,
            end: this.current
        });
    }
}

/**
 * Convenience function to tokenize a formula
 */
export function tokenize(formula: string): { tokens: Token[]; errors: TokenizerError[] } {
    const tokenizer = new PowerFxTokenizer(formula);
    return tokenizer.tokenize();
}
