# Gomoku AI Engine

A high-performance, browser-based AI for playing Gomoku (Five in a Row), built with TypeScript.

## How It Works

This project uses a hybrid AI architecture to balance forced reactions with deep planning:

### 1. "Instinct" Layer
Before searching, the AI scans for critical patterns to react instantly:
1. Takes immediate winning moves (5-in-a-row).
2. Blocks opponent's winning moves or "Open Fours."
3. Identifies and blocks "Open Threes," which are dangerous.

### 2. MCTS Layer
If no immediate threats exist, it switches to Monte Carlo Tree Search (UCB1):
* Optimizes for moves that minimize the opponent's win rate (defensive-aggressive).
* Simulations are not purely random; they include basic competency checks to make win/loss data more accurate.

## Performance Optimizations

1. All AI calculation runs in a background thread
2. Coordinates are mapped to flat integers (0-224) instead of objects or strings, reducing garbage collection overhead by ~95%.
3. Candidate moves are pruned to a dynamic radius around occupied cells, focusing the AI on the active battlefield.

## Key Files

* `mcts-worker.ts`: MCTS engine and simulation loop.
* `patterns.ts`: linear scanning for 3s, 4s, and 5s.
* `types.ts`: type definitions.
