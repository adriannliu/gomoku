import type { BoardState, Player } from './types';
import { BOARD_SIZE } from '../utils/gameLogic';

// Directions constant to avoid recreating it in every function call
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export interface Pattern {
    consecutive: number; // Strict 5-in-a-row check (No gaps allowed)
    effective: number;   // Heuristic count (Allows 1 gap, e.g., X X _ X)
    openEnds: number;    // Open ends based on the 'effective' pattern scan
}

/**
 * Analyzes the line at (row, col) in direction (dr, dc).
 * Returns both strict consecutive counts (for wins) and gap-tolerant counts (for AI threats).
 */
export function detectPattern(
    board: BoardState,
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: Player
): Pattern {
    // 1. Scan Forward
    const fwd = scanLine(board, row, col, dr, dc, player);
    // 2. Scan Backward
    const bwd = scanLine(board, row, col, -dr, -dc, player);

    // Combine results
    // -1 because the starting stone (row, col) is counted in both fwd and bwd
    return {
        consecutive: fwd.consecutive + bwd.consecutive - 1,
        effective: fwd.effective + bwd.effective - 1,
        openEnds: fwd.endType + bwd.endType
    };
}

/**
 * Helper to scan a single direction.
 * Returns:
 * - consecutive: stones found before first gap
 * - effective: stones found allowing up to 1 gap
 * - endType: 1 if the pattern ends in an empty space (Open), 0 if blocked/boundary
 */
function scanLine(
    board: BoardState, 
    row: number, 
    col: number, 
    dr: number, 
    dc: number, 
    player: Player
) {
    let r = row;
    let c = col;
    let consecutive = 0;
    let effective = 0;
    let gapUsed = false;
    let consecutiveBroken = false;
    let endType = 0; // 0 = Blocked, 1 = Open

    r += dr; 
    c += dc;
    
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        const cell = board[r][c];

        if (cell === player) {
            effective++;
            if (!consecutiveBroken) {
                consecutive++;
            }
        } else if (cell === 0) {
            if (!gapUsed) {
                // We found a gap. Check if we should jump it.
                // Look ahead 1 spot
                const nextR = r + dr;
                const nextC = c + dc;
                const isValidJump = 
                    nextR >= 0 && nextR < BOARD_SIZE && 
                    nextC >= 0 && nextC < BOARD_SIZE && 
                    board[nextR][nextC] === player;

                if (isValidJump) {
                    gapUsed = true;
                    consecutiveBroken = true; // Strict count stops here
                    // We do NOT count the empty spot as a stone for 'effective'
                    // We just continue the loop to find the next stone
                } else {
                    // It's a real open end
                    endType = 1;
                    break;
                }
            } else {
                // Second gap found (or gap already used). This is an open end.
                endType = 1;
                break;
            }
        } else {
            // Opponent stone -> Blocked
            endType = 0;
            break;
        }

        r += dr;
        c += dc;
    }
    return { consecutive: consecutive + 1, effective: effective + 1, endType };
}

export function findWinningMove(board: BoardState, player: Player): [number, number] | null {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue; 

            for (const [dr, dc] of DIRECTIONS) {
                const { consecutive } = detectPattern(board, r, c, dr, dc, player);
                // WIN CONDITION MUST BE STRICT (Consecutive)
                if (consecutive >= 5) {
                    return [r, c];
                }
            }
        }
    }
    return null;
}

export function findFour(board: BoardState, player: Player): [number, number] | null {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue; 

            for (const [dr, dc] of DIRECTIONS) {
                const { effective } = detectPattern(board, r, c, dr, dc, player);
                // "Four" can be split (X X _ X X), so we use effective count
                if (effective >= 4) {
                    return [r, c];
                }
            }
        }
    }
    return null;
}

export function findOpenThree(board: BoardState, player: Player): [number, number][] {
    const moves: [number, number][] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue;

            for (const [dr, dc] of DIRECTIONS) {
                const pattern = detectPattern(board, r, c, dr, dc, player);
                
                // Open Three can be split (X _ X X), so use effective count
                if (pattern.effective === 3 && pattern.openEnds === 2) {
                    moves.push([r, c]);
                    break; 
                }
            }
        }
    }
    return moves;
}

export function getForcingMoves(board: BoardState, player: Player): [number, number][] {
    const moves: [number, number][] = [];
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue;

            let isForcing = false;
            for (const [dr, dc] of DIRECTIONS) {
                const { effective } = detectPattern(board, r, c, dr, dc, player);
                // Fours (even split ones) are forcing
                if (effective >= 4) {
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

export function hasThreats(board: BoardState, player: Player): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) continue;

            for (const [dr, dc] of DIRECTIONS) {
                const { effective, openEnds } = detectPattern(board, r, c, dr, dc, player);
                if (effective >= 4) return true;
                if (effective === 3 && openEnds === 2) return true;
            }
        }
    }
    return false;
}