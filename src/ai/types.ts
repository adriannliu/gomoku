export type Player = 1 | 2;
export type Cell = 0 | Player;
export type BoardState = Cell[][];

export interface MCTSNode
{
    board: BoardState;
    move: [number, number] | null;
    parent: MCTSNode | null;
    children: Map<string, MCTSNode>;
    untriedMoves: [number, number][];
    visits: number;
    wins: number;
    player: Player;
}

export interface GameResult
{
    winner: Player | null;
    winningLine?: [number, number][];
}