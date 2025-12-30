import type { BoardState, Player, MCTSNode } from './types';
import { copyBoard, makeMove, checkWin, BOARD_SIZE } from '../utils/gameLogic';
import { findWinningMove, findFour, findOpenThree, getForcingMoves } from './patterns';

const UCB1_CONSTANT = 1.41;
const VCF_MAX_DEPTH = 12; // Limit depth for VCF search
const VCF_TIME_LIMIT = 50; // ms

// --- Helper: Fast Coordinate Mapping ---
const toIndex = (r: number, c: number) => r * BOARD_SIZE + c;
const fromIndex = (i: number): [number, number] => [Math.floor(i / BOARD_SIZE), i % BOARD_SIZE];

// --- Opening Book ---
// Simple dictionary for first few moves (Center starts at 7,7)
// Note: We implement checkOpeningBook with logic rather than strict dictionary lookup 
// to handle transpositions or simple state matching better.

function checkOpeningBook(board: BoardState): [number, number] | null {
    // Match specific board states for first 1-3 moves
    let stones: {r: number, c: number, p: number}[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) stones.push({r, c, p: board[r][c]});
        }
    }

    if (stones.length === 0) return [7, 7];
    if (stones.length === 1 && stones[0].r === 7 && stones[0].c === 7) return [8, 8]; // If we are white and they played center
    
    // If we are Black (stones=2) and we played 7,7 and they played 8,8 (or equivalent)
    if (stones.length === 2) {
         // Check if one is 7,7
         const hasCenter = stones.some(s => s.r === 7 && s.c === 7);
         if (hasCenter) return [8, 7]; // Play direct 3
    }

    return null;
}

// --- Influence Map Helper ---
function getMoveWithInfluence(board: BoardState, candidates: number[]): number {
    // If no candidates, return -1
    if (candidates.length === 0) return -1;

    // Simple Influence: +1 for each neighbor (radius 2)
    // We want to pick a candidate with high overlap.
    // Instead of full map, just score candidates.
    let bestScore = -1;
    let bestMoves: number[] = [];
    
    const radius = 2;

    for (const moveIdx of candidates) {
        const [r, c] = fromIndex(moveIdx);
        let score = 0;
        
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    if (board[nr][nc] !== 0) {
                        score++;
                    }
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [moveIdx];
        } else if (score === bestScore) {
            bestMoves.push(moveIdx);
        }
    }
    
    // Randomly pick from best moves to maintain variety but biased
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// --- VCF Solver ---
// Returns winning move if found, else null
function solveVCF(board: BoardState, player: Player, depth: number, startTime: number): [number, number] | null {
    if (depth === 0 || Date.now() - startTime > VCF_TIME_LIMIT) return null;

    // 1. Find all moves that create a Four (Forcing moves)
    const forcingMoves = getForcingMoves(board, player);
    if (forcingMoves.length === 0) return null;

    // Sort to prioritize moves closer to existing stones or center? 
    // For now, just iterate.

    for (const [r, c] of forcingMoves) {
        // Try move
        const nextBoard = makeMove(board, r, c, player);
        
        // Did we win? (Five)
        if (checkWin(nextBoard, r, c).winner === player) {
            return [r, c];
        }

        // Opponent must block.
        // We need to find the opponent's forced response.
        // If we created a "Four", the opponent MUST play on the open end(s).
        // If we created a "Broken Four" (X X _ X X), they must play the gap.
        
        const opponent = player === 1 ? 2 : 1;
        // Find opponent's winning move (which is the block for our 4)
        // If opponent has a winning move (making 5), then our previous move was suicide (unless we already won, checked above).
        // Wait, here we look for opponent's "Four" counters.
        // Actually, if we made a 4, the opponent needs to block it. 
        // Blocking it means playing on a spot that prevents us from making 5 next turn.
        // That spot is exactly where *we* would play to make 5.
        
        const threat = findWinningMove(nextBoard, player); // Where we would win next
        if (!threat) {
             // We didn't create a real threat? (Maybe it was a blocked 4? But getForcingMoves checks count >=4)
             // If count >= 4 and we didn't win, it must be an open 3 that became open 4, or broken 4.
             // If it's a blocked 4, it's not a threat unless we have another line.
             // Let's assume valid threats exist.
             continue; 
        }

        // The opponent MUST play 'threat' to block us.
        // (Assuming single threat. If double threat (4-3 or 4-4), we win next turn regardless of block, 
        // but findWinningMove only returns one. In VCF, we assume single path dominance usually).
        
        const blockR = threat[0];
        const blockC = threat[1];

        // Opponent makes the forced block
        const blockedBoard = makeMove(nextBoard, blockR, blockC, opponent);

        // Does opponent win by blocking? (e.g. they made 5)
        if (checkWin(blockedBoard, blockR, blockC).winner === opponent) {
             continue; // This line fails, opponent wins
        }

        // Continue search
        const result = solveVCF(blockedBoard, player, depth - 1, startTime);
        if (result) {
            // Found a winning path starting with this move
            return [r, c];
        }
    }

    return null;
}


function getCandidateMoves(board: BoardState): number[] {
    const moves: number[] = [];
    const occupied = new Int8Array(BOARD_SIZE * BOARD_SIZE);
    let hasStones = false;

    // 1. Mark occupied spots
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) {
                occupied[r * BOARD_SIZE + c] = 1;
                hasStones = true;
            }
        }
    }

    if (!hasStones) {
        const center = Math.floor(BOARD_SIZE / 2);
        return [toIndex(center, center)];
    }

    // 2. Collect empty spots within radius 2 of any stone
    // Optimization: Use a Set or boolean array to avoid duplicates if iterating stones
    // Current approach scans full board which is O(N^2). Fine for 15x15.
    
    const candidates = new Int8Array(BOARD_SIZE * BOARD_SIZE);
    const radius = 2; 

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (occupied[r * BOARD_SIZE + c] === 1) {
                for (let dr = -radius; dr <= radius; dr++) {
                    for (let dc = -radius; dc <= radius; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                            const idx = nr * BOARD_SIZE + nc;
                            if (occupied[idx] === 0) {
                                candidates[idx] = 1; 
                            }
                        }
                    }
                }
            }
        }
    }

    for (let i = 0; i < candidates.length; i++) {
        if (candidates[i] === 1) {
            moves.push(i);
        }
    }

    return moves;
}

// --- TSS Integration ---
function getExpansionMoves(board: BoardState, player: Player): number[] {
    const opponent = player === 1 ? 2 : 1;
    
    // Check if we are under threat (Opponent can make 5 or 4)
    // 1. Check "Five" threat (Opponent can win immediately)
    const blockWin = findWinningMove(board, opponent);
    
    // 2. Check "Four" threat (Opponent can make a 4, forcing us)
    const oppForcing = getForcingMoves(board, opponent);
    
    const isUnderThreat = blockWin || oppForcing.length > 0;

    if (isUnderThreat) {
        const tacticalMoves = new Set<number>();
        
        // A. Must block
        if (blockWin) {
            // If they can win, we MUST play there (unless we can win ourselves immediately, handled below)
            tacticalMoves.add(toIndex(blockWin[0], blockWin[1]));
        }
        
        for (const [r, c] of oppForcing) {
            // These are moves the opponent WANTS to play.
            // We can block them by playing there ourselves.
            // Or we can play a move that defends (e.g. extending our own line).
            // For TSS, we treat "occupying the threat spot" as the primary block.
            tacticalMoves.add(toIndex(r, c));
        }
        
        // B. Or we create a stronger counter-threat (Make 4 or 5)
        const myForcing = getForcingMoves(board, player);
        for (const [r, c] of myForcing) {
            tacticalMoves.add(toIndex(r, c));
        }
        
        const myWins = findWinningMove(board, player);
        if (myWins) {
            // If we can win, that overrides everything!
            return [toIndex(myWins[0], myWins[1])]; 
        }

        if (tacticalMoves.size > 0) {
            return Array.from(tacticalMoves);
        }
    }
    
    // If no immediate threats, return standard candidates (Radius 2)
    return getCandidateMoves(board);
}

function createNode(board: BoardState, move: [number, number] | null, parent: MCTSNode | null, player: Player): MCTSNode {
    return {
        board: copyBoard(board),
        move,
        parent,
        children: new Map(), 
        untriedMoves: getExpansionMoves(board, player), // Use TSS Logic
        visits: 0,
        wins: 0,
        player
    };
}

function ucb1(child: MCTSNode, parentVisits: number): number {
    if (child.visits === 0) return Infinity;

    const winRate = child.wins / child.visits;
    // Invert win rate: We want the move where the opponent loses.
    const exploitation = 1 - winRate; 
    
    const exploration = UCB1_CONSTANT * Math.sqrt(Math.log(parentVisits) / child.visits);
    return exploitation + exploration;
}

function selectChild(node: MCTSNode): MCTSNode {
    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;

    for (const child of node.children.values()) {
        const value = ucb1(child, node.visits);
        if (value > bestValue) {
            bestValue = value;
            bestChild = child;
        }
    }
    return bestChild!;
}

function select(node: MCTSNode): MCTSNode {
    let current = node;
    while (current.untriedMoves.length === 0 && current.children.size > 0) {
        current = selectChild(current);
    }
    return current;
}

function expand(node: MCTSNode): MCTSNode {
    if (node.untriedMoves.length === 0) return node;

    const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
    const moveIdx = node.untriedMoves[moveIndex]; // Pure integer
    node.untriedMoves.splice(moveIndex, 1);

    const [row, col] = fromIndex(moveIdx);
    const nextPlayer = node.player === 1 ? 2 : 1;
    const newBoard = makeMove(node.board, row, col, nextPlayer);

    const child = createNode(newBoard, [row, col], node, nextPlayer);
    
    // Use integer key directly
    node.children.set(moveIdx, child);

    return child;
}

function simulate(board: BoardState, player: Player, aiPlayer: Player): number {
    const currentBoard = board.map(row => [...row]); 
    let currentPlayer = player;
    
    // Get candidates once at the start? 
    // The board changes, so valid moves change. 
    // Optimizing simulate is key.
    // Re-calculating candidates every step is slow.
    // Standard MCTS keeps a list of available moves.
    // For Gomoku, we only care about moves near stones.
    // Let's use the loose "candidates" list from start, updating it?
    // Too complex for zero-allocation strictness. 
    // Let's stick to generating candidates but maybe optimize frequency.
    
    for (let i = 0; i < 225; i++) {
        let moveIdx = -1;

        // 1. Check Immediate Win
        const winMove = findWinningMove(currentBoard, currentPlayer);
        if (winMove) {
            moveIdx = toIndex(winMove[0], winMove[1]);
        } else {
            // 2. Block Immediate Loss
            const opponent = currentPlayer === 1 ? 2 : 1;
            const blockMove = findWinningMove(currentBoard, opponent);
            if (blockMove) {
                moveIdx = toIndex(blockMove[0], blockMove[1]);
            } else {
                // 3. Positional Influence (Soft Random)
                const candidates = getCandidateMoves(currentBoard);
                // Bias selection
                moveIdx = getMoveWithInfluence(currentBoard, candidates);
                
                if (moveIdx === -1) {
                     // No moves left
                     break; 
                }
            }
        }

        if (moveIdx === -1) break; 

        const [r, c] = fromIndex(moveIdx);
        if (currentBoard[r][c] !== 0) break; // Safety
        
        currentBoard[r][c] = currentPlayer;

        const result = checkWin(currentBoard, r, c);
        if (result.winner) {
            return result.winner === aiPlayer ? 1 : 0;
        }

        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    return 0.5;
}


function backpropagate(node: MCTSNode | null, result: number, aiPlayer: Player): void {
    let current = node;
    while (current !== null) {
        current.visits++;
        if (current.player === aiPlayer) {
            current.wins += result;
        } else {
            current.wins += (1 - result);
        }
        current = current.parent;
    }
}

function findBestMove(board: BoardState, iterations: number, aiPlayer: Player): [number, number] {
    const opponent = aiPlayer === 1 ? 2 : 1;
    
    // 0. OPENING BOOK
    const bookMove = checkOpeningBook(board);
    if (bookMove) return bookMove;

    // 1. INSTINCT LAYER
    const immediateWin = findWinningMove(board, aiPlayer);
    if (immediateWin) return immediateWin;

    const blockOpponentWin = findWinningMove(board, opponent);
    if (blockOpponentWin) return blockOpponentWin;

    // 2. VCF SOLVER (Victory by Continuous Fours)
    const startTime = Date.now();
    
    // A. Check for OUR VCF (Offense)
    // Try to find a forced win for us.
    const myVCF = solveVCF(board, aiPlayer, VCF_MAX_DEPTH, startTime);
    if (myVCF) return myVCF;

    // B. Check for OPPONENT VCF (Defense)
    // If opponent has a forced win, we MUST block the starting move.
    // Note: This assumes taking their starting square breaks the chain.
    // (Usually true in Gomoku as the start move is the first "Four")
    const oppVCF = solveVCF(board, opponent, VCF_MAX_DEPTH, Date.now());
    if (oppVCF) return oppVCF;

    // Standard Instincts (Fallbacks before expensive MCTS)
    const oppFour = findFour(board, opponent);
    if (oppFour) return oppFour;

    const myFour = findFour(board, aiPlayer);
    if (myFour) return myFour;

    const oppOpenThrees = findOpenThree(board, opponent);
    if (oppOpenThrees.length > 0) return oppOpenThrees[0];
    
    // 3. MCTS LAYER
    const root = createNode(board, null, null, aiPlayer);
    const safeIterations = Math.max(iterations, 1000);

    // Adjust iterations if VCF took time? 
    // VCF has time limit (50ms), so it shouldn't eat too much into MCTS budget.
    
    for (let i = 0; i < safeIterations; i++) {
        const node = select(root);
        
        let isTerminal = false;
        if (node.move) {
            const winState = checkWin(node.board, node.move[0], node.move[1]);
            if (winState.winner) {
                const result = winState.winner === aiPlayer ? 1 : 0;
                backpropagate(node, result, aiPlayer);
                isTerminal = true;
            }
        }

        if (!isTerminal) {
            const expandedNode = expand(node);
            const result = simulate(expandedNode.board, expandedNode.player === aiPlayer ? opponent : aiPlayer, aiPlayer);
            backpropagate(expandedNode, result, aiPlayer);
        }
    }

    let bestChild: MCTSNode | null = null;
    let maxVisits = -1;

    for (const child of root.children.values()) {
        if (child.visits > maxVisits) {
            maxVisits = child.visits;
            bestChild = child;
        }
    }

    if (bestChild && bestChild.move) {
        return bestChild.move;
    }

    const fallback = getCandidateMoves(board);
    // Use influence for fallback too
    const fallbackIdx = getMoveWithInfluence(board, fallback);
    if (fallbackIdx !== -1) return fromIndex(fallbackIdx);
    
    return [7, 7];
}


self.onmessage = function(e) {
    const { board, iterations, aiPlayer } = e.data;
    try {
        const bestMove = findBestMove(board, iterations || 3000, aiPlayer || 2);
        self.postMessage({ move: bestMove });
    } catch (err) {
        console.error("Worker MCTS Error:", err);
        self.postMessage({ move: null }); 
    }
};