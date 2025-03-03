
Node = (function () {
  function Node(lhs, op, rhs) {
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  var LAMBDA = function () {};

  var operators =  {
    // unary
    '!': function not(a, b) { return !b; },
    '!!': function notnot(a, b) { return !!b; },
    '=>': LAMBDA,
    // mul/div
    '*': function mul(a, b) { return a * b; },
    '/': function div(a, b) { return a / b; },
    '%': function mod(a, b) { return a % b; },
    // sub/add
    '+': function add(a, b) { return a + b; },
    '-': function sub(a, b) { return a - b; },
    // relational
    '<': function lt(a, b) { return a < b; },
    '<=': function le(a, b) { return a <= b; },
    '>': function gt(a, b) { return a > b; },
    '>=': function ge(a, b) { return a >= b; },
    //    TODO: 'in': function (a, b) { return a in b; },
    //    TODO: 'instanceof': function (a, b) { return a instanceof b; },
    // equality
    '==': function equal(a, b) { return a === b; },
    '!=': function ne(a, b) { return a !== b; },
    '===': function sequal(a, b) { return a === b; },
    '!==': function sne(a, b) { return a !== b; },
    // bitwise
    '&': function bit_and(a, b) { return a & b; },
    '^': function xor(a, b) { return a ^ b; },
    '|': function bit_or(a, b) { return a | b; },
    // logic
    '&&': function logic_and(a, b) { return a && b; },
    '||': function logic_or(a, b) { return a || b; },
    // ternary
    '?': function ternary (a, b) {
       return this.node_value_of(a ? b.yes : b.no);
    },
	// Function-Call
    'call': function callOp (a, b) { return a.apply(null, b) }
  };

  /* In order of precedence, see:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence#Table
  */
    // lambda
  //operators['=>'].precedence = 20
    // logical not
  operators['!'].precedence = 4;
  operators['!!'].precedence = 4; // explicit double-negative
    // multiply/divide/mod
  operators['*'].precedence = 5;
  operators['/'].precedence = 5;
  operators['%'].precedence = 5;
    // add/sub
  operators['+'].precedence = 6;
  operators['-'].precedence = 6;
    // relational
  operators['<'].precedence = 8;
  operators['<='].precedence = 8;
  operators['>'].precedence = 8;
  operators['>='].precedence = 8;
  // operators['in'].precedence = 8;
  // operators['instanceof'].precedence = 8;
    // equality
  operators['=='].precedence = 9;
  operators['!='].precedence = 9;
  operators['==='].precedence = 9;
  operators['!=='].precedence = 9;
    // bitwise
  operators['&'].precedence = 10;
  operators['^'].precedence = 11;
  operators['|'].precedence = 12;
    // logic
  operators['&&'].precedence = 13;
  operators['||'].precedence = 14;

  operators['&&'].earlyOut = function (a) { return !a; };
  operators['||'].earlyOut = function (a) { return a; };

  // Ternary
  operators['?'].precedence = 4;

  // Call a function
  operators['call'].precedence = 1

  Node.operators = operators;


  Node.prototype.get_leaf_value = function (leaf, member_of) {
    if (typeof(leaf) === 'function') {
      // Expressions on observables are nonsensical, so we unwrap any
      // function values (e.g. identifiers).
      return ko.unwrap(leaf());
    }

    // primitives
    if (typeof(leaf) !== 'object') {
      return member_of ? member_of[leaf] : leaf;
    }

    // Identifiers and Expressions
    if (leaf instanceof Identifier || leaf instanceof Expression) {
      // lhs is passed in as the parent of the leaf. It will be defined in
      // cases like a.b.c as 'a' for 'b' then as 'b' for 'c'.
      return ko.unwrap(leaf.get_value(member_of));
    }

    if (leaf instanceof Node) {
      return leaf.get_node_value(member_of);
    }

    // Plain object/class.
    return leaf;
  };

  /**
   * Return a function that calculates and returns an expression's value
   * when called.
   * @param  {array} ops  The operations to perform
   * @return {function}   The function that calculates the expression.
   *
   * Exported for testing.
   * 
   * * Note that for a lambda, we do not evaluate the RHS expression until
   * the lambda is called.
   */
   Node.prototype.get_node_value = function () {
    var node = this;

    if (node.op === LAMBDA) {
      return function () {
        return node.get_leaf_value(node.rhs);
      }
    }

    var lhv = node.get_leaf_value(node.lhs);
    var earlyOut = node.op.earlyOut;

    if (earlyOut && earlyOut(lhv)) { return lhv; }
    var rhv = node.get_leaf_value(node.rhs);

    return this.op(lhv, rhv);
  };

  Node.prototype.node_value_of = function (item) {
    if (item && (item instanceof Identifier || item instanceof Expression)) {
      return item.get_value(item);
    }
    return item;
  }

  return Node;
})();

Expression = (function () {
  function Expression(nodes) {
    this.nodes = nodes;
    this.root = this.build_tree(nodes);
  }

  // Exports for testing.
  Expression.operators = Node.operators;
  Expression.Node = Node;

  /**
   *  Convert an array of nodes to an executable tree.
   *  @return {object} An object with a `lhs`, `rhs` and `op` key, corresponding
   *                      to the left hand side, right hand side, and
   *                      operation function.
   */
  Expression.prototype.build_tree = function (nodes) {
    var root,
        leaf,
        op,
        value;

    // console.log("build_tree", nodes.slice(0))

    // primer
    leaf = root = new Node(nodes.shift(), nodes.shift(), nodes.shift());

    while (nodes) {
      op = nodes.shift();
      value = nodes.shift();
      if (!op) {
        break;
      }
      if (op.precedence > root.op.precedence) {
        // rebase
        root = new Node(root, op, value);
        leaf = root;
      } else {
        leaf.rhs = new Node(leaf.rhs, op, value);
        leaf = leaf.rhs;
      }
    }
    // console.log("tree", root)
    return root;
  }; // build_tree

  Expression.prototype.get_value = function () {
    if (!this.root) {
      this.root = this.build_tree(this.nodes);
    }
    return this.root.get_node_value();
  };

  return Expression;
})();

Ternary = (function () {
  function Ternary(yes, no) {
    this.yes = yes;
    this.no = no;
  }

  Ternary.prototype.get_value = function () { return this; };

  return Ternary;
})();