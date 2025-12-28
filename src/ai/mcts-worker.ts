import type { BoardState, Player, MCTSNode } from './types';
import { copyBoard, makeMove, checkWin, isValidMove, BOARD_SIZE } from '../utils/gameLogic';
import { findWinningMove, findFour, findOpenThree, detectPattern } from './patterns';

const UCB1_CONSTANT = 1.41;

function getCandidateMoves(board: BoardState): [number, number][]
{
    const moves: [number, number][] = [];
    let hasStones = false;

    for (let r = 0; r < BOARD_SIZE; r++)
    {
        for (let c = 0; c < BOARD_SIZE; c++)
        {
            if (board[r][c] !== 0)
            {
                hasStones = true;
                break;
            }
        }
        if (hasStones) break;
    }

    if (!hasStones)
    {
        const center = Math.floor(BOARD_SIZE / 2);
        return [[center, center]];
    }

    const occupied = new Set<string>();
    for (let r = 0; r < BOARD_SIZE; r++)
    {
        for (let c = 0; c < BOARD_SIZE; c++)
        {
            if (board[r][c] !== 0)
            {
                occupied.add(`${r},${c}`);
            }
        }
    }

    const candidates = new Set<string>();
    for (const pos of occupied)
    {
        const [r, c] = pos.split(',').map(Number);
        for (let dr = -2; dr <= 2; dr++)
        {
            for (let dc = -2; dc <= 2; dc++)
            {
                const nr = r + dr;
                const nc = c + dc;
                if (isValidMove(board, nr, nc))
                {
                    candidates.add(`${nr},${nc}`);
                }
            }
        }
    }

    for (const pos of candidates)
    {
        const [r, c] = pos.split(',').map(Number);
        moves.push([r, c]);
    }

    return moves;
}

function createNode(board: BoardState, move: [number, number] | null, parent: MCTSNode | null, player: Player): MCTSNode
{
    return {
        board: copyBoard(board),
        move,
        parent,
        children: new Map(),
        untriedMoves: getCandidateMoves(board),
        visits: 0,
        wins: 0,
        player
    };
}

function ucb1(node: MCTSNode, parentVisits: number): number
{
    if (node.visits === 0)
    {
        return Infinity;
    }
    
    const exploitation = node.wins / node.visits;
    const exploration = UCB1_CONSTANT * Math.sqrt(Math.log(parentVisits) / node.visits);
    return exploitation + exploration;
}

function selectChild(node: MCTSNode): MCTSNode
{
    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;

    for (const child of node.children.values())
    {
        const value = ucb1(child, node.visits);
        if (value > bestValue)
        {
            bestValue = value;
            bestChild = child;
        }
    }

    return bestChild!;
}

function select(node: MCTSNode): MCTSNode
{
    let current = node;
    
    while (current.untriedMoves.length === 0 && current.children.size > 0)
    {
        current = selectChild(current);
    }
    
    return current;
}

function expand(node: MCTSNode): MCTSNode
{
    if (node.untriedMoves.length === 0)
    {
        return node;
    }

    const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
    const move = node.untriedMoves[moveIndex];
    node.untriedMoves.splice(moveIndex, 1);

    const [row, col] = move;
    const nextPlayer = node.player === 1 ? 2 : 1;
    const newBoard = makeMove(node.board, row, col, nextPlayer);
    
    const child = createNode(newBoard, move, node, nextPlayer);
    node.children.set(`${row},${col}`, child);
    
    return child;
}

function smartPlayout(board: BoardState, player: Player): [number, number] | null
{
    const candidates = getCandidateMoves(board);
    if (candidates.length === 0) return null;

    const opponent = player === 1 ? 2 : 1;

    const myWin = findWinningMove(board, player);
    if (myWin) return myWin;

    const oppWin = findWinningMove(board, opponent);
    if (oppWin) return oppWin;

    const myFour = findFour(board, player);
    if (myFour) return myFour;

    const oppFour = findFour(board, opponent);
    if (oppFour) return oppFour;

    const oppThrees = findOpenThree(board, opponent);
    if (oppThrees.length > 0)
    {
        return oppThrees[0];
    }

    const myThrees = findOpenThree(board, player);
    if (myThrees.length > 0)
    {
        return myThrees[0];
    }

    return selectBestPositionalMove(board, candidates, player);
}

function selectBestPositionalMove(board: BoardState, candidates: [number, number][], player: Player): [number, number]
{
    let bestMove = candidates[0];
    let bestScore = -Infinity;

    for (const [r, c] of candidates)
    {
        const score = evaluatePosition(board, r, c, player);
        if (score > bestScore)
        {
            bestScore = score;
            bestMove = [r, c];
        }
    }

    return bestMove;
}

function evaluatePosition(board: BoardState, row: number, col: number, player: Player): number
{
    let score = 0;
    const opponent = player === 1 ? 2 : 1;

    const center = Math.floor(BOARD_SIZE / 2);
    const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
    score += (BOARD_SIZE - distanceFromCenter) * 2;

    // simulate placing the stone
    const tempBoard = makeMove(board, row, col, player);

    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dr, dc] of directions)
    {
        const myPattern = detectPattern(tempBoard, row, col, dr, dc, player);
        const oppPattern = detectPattern(board, row, col, dr, dc, opponent);

        // my patterns
        if (myPattern.count === 4)
        {
            score += 10000;
        }
        else if (myPattern.count === 3 && myPattern.openEnds === 2)
        {
            score += 1000;
        }
        else if (myPattern.count === 3 && myPattern.openEnds === 1)
        {
            score += 200;
        }
        else if (myPattern.count === 2 && myPattern.openEnds === 2)
        {
            score += 100;
        }
        else if (myPattern.count === 2 && myPattern.openEnds === 1)
        {
            score += 30;
        }
        else if (myPattern.count === 1 && myPattern.openEnds === 2)
        {
            score += 10;
        }

        // opponent patterns (defensive)
        if (oppPattern.count === 4)
        {
            score += 5000;
        }
        else if (oppPattern.count === 3 && oppPattern.openEnds === 2)
        {
            score += 800;
        }
        else if (oppPattern.count === 3 && oppPattern.openEnds === 1)
        {
            score += 150;
        }
        else if (oppPattern.count === 2 && oppPattern.openEnds === 2)
        {
            score += 80;
        }
        else if (oppPattern.count === 2 && oppPattern.openEnds === 1)
        {
            score += 25;
        }
    }

    let adjacentStones = 0;
    for (let dr = -1; dr <= 1; dr++)
    {
        for (let dc = -1; dc <= 1; dc++)
        {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] !== 0)
            {
                adjacentStones++;
            }
        }
    }
    score += adjacentStones * 10;

    return score;
}

function simulate(board: BoardState, player: Player): number
{
    let currentBoard = copyBoard(board);
    let currentPlayer = player;

    for (let i = 0; i < 225; i++)
    {
        const move = smartPlayout(currentBoard, currentPlayer);
        if (!move)
        {
            return 0.5;
        }

        const [row, col] = move;
        currentBoard = makeMove(currentBoard, row, col, currentPlayer);

        const result = checkWin(currentBoard, row, col);
        if (result.winner)
        {
            return result.winner === 2 ? 1 : 0;
        }

        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    return 0.5;
}

function backpropagate(node: MCTSNode | null, result: number): void
{
    let current = node;
    
    while (current !== null)
    {
        current.visits++;
        if (current.player === 2)
        {
            current.wins += result;
        }
        else
        {
            current.wins += (1 - result);
        }
        current = current.parent;
    }
}

function findBestMove(board: BoardState, iterations: number): [number, number]
{
    const immediateWin = findWinningMove(board, 2);
    if (immediateWin)
    {
        return immediateWin;
    }

    const blockOpponentWin = findWinningMove(board, 1);
    if (blockOpponentWin)
    {
        return blockOpponentWin;
    }

    const myFour = findFour(board, 2);
    if (myFour)
    {
        return myFour;
    }

    const oppFour = findFour(board, 1);
    if (oppFour)
    {
        return oppFour;
    }

    // block opponent's open threes (critical defensive move)
    const oppOpenThrees = findOpenThree(board, 1);
    if (oppOpenThrees.length > 0)
    {
        // if multiple open threes, prioritize blocking the most dangerous one
        // for now, just block the first one found
        return oppOpenThrees[0];
    }

    // create my own open three if possible
    const myOpenThrees = findOpenThree(board, 2);
    if (myOpenThrees.length > 0)
    {
        return myOpenThrees[0];
    }

    const root = createNode(board, null, null, 2);

    for (let i = 0; i < iterations; i++)
    {
        const node = select(root);
        const expandedNode = expand(node);
        const result = simulate(expandedNode.board, expandedNode.player === 1 ? 2 : 1);
        backpropagate(expandedNode, result);
    }

    let bestMove: [number, number] | null = null;
    let bestScore = -Infinity;

    for (const child of root.children.values())
    {
        if (child.visits === 0) continue;
        
        // combine win rate and visit count for better selection
        const winRate = child.wins / child.visits;
        const score = winRate * 0.7 + (child.visits / iterations) * 0.3;
        
        if (score > bestScore)
        {
            bestScore = score;
            bestMove = child.move!;
        }
    }

    // fallback: if no good move found, use most visited
    if (!bestMove)
    {
        let mostVisits = -1;
        for (const child of root.children.values())
        {
            if (child.visits > mostVisits)
            {
                mostVisits = child.visits;
                bestMove = child.move!;
            }
        }
    }

    return bestMove || getCandidateMoves(board)[0];
}

self.onmessage = function(e)
{
    const { board, iterations } = e.data;
    const bestMove = findBestMove(board, iterations);
    self.postMessage({ move: bestMove });
};