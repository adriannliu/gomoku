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

/**
 * Returns all moves that create a "Four" (4 consecutive stones) or a "Five".
 * These are forcing moves for VCF.
 */
export function getForcingMoves(board: BoardState, player: Player): [number, number][] {
    const moves: [number, number][] = [];
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    // Optimization: Only check empty spots near existing stones
    // For now, we iterate all, but in MCTS we use candidate list.
    // Here we need accuracy for VCF.
    
    // To make it faster, we could pass candidates, but for now strict iteration 
    // on empty cells around existing stones would be better.
    // Let's stick to simple iteration for simplicity in this step, 
    // or use a helper if performance is an issue.
    // Given 15x15, full iteration is ~225 * 4 = 900 checks. 
    // For VCF depth, this might be called many times. 
    // We will optimize by only checking neighbors of existing stones inside the loop if needed.

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue;

            let isForcing = false;
            for (const [dr, dc] of directions) {
                const { count } = detectPattern(board, r, c, dr, dc, player);
                if (count >= 4) {
                    isForcing = true;
                    break;
                }
            }
            if (isForcing) {
                moves.push([r, c]);
            }
        }
    }
    return moves;
}

/**
 * Checks if the board state contains any immediate threats for the player 
 * (Open Three, Four, or Five) that require a response.
 */
export function hasThreats(board: BoardState, player: Player): boolean {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue;

            for (const [dr, dc] of directions) {
                const { count, openEnds } = detectPattern(board, r, c, dr, dc, player);
                // Four or Five is a threat
                if (count >= 4) return true;
                // Open Three is a threat
                if (count === 3 && openEnds === 2) return true;
            }
        }
    }
    return false;
}
