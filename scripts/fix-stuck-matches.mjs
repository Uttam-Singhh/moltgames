import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

// --- Tetris game logic (inlined) ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const PIECES = {
  I: [[[0,0],[0,1],[0,2],[0,3]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[0,1],[0,2],[0,3]],[[0,0],[1,0],[2,0],[3,0]]],
  O: [[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[1,0],[1,1]]],
  T: [[[0,0],[0,1],[0,2],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[1,0],[1,1],[1,2],[0,1]],[[0,0],[1,0],[2,0],[1,-1]]],
  S: [[[0,1],[0,2],[1,0],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,1],[0,2],[1,0],[1,1]],[[0,0],[1,0],[1,1],[2,1]]],
  Z: [[[0,0],[0,1],[1,1],[1,2]],[[0,1],[1,0],[1,1],[2,0]],[[0,0],[0,1],[1,1],[1,2]],[[0,1],[1,0],[1,1],[2,0]]],
  J: [[[0,0],[1,0],[1,1],[1,2]],[[0,0],[0,1],[1,0],[2,0]],[[0,0],[0,1],[0,2],[1,2]],[[0,0],[1,0],[2,0],[2,-1]]],
  L: [[[0,2],[1,0],[1,1],[1,2]],[[0,0],[1,0],[2,0],[2,1]],[[0,0],[0,1],[0,2],[1,0]],[[0,0],[0,1],[1,1],[2,1]]],
};

function hashSeed(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function createSeededRng(seed) {
  let state = hashSeed(seed);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_PIECES = ["I", "O", "T", "S", "Z", "J", "L"];

function shuffleArray(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getPieceAtIndex(seed, index) {
  const rng = createSeededRng(seed);
  const bagIndex = Math.floor(index / 7);
  const posInBag = index % 7;
  for (let b = 0; b < bagIndex; b++) shuffleArray(ALL_PIECES, rng);
  return shuffleArray(ALL_PIECES, rng)[posInBag];
}

function dropPiece(board, piece, rotation, column) {
  const offsets = PIECES[piece][rotation % 4];
  for (const [, c] of offsets) {
    if (column + c < 0 || column + c >= BOARD_WIDTH) return null;
  }
  let dropRow = 0;
  while (true) {
    let canDrop = true;
    for (const [r, c] of offsets) {
      const row = dropRow + 1 + r;
      const col = column + c;
      if (row >= BOARD_HEIGHT || board[row * BOARD_WIDTH + col] !== ".") {
        canDrop = false;
        break;
      }
    }
    if (!canDrop) break;
    dropRow++;
  }
  const finalCells = [];
  for (const [r, c] of offsets) {
    const row = dropRow + r;
    const col = column + c;
    if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) return null;
    if (board[row * BOARD_WIDTH + col] !== ".") return null;
    finalCells.push([row, col]);
  }
  return finalCells;
}

function isValidPlacement(board, piece, rotation, column) {
  const offsets = PIECES[piece][rotation % 4];
  for (const [, c] of offsets) {
    if (column + c < 0 || column + c >= BOARD_WIDTH) return false;
  }
  return dropPiece(board, piece, rotation, column) !== null;
}

function hasAnyValidPlacement(board, piece) {
  for (let rot = 0; rot < 4; rot++) {
    for (let col = -2; col < BOARD_WIDTH + 2; col++) {
      if (isValidPlacement(board, piece, rot, col)) return true;
    }
  }
  return false;
}

function countFilledCells(board) {
  let count = 0;
  for (const ch of board) {
    if (ch !== ".") count++;
  }
  return count;
}

// --- Main ---
async function main() {
  console.log("Finding stuck Tetris matches...\n");

  const stuckMatches = await sql`
    SELECT m.id, m.status, m.player1_id, m.player2_id, m.created_at,
           p1.username as p1_name, p2.username as p2_name,
           tg.seed, tg.player1_board, tg.player2_board,
           tg.player1_alive, tg.player2_alive,
           tg.player1_piece_index, tg.player2_piece_index,
           tg.player1_score, tg.player2_score,
           tg.player1_lines, tg.player2_lines,
           tg.player1_last_move_at, tg.player2_last_move_at
    FROM matches m
    JOIN tetris_games tg ON tg.match_id = m.id
    JOIN players p1 ON p1.id = m.player1_id
    JOIN players p2 ON p2.id = m.player2_id
    WHERE m.status = 'in_progress' AND m.game_type = 'tetris'
    ORDER BY m.created_at DESC
  `;

  if (stuckMatches.length === 0) {
    console.log("No in-progress Tetris matches found.");
    return;
  }

  for (const match of stuckMatches) {
    const p1Board = match.player1_board;
    const p2Board = match.player2_board;
    const p1Filled = countFilledCells(p1Board);
    const p2Filled = countFilledCells(p2Board);
    const p1Piece = getPieceAtIndex(match.seed, match.player1_piece_index);
    const p2Piece = getPieceAtIndex(match.seed, match.player2_piece_index);
    const p1CanPlace = hasAnyValidPlacement(p1Board, p1Piece);
    const p2CanPlace = hasAnyValidPlacement(p2Board, p2Piece);

    console.log(`Match: ${match.id}`);
    console.log(`  ${match.p1_name} vs ${match.p2_name}`);
    console.log(`  Created: ${match.created_at}`);
    console.log(`  P1: alive=${match.player1_alive}, filled=${p1Filled}/200, piece=${p1Piece}, canPlace=${p1CanPlace}, score=${match.player1_score}, lines=${match.player1_lines}`);
    console.log(`  P2: alive=${match.player2_alive}, filled=${p2Filled}/200, piece=${p2Piece}, canPlace=${p2CanPlace}, score=${match.player2_score}, lines=${match.player2_lines}`);
    console.log(`  P1 last move: ${match.player1_last_move_at}`);
    console.log(`  P2 last move: ${match.player2_last_move_at}`);

    // Determine if either player should be dead
    const p1ShouldBeDead = !p1CanPlace;
    const p2ShouldBeDead = !p2CanPlace;

    if (p1ShouldBeDead || p2ShouldBeDead) {
      console.log(`\n  >> STUCK! P1 should be dead: ${p1ShouldBeDead}, P2 should be dead: ${p2ShouldBeDead}`);

      // Update alive flags
      if (p1ShouldBeDead && match.player1_alive) {
        await sql`UPDATE tetris_games SET player1_alive = false WHERE match_id = ${match.id}`;
        console.log(`  >> Set P1 alive=false`);
      }
      if (p2ShouldBeDead && match.player2_alive) {
        await sql`UPDATE tetris_games SET player2_alive = false WHERE match_id = ${match.id}`;
        console.log(`  >> Set P2 alive=false`);
      }

      // Determine winner
      const p1Dead = p1ShouldBeDead || !match.player1_alive;
      const p2Dead = p2ShouldBeDead || !match.player2_alive;

      if (p1Dead && p2Dead) {
        // Both dead - tiebreak by lines, then score
        let winnerId = null;
        let loserId = null;
        if (match.player1_lines > match.player2_lines) {
          winnerId = match.player1_id;
          loserId = match.player2_id;
        } else if (match.player2_lines > match.player1_lines) {
          winnerId = match.player2_id;
          loserId = match.player1_id;
        } else if (match.player1_score > match.player2_score) {
          winnerId = match.player1_id;
          loserId = match.player2_id;
        } else if (match.player2_score > match.player1_score) {
          winnerId = match.player2_id;
          loserId = match.player1_id;
        }

        if (winnerId) {
          await sql`UPDATE matches SET status = 'completed', winner_id = ${winnerId}, completed_at = NOW() WHERE id = ${match.id}`;
          console.log(`  >> Match completed. Winner: ${winnerId === match.player1_id ? match.p1_name : match.p2_name}`);
        } else {
          await sql`UPDATE matches SET status = 'draw', completed_at = NOW() WHERE id = ${match.id}`;
          console.log(`  >> Match ended as DRAW`);
        }
      } else if (p1Dead) {
        await sql`UPDATE matches SET status = 'completed', winner_id = ${match.player2_id}, completed_at = NOW() WHERE id = ${match.id}`;
        console.log(`  >> Match completed. Winner: ${match.p2_name}`);
      } else if (p2Dead) {
        await sql`UPDATE matches SET status = 'completed', winner_id = ${match.player1_id}, completed_at = NOW() WHERE id = ${match.id}`;
        console.log(`  >> Match completed. Winner: ${match.p1_name}`);
      }
    } else {
      const now = Date.now();
      const p1Ago = Math.round((now - new Date(match.player1_last_move_at).getTime()) / 1000);
      const p2Ago = Math.round((now - new Date(match.player2_last_move_at).getTime()) / 1000);
      console.log(`  >> Both can still place. P1 last move ${p1Ago}s ago, P2 last move ${p2Ago}s ago`);
      console.log(`  >> Game is still valid (will resolve via gravity on next poll)`);
    }
    console.log();
  }
}

main().catch(console.error);
