export type Player = 1 | 2;
export type Cell = 0 | Player;
export type BoardState = Cell[][];

export interface MCTSNode
{
    board: BoardState;
    // The move that led to this node (stored as [r, c] for easy debugging/compatibility)
    move: [number, number] | null; 
    
    parent: MCTSNode | null;
    
    // Optimization: Use integer keys (0-224) instead of strings ("7,7")
    children: Map<number, MCTSNode>; 
    untriedMoves: number[]; 
    visits: number;
    wins: number;
    player: Player;
}

export interface GameResult
{
    winner: Player | null;
    winningLine?: [number, number][];
}