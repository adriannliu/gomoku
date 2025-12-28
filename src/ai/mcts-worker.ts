import type { BoardState, Player, MCTSNode } from './types';
import { copyBoard, makeMove, checkWin, BOARD_SIZE } from '../utils/gameLogic';
import { findWinningMove, findFour, findOpenThree } from './patterns';

const UCB1_CONSTANT = 1.41;

// --- Helper: Fast Coordinate Mapping ---
const toIndex = (r: number, c: number) => r * BOARD_SIZE + c;
const fromIndex = (i: number): [number, number] => [Math.floor(i / BOARD_SIZE), i % BOARD_SIZE];

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

function createNode(board: BoardState, move: [number, number] | null, parent: MCTSNode | null, player: Player): MCTSNode {
    return {
        board: copyBoard(board),
        move,
        parent,
        children: new Map(), // Now Map<number, MCTSNode>
        untriedMoves: getCandidateMoves(board), // Now number[]
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
    
    const candidates = getCandidateMoves(currentBoard); // Returns number[]

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
                // 3. Random Valid Move
                let attempts = 0;
                while (attempts < 15) {
                    const rnd = candidates[Math.floor(Math.random() * candidates.length)];
                    const [r, c] = fromIndex(rnd);
                    if (currentBoard[r][c] === 0) {
                        moveIdx = rnd;
                        break;
                    }
                    attempts++;
                }
            }
        }

        if (moveIdx === -1) break; 

        const [r, c] = fromIndex(moveIdx);
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
    
    // 1. INSTINCT LAYER
    const immediateWin = findWinningMove(board, aiPlayer);
    if (immediateWin) return immediateWin;

    const blockOpponentWin = findWinningMove(board, opponent);
    if (blockOpponentWin) return blockOpponentWin;

    const oppFour = findFour(board, opponent);
    if (oppFour) return oppFour;

    const myFour = findFour(board, aiPlayer);
    if (myFour) return myFour;

    const oppOpenThrees = findOpenThree(board, opponent);
    if (oppOpenThrees.length > 0) return oppOpenThrees[0];
    
    // 2. MCTS LAYER
    const root = createNode(board, null, null, aiPlayer);
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
    if (fallback.length > 0) return fromIndex(fallback[0]);
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