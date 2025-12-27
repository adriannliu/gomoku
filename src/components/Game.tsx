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
        workerRef.current = new Worker("/mcts-worker.js");

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
        <div style={{ padding: "20px" }}>
            <h1>Gomoku</h1>
            <div style={{ marginBottom: "10px" }}>
                <button onClick={toggleMode}>
                    Mode: {gameMode === "ai" ? "vs AI" : "vs Human"}
                </button>
            </div>
            <div style={{ marginBottom: "10px" }}>
                {gameOver
                    ? winner
                        ? `Player ${winner} wins!`
                        : "Draw!"
                    : isAiThinking
                    ? "AI is thinking..."
                    : `Current player: ${currentPlayer}`}
            </div>
            <Board board={board} onCellClick={handleCellClick} />
            <button onClick={resetGame} style={{ marginTop: "10px" }}>
                New Game
            </button>
        </div>
    );
}
