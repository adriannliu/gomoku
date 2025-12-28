import type { BoardState, Player } from './types';
import { BOARD_SIZE } from '../utils/gameLogic';

export interface Pattern {
    count: number;
    openEnds: number;
}

/**
 * Analyzes the line at (row, col) in direction (dr, dc)
 * ASSUMING a stone for 'player' is placed at (row, col).
 */
export function detectPattern(
    board: BoardState,
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: Player
): Pattern {
    // Start with 1 to count the hypothetical stone at (row, col)
    let count = 1;
    let openEnds = 0;

    // 1. Check Forward Direction
    let r = row + dr;
    let c = col + dc;
    
    // Count consecutive player stones
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
    }
    // Check for open end after the sequence
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 0) {
        openEnds++;
    }

    // 2. Check Backward Direction
    r = row - dr;
    c = col - dc;

    // Count consecutive player stones
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
    }
    // Check for open end after the sequence
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 0) {
        openEnds++;
    }

    return { count, openEnds };
}

export function findWinningMove(board: BoardState, player: Player): [number, number] | null {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue; // Skip occupied

            for (const [dr, dc] of directions) {
                // Use detectPattern directly instead of copying the board
                const { count } = detectPattern(board, r, c, dr, dc, player);
                if (count >= 5) {
                    return [r, c];
                }
            }
        }
    }
    return null;
}

export function findFour(board: BoardState, player: Player): [number, number] | null {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue; 

            for (const [dr, dc] of directions) {
                const { count } = detectPattern(board, r, c, dr, dc, player);
                // Standard Gomoku AI usually prioritizes "Open Fours" separately,
                // but if you just want ANY 4-in-a-row (even blocked), this is correct.
                if (count >= 4) {
                    return [r, c];
                }
            }
        }
    }
    return null;
}

export function findOpenThree(board: BoardState, player: Player): [number, number][] {
    const moves: [number, number][] = [];
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue;

            for (const [dr, dc] of directions) {
                const pattern = detectPattern(board, r, c, dr, dc, player);
                
                // Now this logic holds true: 
                // count includes the potential move, so we look for 3 total stones
                if (pattern.count === 3 && pattern.openEnds === 2) {
                    moves.push([r, c]);
                    break; // Found a valid pattern for this cell, move to next cell
                }
            }
        }
    }
    return moves;
}