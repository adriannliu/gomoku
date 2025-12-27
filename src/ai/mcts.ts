import type { BoardState, Player, MCTSNode } from './types';
import { copyBoard, makeMove, checkWin, isValidMove, BOARD_SIZE } from '../utils/gameLogic';

const UCB1_CONSTANT = 1.41; //root 2

function createNode(board: BoardState, move: [number,number] | null, parent: MCTSNode | null, player: Player): MCTSNode
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

function getCandidateMoves(board: BoardState): [number,number][]
{
    const moves: [number,number][] = [];
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
        const center = Math.floor(BOARD_SIZE/2);
        return [[center,center]];
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
        const [r,c] = pos.split(',').map(Number);
        for (let dr = -2; dr <= 2; dr++)
        {
            for (let dc = -2; dc <= 2; dc++)
            {
                const nr = r + dr;
                const nc = c + dc;
                if (isValidMove(board,nr,nc))
                {
                    candidates.add(`${nr},${nc}`);
                }
            }
        }
    }

    for (const pos of candidates)
    {
        const [r,c] = pos.split(',').map(Number);
        moves.push([r,c]);
    }
    return moves;
}

function ucb1(node: MCTSNode, parentVisits: number): number
{
    if(node.visits === 0) return Infinity;

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
    if (node.untriedMoves.length === 0) return node;

    const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
    const move = node.untriedMoves[moveIndex];
    node.untriedMoves.splice(moveIndex,1);

    const [row,col] = move;
    const nextPlayer = node.player === 1 ? 2:1;
    const newBoard = makeMove(node.board,row,col,nextPlayer);

    const child = createNode(newBoard, move, node, nextPlayer);
    node.children.set(`${row},${col}`, child);

    return child;
}

function simulate(board: BoardState, player: Player): number
{
    let currentBoard = copyBoard(board);
    let currentPlayer = player;
    let lastMove: [number,number] | null = null;

    for (let i = 0; i < 225; i++)
    {
        const moves = getCandidateMoves(currentBoard);
        if (moves.length === 0) return 0.5;

        const move = moves[Math.floor(Math.random() * moves.length)];
        const [row,col] = move;
        currentBoard = makeMove(currentBoard, row, col, currentPlayer);
        lastMove = move;

        const result = checkWin(currentBoard, row, col);
        if (result.winner)
        {
            return result.winner === 2 ? 1:0;
        }

        currentPlayer = currentPlayer === 1 ? 2:1;
    }

    return 0.5;
}

function backpropagate(node: MCTSNode | null, result:number): void
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
            current.wins += (1-result);
        }
        current = current.parent;
    }
}

export function findBestMove(board: BoardState, iterations: number = 5000): [number,number]
{
    const root = createNode(board,null,null,1);

    for (let i = 0; i < iterations; i++)
    {
        const node = select(root);
        const expandedNode = expand(node);
        const result = simulate(expandedNode.board, expandedNode.player === 1 ? 2:1);
        backpropagate(expandedNode, result);
    }

    let bestMove: [number,number] | null = null;
    let mostVisits = -1;

    for (const [key,child] of root.children)
    {
        if (child.visits > mostVisits)
        {
            mostVisits = child.visits;
            bestMove = child.move!;
        }
    }

    return bestMove || getCandidateMoves(board)[0];
}