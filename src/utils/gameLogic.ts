/**
 * Game logic for a 15x15 gomoku game. 0s on board represent empty spaces.
 * 1s represent moves done by player 1 (black) and 2s represent moves 
 * made by player 2 (white).
 */
import type { BoardState, Player, GameResult } from '../ai/types';

export const BOARD_SIZE = 15;

export function createEmptyBoard(): BoardState
{
    // 15x15 2d array of 0s
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

export function copyBoard(board: BoardState): BoardState
{
    // deep copy using spread operator
    return board.map(row => [...row]);
}

export function makeMove(board: BoardState, row: number, col: number, player: Player): BoardState
{
    const newBoard = copyBoard(board);
    newBoard[row][col] = player;
    return newBoard;
}

export function isValidMove(board: BoardState, row: number, col:number): boolean
{
    return row >= 0 && row < BOARD_SIZE &&
           col >= 0 && col < BOARD_SIZE &&
           board[row][col] == 0;
}

export function checkWin(board: BoardState, lastRow: number, lastCol: number): GameResult
{
    const player = board[lastRow][lastCol];
    if (player == 0) return { winner: null };

    const directions = [
        [[0,1], [0,-1]],
        [[1,0], [-1,0]],
        [[1,1], [-1,-1]],
        [[1,-1], [-1,1]]
    ];

    for (const [dir1, dir2] of directions)
    {
        const line: [number,number][] = [[lastRow,lastCol]];

        for (const [dr,dc] of [dir1,dir2])
        {
            let r = lastRow + dr;
            let c = lastCol + dc;
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                    board[r][c] === player)
            {
                line.push([r,c]);
                r += dr;
                c += dc;
            }
        } 
        if (line.length >= 5)
        {
            return { winner: player, winningLine: line };
        }
    }
    return { winner: null };
}

export function isBoardFull(board: BoardState): boolean
{
    return board.every(row => row.every(cell => cell !== 0));
}

export function getValidMoves(board: BoardState): [number, number][]
{
    const moves: [number, number][] = [];
    
    for (let r = 0; r < BOARD_SIZE; r++)
    {
        for (let c = 0; c < BOARD_SIZE; c++)
        {
            if (board[r][c] === 0)
            {
                moves.push([r, c]);
            }
        }
    }
    
    return moves;
}
