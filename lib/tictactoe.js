class TicTacToe {
  constructor(playerX = "x", playerO = "o") {
    this.playerX = playerX;
    this.playerO = playerO;
    this._currentTurn = false;
    this._x = 0;
    this._o = 0;
    this.turns = 0;
  }

  get board() {
    return this._x | this._o;
  }

  get currentTurn() {
    return this._currentTurn ? this.playerO : this.playerX;
  }

  get enemyTurn() {
    return this._currentTurn ? this.playerX : this.playerO;
  }

  static check(state) {
    for (let combo of [7, 56, 73, 84, 146, 273, 292, 448])
      if ((state & combo) === combo) return true; // Corrected: !0 to true
    return false; // Corrected: return !1 to false
  }

  /**
   * ```js
   * TicTacToe.toBinary(1, 2) // 0b010000000
   * ```
   */
  static toBinary(x = 0, y = 0) {
    if (x < 0 || x > 2 || y < 0 || y > 2) throw new Error("invalid position");
    return 1 << (x + 3 * y);
  }

  /**
   * @param player `0` is `X`, `1` is `O`
   *
   * - `-3` `Game Ended`
   * - `-2` `Invalid`
   * - `-1` `Invalid Position`
   * - ` 0` `Position Occupied`
   * - ` 1` `Success`
   * @returns {-3|-2|-1|0|1}
   */
  turn(player = 0, x = 0, y) {
    if (this.board === 511) return -3;
    let pos = 0;
    if (y == null) {
      if (x < 0 || x > 8) return -1; // Assuming x is 0-8 for single arg
      pos = 1 << x;
    } else {
      if (x < 0 || x > 2 || y < 0 || y > 2) return -1;
      pos = TicTacToe.toBinary(x, y);
    }
    if (this._currentTurn ^ player) return -2; // Checks if it's the player's turn
    if (this.board & pos) return 0; // Position occupied
    this[this._currentTurn ? "_o" : "_x"] |= pos;
    this._currentTurn = !this._currentTurn;
    this.turns++;
    return 1;
  }

  /**
   * @returns {('X'|'O'|number)[]} // Updated return type for clarity
   */
  static render(boardX = 0, boardO = 0) {
    let x = parseInt(boardX.toString(2), 4); // This logic seems unconventional for board rendering
    let y = parseInt(boardO.toString(2), 4) * 2;
    return [...(x + y).toString(4).padStart(9, "0")]
      .reverse()
      .map((value, index) => (value == '1' ? "X" : value == '2' ? "O" : index + 1)); // Ensure numbers for empty cells
  }

  /**
   * @returns {('X'|'O'|number)[]} // Updated return type
   */
  render() {
    return TicTacToe.render(this._x, this._o);
  }

  get winner() {
    let x = TicTacToe.check(this._x);
    let o = TicTacToe.check(this._o);
    return x ? this.playerX : o ? this.playerO : false;
  }
}

// new TicTacToe().turn; // This line seems to be for testing/type inference, can be removed if not needed at runtime

export default TicTacToe;