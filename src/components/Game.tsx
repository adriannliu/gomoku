import { useState, useEffect, useRef } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import type { BoardState, Player } from "../ai/types";
import {
    createEmptyBoard,
    makeMove,
    checkWin,
    isValidMove,
    isBoardFull,
    BOARD_SIZE,
} from "../utils/gameLogic";
import Board from "./Board";
import MctsWorker from "../ai/mcts-worker.ts?worker";

type GameMode = "human" | "ai";

export default function Game() {
    const [board, setBoard] = useState<BoardState>(createEmptyBoard());
    const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<Player | null>(null);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [gameMode, setGameMode] = useState<GameMode>("ai");
    const [aiPlayer, setAiPlayer] = useState<Player>(2);
    const [showMoveNumbers, setShowMoveNumbers] = useState(true);
    const [showAbout, setShowAbout] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
    const [moveNumbers, setMoveNumbers] = useState<number[][]>(
        Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0))
    );
    const [moveCount, setMoveCount] = useState(0);
    const workerRef = useRef<Worker | null>(null);
    const modalContentRef = useRef<HTMLDivElement>(null);

    const handleTooltipClick = (term: string, e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        if (activeTooltip === term) {
            setActiveTooltip(null);
            setTooltipPosition(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const modalRect = modalContentRef.current?.getBoundingClientRect();
            if (modalRect) {
                // Position tooltip below the clicked element, centered horizontally
                const top = rect.bottom - modalRect.top + 10; // 10px below
                const left = Math.max(20, Math.min(
                    rect.left - modalRect.left + (rect.width / 2) - 150, // Center on element, max 150px offset
                    modalRect.width - 320 // Don't overflow right (tooltip is ~300px wide)
                ));
                setTooltipPosition({ top, left });
                setActiveTooltip(term);
            }
        }
    };

    const tooltipData: Record<string, { description: string; link?: string; linkText?: string; formula?: string; formulaExplanation?: string }> = {
        "MCTS": {
            description: "Monte Carlo Tree Search is a heuristic search algorithm for decision-making. It builds a search tree by randomly sampling the search space, using the results to guide future exploration. MCTS is particularly effective in games with large state spaces where exhaustive search is impossible.",
            link: "https://en.wikipedia.org/wiki/Monte_Carlo_tree_search",
            linkText: "Learn more on Wikipedia"
        },
        "Monte Carlo Tree Search": {
            description: "Monte Carlo Tree Search is a heuristic search algorithm for decision-making. It builds a search tree by randomly sampling the search space, using the results to guide future exploration. MCTS is particularly effective in games with large state spaces where exhaustive search is impossible.",
            link: "https://en.wikipedia.org/wiki/Monte_Carlo_tree_search",
            linkText: "Learn more on Wikipedia"
        },
        "UCB1": {
            description: "Upper Confidence Bound 1 is a formula used in MCTS to balance exploration (trying new moves) and exploitation (using moves that seem good). It ensures the algorithm explores promising areas while not ignoring potentially better options.",
            formula: "\\text{UCB1} = \\frac{w_i}{n_i} + C \\sqrt{\\frac{\\ln N}{n_i}}",
            formulaExplanation: "where w_i is wins, n_i is visits for child i, N is parent visits, and C is a constant (typically sqrt2).",
            link: "https://en.wikipedia.org/wiki/Multi-armed_bandit#Upper_confidence_bounds",
            linkText: "Learn more about UCB"
        },
        "instinct layer": {
            description: "The instinct layer is a heuristic pre-processing step that checks for critical tactical patterns before running the computationally expensive MCTS algorithm. It handles immediate wins, blocks, and threats that require urgent responses, making the AI more efficient and tactically sound.",
            link: undefined
        },
        "Open threes": {
            description: "An open three is a pattern of three stones in a row with open spaces on both ends. This is a powerful threat because it creates two potential ways to form a winning five-in-a-row, forcing the opponent to block one while the player can complete the other.",
            link: undefined
        },
        "Threat creation": {
            description: "Threat creation is a strategic concept where a player builds multiple winning threats simultaneously. If a player creates two or more threats at once, the opponent can only block one, allowing the player to win on the next turn. This is a key winning strategy in Gomoku.",
            link: undefined
        },
        "Backpropagates": {
            description: "Backpropagation in MCTS is the process of updating statistics (wins and visits) along the path from a simulated game result back to the root of the tree. This allows the algorithm to learn which moves lead to good outcomes and adjust its strategy accordingly.",
            link: undefined
        }
    };

    useEffect(() => {
        workerRef.current = new MctsWorker();

        workerRef.current.onmessage = (e) => {
            const { move } = e.data;
            if (!move) {
                setIsAiThinking(false);
                return;
            }
            const [row, col] = move;

            const newBoard = makeMove(board, row, col, aiPlayer);
            setBoard(newBoard);

            const newMoveCount = moveCount + 1;
            setMoveCount(newMoveCount);
            const newMoveNumbers = moveNumbers.map(r => [...r]);
            newMoveNumbers[row][col] = newMoveCount;
            setMoveNumbers(newMoveNumbers);

            const result = checkWin(newBoard, row, col);
            if (result.winner) {
                setWinner(result.winner);
                setGameOver(true);
                setIsAiThinking(false);
                return;
            }

            if (isBoardFull(newBoard)) {
                setGameOver(true);
                setIsAiThinking(false);
                return;
            }

            // Set to the human player (opposite of AI)
            setCurrentPlayer(aiPlayer === 1 ? 2 : 1);
            setIsAiThinking(false);
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, [board]);

    useEffect(() => {
        if (
            gameMode === "ai" &&
            currentPlayer === aiPlayer &&
            !gameOver &&
            !isAiThinking
        ) {
            setIsAiThinking(true);
            workerRef.current?.postMessage({ board, iterations: 3000, aiPlayer });
        }
    }, [currentPlayer, gameOver, board, isAiThinking, gameMode, aiPlayer]);

    const handleCellClick = (row: number, col: number) => {
        if (gameOver || !isValidMove(board, row, col) || isAiThinking) {
            return;
        }

        if (gameMode === "ai" && currentPlayer === aiPlayer) {
            return;
        }

        const newBoard = makeMove(board, row, col, currentPlayer);
        setBoard(newBoard);

        const newMoveCount = moveCount + 1;
        setMoveCount(newMoveCount);
        const newMoveNumbers = moveNumbers.map(r => [...r]);
        newMoveNumbers[row][col] = newMoveCount;
        setMoveNumbers(newMoveNumbers);

        const result = checkWin(newBoard, row, col);
        if (result.winner) {
            setWinner(result.winner);
            setGameOver(true);
            return;
        }

        if (isBoardFull(newBoard)) {
            setGameOver(true);
            return;
        }

        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    };

    const resetGame = () => {
        setBoard(createEmptyBoard());
        setCurrentPlayer(1);
        setGameOver(false);
        setWinner(null);
        setIsAiThinking(false);
        setMoveCount(0);
        setMoveNumbers(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0)));
    };

    const toggleAiPlayer = () => {
        setAiPlayer(aiPlayer === 1 ? 2 : 1);
        resetGame();
    };

    const toggleMode = () => {
        setGameMode(gameMode === "ai" ? "human" : "ai");
        resetGame();
    };

    return (
        <div style={{ 
            padding: "20px", 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center"
        }}>
            <h1 style={{ marginBottom: "20px", textAlign: "center" }}>Gomoku</h1>
            <div style={{ marginBottom: "15px", display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={toggleMode}>
                    Mode: {gameMode === "ai" ? "vs AI" : "vs Human"}
                </button>
                {gameMode === "ai" && (
                    <button onClick={toggleAiPlayer}>
                        AI is Player {aiPlayer} ({aiPlayer === 1 ? "Black" : "White"})
                    </button>
                )}
                <button onClick={() => setShowMoveNumbers(!showMoveNumbers)}>
                    {showMoveNumbers ? "Hide" : "Show"} Move Numbers
                </button>
                <button onClick={() => setShowAbout(true)}>
                    About
                </button>
            </div>
            <div style={{ marginBottom: "15px", minHeight: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {gameOver
                    ? winner
                        ? `Player ${winner} wins!`
                        : "Draw!"
                    : isAiThinking
                    ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div 
                                className="spinner"
                                style={{
                                    width: "20px",
                                    height: "20px",
                                    border: "3px solid rgba(100, 108, 255, 0.2)",
                                    borderTopColor: "#646cff",
                                    borderRadius: "50%",
                                    animation: "spin 0.8s linear infinite",
                                    flexShrink: 0
                                }}
                            ></div>
                            <span>AI is thinking...</span>
                        </div>
                    )
                    : `Current player: ${currentPlayer}`}
            </div>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
                <Board board={board} onCellClick={handleCellClick} moveNumbers={showMoveNumbers ? moveNumbers : null} />
            </div>
            <button onClick={resetGame}>
                New Game
            </button>

            {showAbout && (
                <div 
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "20px"
                    }}
                    onClick={() => setShowAbout(false)}
                >
                    <div 
                        ref={modalContentRef}
                        style={{
                            backgroundColor: "rgb(220, 220, 220)",
                            border: "2px solid #646cff",
                            borderRadius: "12px",
                            padding: "30px",
                            maxWidth: "600px",
                            maxHeight: "80vh",
                            overflowY: "auto",
                            color: "rgba(0, 0, 0, 0.87)",
                            position: "relative"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <h2 style={{ margin: 0, color: "#646cff" }}>About the AI</h2>
                            <button 
                                onClick={() => setShowAbout(false)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "rgba(0, 0, 0, 0.87)",
                                    fontSize: "24px",
                                    cursor: "pointer",
                                    padding: "0 10px"
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div style={{ lineHeight: "1.6" }}>
                            <h3 style={{ color: "#646cff", marginTop: "20px", marginBottom: "10px" }}>How the AI Works</h3>
                            <p>
                                This Gomoku AI uses a{" "}
                                <span 
                                    style={{ 
                                        color: "#646cff", 
                                        cursor: "pointer", 
                                        textDecoration: "underline",
                                        textDecorationStyle: "dotted"
                                    }}
                                    onClick={(e) => handleTooltipClick("MCTS", e)}
                                >
                                    <strong>Monte Carlo Tree Search (MCTS)</strong>
                                </span>{" "}
                                algorithm combined with a heuristic{" "}
                                <span 
                                    style={{ 
                                        color: "#646cff", 
                                        cursor: "pointer", 
                                        textDecoration: "underline",
                                        textDecorationStyle: "dotted"
                                    }}
                                    onClick={(e) => handleTooltipClick("instinct layer", e)}
                                >
                                    <strong>"instinct layer"</strong>
                                </span>{" "}
                                for strategic decision-making.
                            </p>
                            
                            <h4 style={{ marginTop: "15px", marginBottom: "8px" }}>The Instinct Layer</h4>
                            <p>
                                Before exploring the game tree, the AI first checks for critical tactical situations:
                            </p>
                            <ul style={{ marginLeft: "20px", marginBottom: "15px" }}>
                                <li><strong>Immediate wins</strong> - If the AI can win in one move, it takes it</li>
                                <li><strong>Blocking opponent wins</strong> - If the opponent can win, the AI blocks it</li>
                                <li><strong>Creating fours</strong> - Building threats that force a response</li>
                                <li><strong>Blocking opponent fours</strong> - Preventing dangerous threats</li>
                                <li>
                                    <span 
                                        style={{ 
                                            color: "#646cff", 
                                            cursor: "pointer", 
                                            textDecoration: "underline",
                                            textDecorationStyle: "dotted"
                                        }}
                                        onClick={(e) => handleTooltipClick("Open threes", e)}
                                    >
                                        <strong>Open threes</strong>
                                    </span>{" "}
                                    - Creating or blocking patterns that can lead to victory
                                </li>
                            </ul>
                            
                            <h4 style={{ marginTop: "15px", marginBottom: "8px" }}>Monte Carlo Tree Search</h4>
                            <p>
                                When no immediate tactical move is found, the AI uses MCTS to explore possible game continuations. 
                                The algorithm:
                            </p>
                            <ul style={{ marginLeft: "20px", marginBottom: "15px" }}>
                                <li>
                                    <strong>Selects</strong> promising branches using the{" "}
                                    <span 
                                        style={{ 
                                            color: "#646cff", 
                                            cursor: "pointer", 
                                            textDecoration: "underline",
                                            textDecorationStyle: "dotted"
                                        }}
                                        onClick={(e) => handleTooltipClick("UCB1", e)}
                                    >
                                        UCB1
                                    </span>{" "}
                                    formula
                                </li>
                                <li><strong>Expands</strong> the tree by trying new moves</li>
                                <li><strong>Simulates</strong> random games to estimate move quality</li>
                                <li>
                                    <span 
                                        style={{ 
                                            color: "#646cff", 
                                            cursor: "pointer", 
                                            textDecoration: "underline",
                                            textDecorationStyle: "dotted"
                                        }}
                                        onClick={(e) => handleTooltipClick("Backpropagates", e)}
                                    >
                                        <strong>Backpropagates</strong>
                                    </span>{" "}
                                    results to update move evaluations
                                </li>
                            </ul>
                            <p>
                                After thousands of simulations, the AI chooses the move with the best win rate and exploration balance.
                            </p>
                        </div>

                        {activeTooltip && tooltipData[activeTooltip] && tooltipPosition && (
                            <div 
                                style={{
                                    padding: "15px",
                                    backgroundColor: "rgb(240, 240, 240)",
                                    border: "1px solid #646cff",
                                    borderRadius: "8px",
                                    position: "absolute",
                                    top: `${tooltipPosition.top}px`,
                                    left: `${tooltipPosition.left}px`,
                                    width: "280px",
                                    maxWidth: "calc(100% - 40px)",
                                    zIndex: 10,
                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)"
                                }}
                            >
                                <button
                                    onClick={() => {
                                        setActiveTooltip(null);
                                        setTooltipPosition(null);
                                    }}
                                    style={{
                                        position: "absolute",
                                        top: "10px",
                                        right: "10px",
                                        background: "transparent",
                                        border: "none",
                                        color: "rgba(0, 0, 0, 0.87)",
                                        fontSize: "18px",
                                        cursor: "pointer",
                                        padding: "0 8px"
                                    }}
                                >
                                    ×
                                </button>
                                <div style={{ paddingRight: "25px" }}>
                                    <h4 style={{ color: "#646cff", marginTop: 0, marginBottom: "10px" }}>
                                        {activeTooltip}
                                    </h4>
                                    <p style={{ marginBottom: tooltipData[activeTooltip].formula || tooltipData[activeTooltip].link ? "10px" : 0 }}>
                                        {tooltipData[activeTooltip].description}
                                    </p>
                                    {tooltipData[activeTooltip].formula && (
                                        <div style={{ 
                                            marginBottom: "10px", 
                                            padding: "10px", 
                                            backgroundColor: "rgb(250, 250, 250)",
                                            borderRadius: "4px",
                                            overflowX: "auto"
                                        }}>
                                            <BlockMath math={tooltipData[activeTooltip].formula} />
                                            {tooltipData[activeTooltip].formulaExplanation && (
                                                <p style={{ 
                                                    marginTop: "8px", 
                                                    marginBottom: 0, 
                                                    fontSize: "0.9em",
                                                    color: "rgba(0, 0, 0, 0.7)"
                                                }}>
                                                    {tooltipData[activeTooltip].formulaExplanation?.split(/(w_i|n_i|N|C|sqrt2)/).map((part, i) => {
                                                        if (!part) return null; // Skip empty strings from split
                                                        if (part === "w_i" || part === "n_i" || part === "N" || part === "C") {
                                                            return <InlineMath key={i} math={part} />;
                                                        } else if (part === "sqrt2") {
                                                            return <InlineMath key={i} math="\sqrt{2}" />;
                                                        }
                                                        return <span key={i}>{part}</span>;
                                                    }).filter(Boolean)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {tooltipData[activeTooltip].link && (
                                        <a
                                            href={tooltipData[activeTooltip].link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: "#646cff",
                                                textDecoration: "none",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "5px"
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                                        >
                                            {tooltipData[activeTooltip].linkText}
                                            <span style={{ fontSize: "12px" }}>↗</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
