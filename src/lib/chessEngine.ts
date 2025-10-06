import { Chess, Square, Move, PieceSymbol, Color } from 'chess.js';

export type ChessEngine = InstanceType<typeof Chess>;

export interface SerializableMove {
  san: string; // Standard algebraic notation
  from: Square;
  to: Square;
  flags: string;
  piece: PieceSymbol;
  color: Color;
  promotion?: PieceSymbol;
}

export function createChess(): ChessEngine {
  return new Chess();
}

export function getLegalMoves(chess: ChessEngine, from?: Square): Move[] {
  // chess.js types use any for move without verbose option; we rely on verbose: true
  return chess.moves({ square: from, verbose: true }) as unknown as Move[];
}

export function isPromotionMove(move: Move): boolean {
  // 'p' flag means a pawn move; promotion indicated by presence of promotion piece
  // In chess.js verbose move, promotion is included as 'promotion'
  // @ts-ignore - chess.js typings may not expose promotion
  return !!(move as any).promotion;
}

export function toSerializable(move: Move): SerializableMove {
  const m: any = move;
  return {
    san: m.san,
    from: m.from,
    to: m.to,
    flags: m.flags,
    piece: m.piece,
    color: m.color,
    promotion: m.promotion,
  };
}

export function unicodeForPiece(piece: PieceSymbol, color: Color): string {
  // Unicode pieces
  const map: Record<string, string> = {
    wk: '\u2654',
    wq: '\u2655',
    wr: '\u2656',
    wb: '\u2657',
    wn: '\u2658',
    wp: '\u2659',
    bk: '\u265A',
    bq: '\u265B',
    br: '\u265C',
    bb: '\u265D',
    bn: '\u265E',
    bp: '\u265F',
  };
  return map[`${color}${piece}`];
}

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';


