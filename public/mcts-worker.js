const BOARD_SIZE = 15;
const UCB1_CONSTANT = 1.41;

function copyBoard(board)
{
    return board.map(row => [...row]);
}

function makeMove(board, row, col, player)
{
    const newBoard = copyBoard(board);
    newBoard[row][col] = player;
    return newBoard;
}

function isValidMove(board, row, col)
{
    return row >= 0 && row < BOARD_SIZE && 
           col >= 0 && col < BOARD_SIZE && 
           board[row][col] === 0;
}

function checkWin(board, lastRow, lastCol)
{
    const player = board[lastRow][lastCol];
    if (player === 0) return { winner: null };

    const directions = [
        [[0, 1], [0, -1]],
        [[1, 0], [-1, 0]],
        [[1, 1], [-1, -1]],
        [[1, -1], [-1, 1]]
    ];

    for (const [dir1, dir2] of directions)
    {
        let count = 1;
        
        for (const [dr, dc] of [dir1, dir2])
        {
            let r = lastRow + dr;
            let c = lastCol + dc;
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && 
                   board[r][c] === player)
            {
                count++;
                r += dr;
                c += dc;
            }
        }
        
        if (count >= 5)
        {
            return { winner: player };
        }
    }

    return { winner: null };
}

function getCandidateMoves(board)
{
    const moves = [];
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

    const occupied = new Set();
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

    const candidates = new Set();
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

function createNode(board, move, parent, player)
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

function ucb1(node, parentVisits)
{
    if (node.visits === 0)
    {
        return Infinity;
    }
    
    const exploitation = node.wins / node.visits;
    const exploration = UCB1_CONSTANT * Math.sqrt(Math.log(parentVisits) / node.visits);
    return exploitation + exploration;
}

function selectChild(node)
{
    let bestChild = null;
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

    return bestChild;
}

function select(node)
{
    let current = node;
    
    while (current.untriedMoves.length === 0 && current.children.size > 0)
    {
        current = selectChild(current);
    }
    
    return current;
}

function expand(node)
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

function simulate(board, player)
{
    let currentBoard = copyBoard(board);
    let currentPlayer = player;
    let lastMove = null;

    for (let i = 0; i < 225; i++)
    {
        const moves = getCandidateMoves(currentBoard);
        if (moves.length === 0)
        {
            return 0.5;
        }

        const move = moves[Math.floor(Math.random() * moves.length)];
        const [row, col] = move;
        currentBoard = makeMove(currentBoard, row, col, currentPlayer);
        lastMove = move;

        const result = checkWin(currentBoard, row, col);
        if (result.winner)
        {
            return result.winner === 2 ? 1 : 0;
        }

        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    return 0.5;
}

function backpropagate(node, result)
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

function findBestMove(board, iterations)
{
    const root = createNode(board, null, null, 1);

    for (let i = 0; i < iterations; i++)
    {
        const node = select(root);
        const expandedNode = expand(node);
        const result = simulate(expandedNode.board, expandedNode.player === 1 ? 2 : 1);
        backpropagate(expandedNode, result);
    }

    let bestMove = null;
    let mostVisits = -1;

    for (const [key, child] of root.children)
    {
        if (child.visits > mostVisits)
        {
            mostVisits = child.visits;
            bestMove = child.move;
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