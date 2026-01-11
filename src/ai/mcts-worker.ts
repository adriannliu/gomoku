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
// Simple logic to handle standard openings and responses
function checkOpeningBook(board: BoardState): [number, number] | null {
    let stones: {r: number, c: number, p: number}[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) stones.push({r, c, p: board[r][c]});
        }
    }

    // 1. First move: Center
    if (stones.length === 0) return [7, 7];

    // 2. Second move (White): If Black played center, play diagonal
    if (stones.length === 1 && stones[0].r === 7 && stones[0].c === 7) return [8, 8]; 
    
    // 3. Third move (Black): If White played diagonal, play direct 3
    if (stones.length === 2) {
         const hasCenter = stones.some(s => s.r === 7 && s.c === 7);
         if (hasCenter) return [8, 7]; 
    }

    return null;
}

// --- Influence Map Helper ---
// biases random selection towards moves near existing stones
function getMoveWithInfluence(board: BoardState, candidates: number[]): number {
    if (candidates.length === 0) return -1;

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
    
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// --- VCF Solver ---
// Returns winning move if found via continuous threats, else null
function solveVCF(board: BoardState, player: Player, depth: number, startTime: number): [number, number] | null {
    if (depth === 0 || Date.now() - startTime > VCF_TIME_LIMIT) return null;

    // 1. Find all moves that create a Four (Forcing moves)
    const forcingMoves = getForcingMoves(board, player);
    if (forcingMoves.length === 0) return null;

    for (const [r, c] of forcingMoves) {
        const nextBoard = makeMove(board, r, c, player);
        
        // Did we win immediately? (Five)
        if (checkWin(nextBoard, r, c).winner === player) {
            return [r, c];
        }

        // Opponent must block. We calculate their forced response.
        const opponent = player === 1 ? 2 : 1;
        
        // Find where the opponent MUST play to stop the win
        const threat = findWinningMove(nextBoard, player); 
        if (!threat) continue; 

        const [blockR, blockC] = threat;

        // Opponent makes the forced block
        const blockedBoard = makeMove(nextBoard, blockR, blockC, opponent);

        // Does opponent win by blocking?
        if (checkWin(blockedBoard, blockR, blockC).winner === opponent) {
             continue; 
        }

        // Recursive Step: Can we win from this new state?
        const result = solveVCF(blockedBoard, player, depth - 1, startTime);
        if (result) {
            return [r, c]; // This move leads to a win
        }
    }

    return null;
}


function getCandidateMoves(board: BoardState): number[] {
    const moves: number[] = [];
    const occupied = new Int8Array(BOARD_SIZE * BOARD_SIZE);
    let hasStones = false;

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

    const candidates = new Int8Array(BOARD_SIZE * BOARD_SIZE);
    const radius = 2; 

    // Collect empty spots within radius 2 of any stone
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

// --- TSS (Threat Space Search) Integration ---
function getExpansionMoves(board: BoardState, player: Player): number[] {
    const opponent = player === 1 ? 2 : 1;
    
    // Check if we are under threat (Opponent can make 5 or 4)
    const blockWin = findWinningMove(board, opponent);
    const oppForcing = getForcingMoves(board, opponent);
    
    const isUnderThreat = blockWin || oppForcing.length > 0;

    if (isUnderThreat) {
        const tacticalMoves = new Set<number>();
        
        // A. Must block immediate win
        if (blockWin) {
            tacticalMoves.add(toIndex(blockWin[0], blockWin[1]));
        }
        
        // B. Block potential Fours
        for (const [r, c] of oppForcing) {
            tacticalMoves.add(toIndex(r, c));
        }
        
        // C. Or create a stronger counter-threat (Make 4 or 5)
        const myForcing = getForcingMoves(board, player);
        for (const [r, c] of myForcing) {
            tacticalMoves.add(toIndex(r, c));
        }
        
        const myWins = findWinningMove(board, player);
        if (myWins) {
            return [toIndex(myWins[0], myWins[1])]; 
        }

        if (tacticalMoves.size > 0) {
            return Array.from(tacticalMoves);
        }
    }
    
    return getCandidateMoves(board);
}

function createNode(board: BoardState, move: [number, number] | null, parent: MCTSNode | null, player: Player): MCTSNode {
    return {
        board: copyBoard(board),
        move,
        parent,
        children: new Map(), 
        untriedMoves: getExpansionMoves(board, player),
        visits: 0,
        wins: 0,
        player
    };
}

function ucb1(child: MCTSNode, parentVisits: number): number {
    if (child.visits === 0) return Infinity;

    const winRate = child.wins / child.visits;
    const exploitation = winRate; 
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
    const moveIdx = node.untriedMoves[moveIndex]; 
    node.untriedMoves.splice(moveIndex, 1);

    const [row, col] = fromIndex(moveIdx);
    const nextPlayer = node.player === 1 ? 2 : 1;
    const newBoard = makeMove(node.board, row, col, nextPlayer);

    const child = createNode(newBoard, [row, col], node, nextPlayer);
    node.children.set(moveIdx, child);

    return child;
}

function simulate(board: BoardState, player: Player, aiPlayer: Player): number {
    const currentBoard = board.map(row => [...row]); 
    let currentPlayer = player;
    
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
                moveIdx = getMoveWithInfluence(currentBoard, candidates);
                
                if (moveIdx === -1) break; 
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
    
    // A. Offense: Can we force a win?
    const myVCF = solveVCF(board, aiPlayer, VCF_MAX_DEPTH, startTime);
    if (myVCF) return myVCF;

    // B. Defense: Can they force a win?
    // Note: We check this to BLOCK it immediately.
    const oppVCF = solveVCF(board, opponent, VCF_MAX_DEPTH, Date.now());
    if (oppVCF) return oppVCF;

    // Standard Instincts (Fallbacks)
    const oppFour = findFour(board, opponent);
    if (oppFour) return oppFour;

    const myFour = findFour(board, aiPlayer);
    if (myFour) return myFour;

    const oppOpenThrees = findOpenThree(board, opponent);
    if (oppOpenThrees.length > 0) return oppOpenThrees[0];
    
    // 3. MCTS LAYER
    const root = createNode(board, null, null, opponent);
    const safeIterations = Math.max(iterations, 1000);

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