import { useState, useEffect, useRef } from "react";
import type { BoardState, Player } from "../ai/types";
import {
    createEmptyBoard,
    makeMove,
    checkWin,
    isValidMove,
    isBoardFull,
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
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new MctsWorker();

        workerRef.current.onmessage = (e) => {
            const { move } = e.data;
            const [row, col] = move;

            const newBoard = makeMove(board, row, col, 2);
            setBoard(newBoard);

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

            setCurrentPlayer(1);
            setIsAiThinking(false);
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, [board]);

    useEffect(() => {
        if (
            gameMode === "ai" &&
            currentPlayer === 2 &&
            !gameOver &&
            !isAiThinking
        ) {
            setIsAiThinking(true);
            workerRef.current?.postMessage({ board, iterations: 3000 });
        }
    }, [currentPlayer, gameOver, board, isAiThinking, gameMode]);

    const handleCellClick = (row: number, col: number) => {
        if (gameOver || !isValidMove(board, row, col) || isAiThinking) {
            return;
        }

        if (gameMode === "ai" && currentPlayer === 2) {
            return;
        }

        const newBoard = makeMove(board, row, col, currentPlayer);
        setBoard(newBoard);

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
            <div style={{ marginBottom: "15px" }}>
                <button onClick={toggleMode}>
                    Mode: {gameMode === "ai" ? "vs AI" : "vs Human"}
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
                <Board board={board} onCellClick={handleCellClick} />
            </div>
            <button onClick={resetGame}>
                New Game
            </button>
        </div>
    );
}
