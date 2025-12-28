import type { BoardState, Player } from './types';
import { BOARD_SIZE } from '../utils/gameLogic';

export interface Pattern
{
    count: number;
    openEnds: number;
}

export function detectPattern(
    board: BoardState, 
    row: number, 
    col: number, 
    dr: number, 
    dc: number, 
    player: Player
): Pattern
{
    let count = 0;
    let openEnds = 0;

    let r = row;
    let c = col;

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player)
    {
        count++;
        r += dr;
        c += dc;
    }
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 0)
    {
        openEnds++;
    }

    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player)
    {
        count++;
        r -= dr;
        c -= dc;
    }
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 0)
    {
        openEnds++;
    }

    return { count, openEnds };
}

export function findWinningMove(board: BoardState, player: Player): [number, number] | null
{
    for (let r = 0; r < BOARD_SIZE; r++)
    {
        for (let c = 0; c < BOARD_SIZE; c++)
        {
            if (board[r][c] !== 0) continue;

            const tempBoard = board.map(row => [...row]);
            tempBoard[r][c] = player;

            const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
            for (const [dr, dc] of directions)
            {
                let count = 1;

                let nr = r + dr;
                let nc = c + dc;
                while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && tempBoard[nr][nc] === player)
                {
                    count++;
                    nr += dr;
                    nc += dc;
                }

                nr = r - dr;
                nc = c - dc;
                while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && tempBoard[nr][nc] === player)
                {
                    count++;
                    nr -= dr;
                    nc -= dc;
                }

                if (count >= 5)
                {
                    return [r, c];
                }
            }
        }
    }
    return null;
}

export function findFour(board: BoardState, player: Player): [number, number] | null
{
    for (let r = 0; r < BOARD_SIZE; r++)
    {
        for (let c = 0; c < BOARD_SIZE; c++)
        {
            if (board[r][c] !== 0) continue;

            const tempBoard = board.map(row => [...row]);
            tempBoard[r][c] = player;

            const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
            for (const [dr, dc] of directions)
            {
                let count = 1;

                let nr = r + dr;
                let nc = c + dc;
                while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && tempBoard[nr][nc] === player)
                {
                    count++;
                    nr += dr;
                    nc += dc;
                }

                nr = r - dr;
                nc = c - dc;
                while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && tempBoard[nr][nc] === player)
                {
                    count++;
                    nr -= dr;
                    nc -= dc;
                }

                if (count >= 4)
                {
                    return [r, c];
                }
            }
        }
    }
    return null;
}

export function findOpenThree(board: BoardState, player: Player): [number, number][]
{
    const moves: [number, number][] = [];
    
    for (let r = 0; r < BOARD_SIZE; r++)
    {
        for (let c = 0; c < BOARD_SIZE; c++)
        {
            if (board[r][c] !== 0) continue;

            const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
            for (const [dr, dc] of directions)
            {
                const pattern = detectPattern(board, r, c, dr, dc, player);
                if (pattern.count === 3 && pattern.openEnds === 2)
                {
                    moves.push([r, c]);
                    break;
                }
            }
        }
    }
    return moves;
}