# Gomoku AI Engine

A high-performance, browser-based AI for playing Gomoku (Five in a Row), built with TypeScript.

## How It Works

This project uses a hybrid AI architecture to balance forced reactions with deep planning:

### 1. "Instinct" Layer
Before searching, the AI scans for critical patterns to react instantly:
1. Takes immediate winning moves (5-in-a-row).
2. Blocks opponent's winning moves or "Open Fours."
3. Identifies and blocks "Open Threes," which are dangerous.

### 2. MCTS Layer (see more details below)
If no immediate threats exist, it switches to Monte Carlo Tree Search (UCB1):
1. Optimizes for moves that minimize the opponent's win rate.
2. Simulations are not purely random; they include basic competency checks to make win/loss data more accurate.

## Performance Optimizations

1. All AI calculation runs in a background thread
2. Coordinates are mapped to flat integers (0-224) instead of objects or strings, reducing garbage collection overhead by ~95%.
3. Candidate moves are pruned to a dynamic radius around occupied cells, focusing the AI on the active battlefield.

## Key Files

* `mcts-worker.ts`: MCTS engine and simulation loop.
* `patterns.ts`: linear scanning for 3s, 4s, and 5s.
* `types.ts`: type definitions.

## Algorithmic Core: MCTS & UCB

This engine uses Monte Carlo Tree Search (MCTS) instead of Minimax. It does not attempt to solve the game perfectly but instead finds the statistically strongest moves, assuming a competent opponent.

### The Search Process
The AI runs thousands of iterations per turn. Each iteration follows four phases:

1.  Selection: Traverses the tree from the root, choosing the most promising moves using the UCB1 formula until a leaf is reached.
2.  Expansion: Adds a new child node to the tree (a potential future move).
3.  Simulation: Plays a "heavy" random game from that new position to the end. It checks for immediate wins/blocks to ensure data quality.
4.  Backpropagation: Updates the win/loss statistics for every node along the path based on the simulation result.

### The Decision Maker: UCB1
To balance Exploitation (sticking to known good moves) and Exploration (trying new moves), we use the Upper Confidence Bound 1 formula. For a given child node $$i$$, the UCB value is calculated as follows:

$$UCB(i) = \frac{w_i}{n_i} + C \sqrt{\frac{\ln N}{n_i}}$$

* **$\frac{w_i}{n_i}$ (Exploitation)**:
  * $w_i$ is the number of wins (or total reward) for that node.
  * $n_i$ is the number of times that specific node has been visited.
  * This is simply the average win rate.
* **$\sqrt{\frac{\ln N}{n_i}}$ (Exploration)**:
  * $N$ is the total number of times the parent node has been visited.
  * $n_i$ is the number of times the current child node has been visited.
  * This term represents uncertainty. As the parent is visited more ($N$ increases) but a specific child is ignored ($n_i$ stays small), this bonus grows larger, eventually forcing the algorithm to check the ignored move
* **$C$**: The exploration constant (usually $\sqrt{2}$), tunes the AI's curiosity.

### Key Strategies
* **Inverted Perspective**: The AI assumes the opponent plays optimally. It selects moves that minimize the opponent's win rate, even if they play optimally.
* **Robust Child Selection**: The final move is chosen based on **highest visit count**, not highest win rate, to avoid "lucky" outliers and to handle the case where the game is nearly a forced draw.
