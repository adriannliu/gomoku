import type { BoardState } from "../ai/types";
import { BOARD_SIZE } from "../utils/gameLogic";

interface BoardProps {
    board: BoardState;
    onCellClick: (row: number, col: number) => void;
    moveNumbers?: number[][] | null;
}

export default function Board({ board, onCellClick, moveNumbers }: BoardProps) {
    const cellSize = 30;

    return (
        <svg
            width={BOARD_SIZE * cellSize}
            height={BOARD_SIZE * cellSize}
            style={{ border: "2px solid #333" }}
        >
            {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                <g key={i}>
                    <line
                        x1={cellSize / 2}
                        y1={i * cellSize + cellSize / 2}
                        x2={(BOARD_SIZE - 0.5) * cellSize}
                        y2={i * cellSize + cellSize / 2}
                        stroke="#666"
                        strokeWidth="1"
                    />
                    <line
                        x1={i * cellSize + cellSize / 2}
                        y1={cellSize / 2}
                        x2={i * cellSize + cellSize / 2}
                        y2={(BOARD_SIZE - 0.5) * cellSize}
                        stroke="#666"
                        strokeWidth="1"
                    />
                </g>
            ))}

            {board.map((row, r) =>
                row.map(
                    (cell, c) =>
                        cell !== 0 && (
                            <g key={`${r}-${c}`}>
                                <circle
                                    cx={c * cellSize + cellSize / 2}
                                    cy={r * cellSize + cellSize / 2}
                                    r={cellSize * 0.4}
                                    fill={cell === 1 ? "#000" : "#fff"}
                                    stroke={cell === 2 ? "#000" : "none"}
                                    strokeWidth="2"
                                />
                                {moveNumbers && moveNumbers[r][c] > 0 && (
                                    <text
                                        x={c * cellSize + cellSize / 2}
                                        y={r * cellSize + cellSize / 2}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill={cell === 1 ? "#fff" : "#000"}
                                        fontSize={cellSize * 0.35}
                                        fontWeight="bold"
                                        style={{ pointerEvents: "none", userSelect: "none" }}
                                    >
                                        {moveNumbers[r][c]}
                                    </text>
                                )}
                            </g>
                        )
                )
            )}

            {board.map((row, r) =>
                row.map((_, c) => (
                    <rect
                        key={`click-${r}-${c}`}
                        x={c * cellSize}
                        y={r * cellSize}
                        width={cellSize}
                        height={cellSize}
                        fill="transparent"
                        onClick={() => onCellClick(r, c)}
                        style={{ cursor: "pointer" }}
                    ></rect>
                ))
            )}
        </svg>
    );
}
