"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createSimplifyConstant = void 0;
var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));
var _is = require("../../utils/is.js");
var _factory = require("../../utils/factory.js");
var _util = require("./simplify/util.js");
var _noop = require("../../utils/noop.js");
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
var name = 'simplifyConstant';
var dependencies = ['typed', 'config', 'mathWithTransform', 'matrix', '?fraction', '?bignumber', 'AccessorNode', 'ArrayNode', 'ConstantNode', 'FunctionNode', 'IndexNode', 'ObjectNode', 'OperatorNode', 'SymbolNode'];
var createSimplifyConstant = /* #__PURE__ */(0, _factory.factory)(name, dependencies, function (_ref) {
  var typed = _ref.typed,
    config = _ref.config,
    mathWithTransform = _ref.mathWithTransform,
    matrix = _ref.matrix,
    fraction = _ref.fraction,
    bignumber = _ref.bignumber,
    AccessorNode = _ref.AccessorNode,
    ArrayNode = _ref.ArrayNode,
    ConstantNode = _ref.ConstantNode,
    FunctionNode = _ref.FunctionNode,
    IndexNode = _ref.IndexNode,
    ObjectNode = _ref.ObjectNode,
    OperatorNode = _ref.OperatorNode,
    SymbolNode = _ref.SymbolNode;
  var _createUtil = (0, _util.createUtil)({
      FunctionNode: FunctionNode,
      OperatorNode: OperatorNode,
      SymbolNode: SymbolNode
    }),
    isCommutative = _createUtil.isCommutative,
    isAssociative = _createUtil.isAssociative,
    allChildren = _createUtil.allChildren,
    createMakeNodeFunction = _createUtil.createMakeNodeFunction;

  /**
   * simplifyConstant() takes a mathjs expression (either a Node representing
   * a parse tree or a string which it parses to produce a node), and replaces
   * any subexpression of it consisting entirely of constants with the computed
   * value of that subexpression.
   *
   * Syntax:
   *
   *     simplifyConstant(expr)
   *     simplifyConstant(expr, options)
   *
   * Examples:
   *
   *     math.simplifyConstant('x + 4*3/6')  // Node "x + 2"
   *     math.simplifyConstant('z cos(0)')   // Node "z 1"
   *     math.simplifyConstant('(5.2 + 1.08)t', {exactFractions: false})  // Node "6.28 t"
   *
   * See also:
   *
   *     simplify, simplifyCore, resolve, derivative
   *
   * @param {Node | string} node
   *     The expression to be simplified
   * @param {Object} options
   *     Simplification options, as per simplify()
   * @return {Node} Returns expression with constant subexpressions evaluated
   */
  var simplifyConstant = typed('simplifyConstant', {
    Node: function Node(node) {
      return _ensureNode(foldFraction(node, {}));
    },
    'Node, Object': function NodeObject(expr, options) {
      return _ensureNode(foldFraction(expr, options));
    }
  });
  function _removeFractions(thing) {
    if ((0, _is.isFraction)(thing)) {
      return thing.valueOf();
    }
    if (thing instanceof Array) {
      return thing.map(_removeFractions);
    }
    if ((0, _is.isMatrix)(thing)) {
      return matrix(_removeFractions(thing.valueOf()));
    }
    return thing;
  }
  function _eval(fnname, args, options) {
    try {
      return mathWithTransform[fnname].apply(null, args);
    } catch (ignore) {
      // sometimes the implicit type conversion causes the evaluation to fail, so we'll try again after removing Fractions
      args = args.map(_removeFractions);
      return _toNumber(mathWithTransform[fnname].apply(null, args), options);
    }
  }
  var _toNode = typed({
    Fraction: _fractionToNode,
    number: function number(n) {
      if (n < 0) {
        return unaryMinusNode(new ConstantNode(-n));
      }
      return new ConstantNode(n);
    },
    BigNumber: function BigNumber(n) {
      if (n < 0) {
        return unaryMinusNode(new ConstantNode(-n));
      }
      return new ConstantNode(n); // old parameters: (n.toString(), 'number')
    },

    Complex: function Complex(s) {
      throw new Error('Cannot convert Complex number to Node');
    },
    string: function string(s) {
      return new ConstantNode(s);
    },
    Matrix: function Matrix(m) {
      return new ArrayNode(m.valueOf().map(function (e) {
        return _toNode(e);
      }));
    }
  });
  function _ensureNode(thing) {
    if ((0, _is.isNode)(thing)) {
      return thing;
    }
    return _toNode(thing);
  }

  // convert a number to a fraction only if it can be expressed exactly,
  // and when both numerator and denominator are small enough
  function _exactFraction(n, options) {
    var exactFractions = options && options.exactFractions !== false;
    if (exactFractions && isFinite(n) && fraction) {
      var f = fraction(n);
      var fractionsLimit = options && typeof options.fractionsLimit === 'number' ? options.fractionsLimit : Infinity; // no limit by default

      if (f.valueOf() === n && f.n < fractionsLimit && f.d < fractionsLimit) {
        return f;
      }
    }
    return n;
  }

  // Convert numbers to a preferred number type in preference order: Fraction, number, Complex
  // BigNumbers are left alone
  var _toNumber = typed({
    'string, Object': function stringObject(s, options) {
      if (config.number === 'BigNumber') {
        if (bignumber === undefined) {
          (0, _noop.noBignumber)();
        }
        return bignumber(s);
      } else if (config.number === 'Fraction') {
        if (fraction === undefined) {
          (0, _noop.noFraction)();
        }
        return fraction(s);
      } else {
        var n = parseFloat(s);
        return _exactFraction(n, options);
      }
    },
    'Fraction, Object': function FractionObject(s, options) {
      return s;
    },
    // we don't need options here

    'BigNumber, Object': function BigNumberObject(s, options) {
      return s;
    },
    // we don't need options here

    'number, Object': function numberObject(s, options) {
      return _exactFraction(s, options);
    },
    'Complex, Object': function ComplexObject(s, options) {
      if (s.im !== 0) {
        return s;
      }
      return _exactFraction(s.re, options);
    },
    'Matrix, Object': function MatrixObject(s, options) {
      return matrix(_exactFraction(s.valueOf()));
    },
    'Array, Object': function ArrayObject(s, options) {
      return s.map(_exactFraction);
    }
  });
  function unaryMinusNode(n) {
    return new OperatorNode('-', 'unaryMinus', [n]);
  }
  function _fractionToNode(f) {
    var n;
    var vn = f.s * f.n;
    if (vn < 0) {
      n = new OperatorNode('-', 'unaryMinus', [new ConstantNode(-vn)]);
    } else {
      n = new ConstantNode(vn);
    }
    if (f.d === 1) {
      return n;
    }
    return new OperatorNode('/', 'divide', [n, new ConstantNode(f.d)]);
  }

  /* Handles constant indexing of ArrayNodes, matrices, and ObjectNodes */
  function _foldAccessor(obj, index, options) {
    if (!(0, _is.isIndexNode)(index)) {
      // don't know what to do with that...
      return new AccessorNode(_ensureNode(obj), _ensureNode(index));
    }
    if ((0, _is.isArrayNode)(obj) || (0, _is.isMatrix)(obj)) {
      var remainingDims = Array.from(index.dimensions);
      /* We will resolve constant indices one at a time, looking
       * just in the first or second dimensions because (a) arrays
       * of more than two dimensions are likely rare, and (b) pulling
       * out the third or higher dimension would be pretty intricate.
       * The price is that we miss simplifying [..3d array][x,y,1]
       */
      while (remainingDims.length > 0) {
        if ((0, _is.isConstantNode)(remainingDims[0]) && typeof remainingDims[0].value !== 'string') {
          var first = _toNumber(remainingDims.shift().value, options);
          if ((0, _is.isArrayNode)(obj)) {
            obj = obj.items[first - 1];
          } else {
            // matrix
            obj = obj.valueOf()[first - 1];
            if (obj instanceof Array) {
              obj = matrix(obj);
            }
          }
        } else if (remainingDims.length > 1 && (0, _is.isConstantNode)(remainingDims[1]) && typeof remainingDims[1].value !== 'string') {
          var second = _toNumber(remainingDims[1].value, options);
          var tryItems = [];
          var fromItems = (0, _is.isArrayNode)(obj) ? obj.items : obj.valueOf();
          var _iterator = _createForOfIteratorHelper(fromItems),
            _step;
          try {
            for (_iterator.s(); !(_step = _iterator.n()).done;) {
              var item = _step.value;
              if ((0, _is.isArrayNode)(item)) {
                tryItems.push(item.items[second - 1]);
              } else if ((0, _is.isMatrix)(obj)) {
                tryItems.push(item[second - 1]);
              } else {
                break;
              }
            }
          } catch (err) {
            _iterator.e(err);
          } finally {
            _iterator.f();
          }
          if (tryItems.length === fromItems.length) {
            if ((0, _is.isArrayNode)(obj)) {
              obj = new ArrayNode(tryItems);
            } else {
              // matrix
              obj = matrix(tryItems);
            }
            remainingDims.splice(1, 1);
          } else {
            // extracting slice along 2nd dimension failed, give up
            break;
          }
        } else {
          // neither 1st or 2nd dimension is constant, give up
          break;
        }
      }
      if (remainingDims.length === index.dimensions.length) {
        /* No successful constant indexing */
        return new AccessorNode(_ensureNode(obj), index);
      }
      if (remainingDims.length > 0) {
        /* Indexed some but not all dimensions */
        index = new IndexNode(remainingDims);
        return new AccessorNode(_ensureNode(obj), index);
      }
      /* All dimensions were constant, access completely resolved */
      return obj;
    }
    if ((0, _is.isObjectNode)(obj) && index.dimensions.length === 1 && (0, _is.isConstantNode)(index.dimensions[0])) {
      var key = index.dimensions[0].value;
      if (key in obj.properties) {
        return obj.properties[key];
      }
      return new ConstantNode(); // undefined
    }
    /* Don't know how to index this sort of obj, at least not with this index */
    return new AccessorNode(_ensureNode(obj), index);
  }

  /*
   * Create a binary tree from a list of Fractions and Nodes.
   * Tries to fold Fractions by evaluating them until the first Node in the list is hit, so
   * `args` should be sorted to have the Fractions at the start (if the operator is commutative).
   * @param args - list of Fractions and Nodes
   * @param fn - evaluator for the binary operation evaluator that accepts two Fractions
   * @param makeNode - creates a binary OperatorNode/FunctionNode from a list of child Nodes
   * if args.length is 1, returns args[0]
   * @return - Either a Node representing a binary expression or Fraction
   */
  function foldOp(fn, args, makeNode, options) {
    var first = args.shift();

    // In the following reduction, sofar always has one of the three following
    // forms: [NODE], [CONSTANT], or [NODE, CONSTANT]
    var reduction = args.reduce(function (sofar, next) {
      if (!(0, _is.isNode)(next)) {
        var last = sofar.pop();
        if ((0, _is.isNode)(last)) {
          return [last, next];
        }
        // Two constants in a row, try to fold them into one
        try {
          sofar.push(_eval(fn, [last, next], options));
          return sofar;
        } catch (ignoreandcontinue) {
          sofar.push(last);
          // fall through to Node case
        }
      }

      // Encountered a Node, or failed folding --
      // collapse everything so far into a single tree:
      sofar.push(_ensureNode(sofar.pop()));
      var newtree = sofar.length === 1 ? sofar[0] : makeNode(sofar);
      return [makeNode([newtree, _ensureNode(next)])];
    }, [first]);
    if (reduction.length === 1) {
      return reduction[0];
    }
    // Might end up with a tree and a constant at the end:
    return makeNode([reduction[0], _toNode(reduction[1])]);
  }

  // destroys the original node and returns a folded one
  function foldFraction(node, options) {
    switch (node.type) {
      case 'SymbolNode':
        return node;
      case 'ConstantNode':
        switch ((0, _typeof2["default"])(node.value)) {
          case 'number':
            return _toNumber(node.value, options);
          case 'string':
            return node.value;
          default:
            if (!isNaN(node.value)) return _toNumber(node.value, options);
        }
        return node;
      case 'FunctionNode':
        if (mathWithTransform[node.name] && mathWithTransform[node.name].rawArgs) {
          return node;
        }
        {
          // Process operators as OperatorNode
          var operatorFunctions = ['add', 'multiply'];
          if (operatorFunctions.indexOf(node.name) === -1) {
            var args = node.args.map(function (arg) {
              return foldFraction(arg, options);
            });

            // If all args are numbers
            if (!args.some(_is.isNode)) {
              try {
                return _eval(node.name, args, options);
              } catch (ignoreandcontinue) {}
            }

            // Size of a matrix does not depend on entries
            if (node.name === 'size' && args.length === 1 && (0, _is.isArrayNode)(args[0])) {
              var sz = [];
              var section = args[0];
              while ((0, _is.isArrayNode)(section)) {
                sz.push(section.items.length);
                section = section.items[0];
              }
              return matrix(sz);
            }

            // Convert all args to nodes and construct a symbolic function call
            return new FunctionNode(node.name, args.map(_ensureNode));
          } else {
            // treat as operator
          }
        }
      /* falls through */
      case 'OperatorNode':
        {
          var fn = node.fn.toString();
          var _args;
          var res;
          var makeNode = createMakeNodeFunction(node);
          if ((0, _is.isOperatorNode)(node) && node.isUnary()) {
            _args = [foldFraction(node.args[0], options)];
            if (!(0, _is.isNode)(_args[0])) {
              res = _eval(fn, _args, options);
            } else {
              res = makeNode(_args);
            }
          } else if (isAssociative(node, options.context)) {
            _args = allChildren(node, options.context);
            _args = _args.map(function (arg) {
              return foldFraction(arg, options);
            });
            if (isCommutative(fn, options.context)) {
              // commutative binary operator
              var consts = [];
              var vars = [];
              for (var i = 0; i < _args.length; i++) {
                if (!(0, _is.isNode)(_args[i])) {
                  consts.push(_args[i]);
                } else {
                  vars.push(_args[i]);
                }
              }
              if (consts.length > 1) {
                res = foldOp(fn, consts, makeNode, options);
                vars.unshift(res);
                res = foldOp(fn, vars, makeNode, options);
              } else {
                // we won't change the children order since it's not neccessary
                res = foldOp(fn, _args, makeNode, options);
              }
            } else {
              // non-commutative binary operator
              res = foldOp(fn, _args, makeNode, options);
            }
          } else {
            // non-associative binary operator
            _args = node.args.map(function (arg) {
              return foldFraction(arg, options);
            });
            res = foldOp(fn, _args, makeNode, options);
          }
          return res;
        }
      case 'ParenthesisNode':
        // remove the uneccessary parenthesis
        return foldFraction(node.content, options);
      case 'AccessorNode':
        return _foldAccessor(foldFraction(node.object, options), foldFraction(node.index, options), options);
      case 'ArrayNode':
        {
          var foldItems = node.items.map(function (item) {
            return foldFraction(item, options);
          });
          if (foldItems.some(_is.isNode)) {
            return new ArrayNode(foldItems.map(_ensureNode));
          }
          /* All literals -- return a Matrix so we can operate on it */
          return matrix(foldItems);
        }
      case 'IndexNode':
        {
          return new IndexNode(node.dimensions.map(function (n) {
            return simplifyConstant(n, options);
          }));
        }
      case 'ObjectNode':
        {
          var foldProps = {};
          for (var prop in node.properties) {
            foldProps[prop] = simplifyConstant(node.properties[prop], options);
          }
          return new ObjectNode(foldProps);
        }
      case 'AssignmentNode':
      /* falls through */
      case 'BlockNode':
      /* falls through */
      case 'FunctionAssignmentNode':
      /* falls through */
      case 'RangeNode':
      /* falls through */
      case 'ConditionalNode':
      /* falls through */
      default:
        throw new Error("Unimplemented node type in simplifyConstant: ".concat(node.type));
    }
  }
  return simplifyConstant;
});
exports.createSimplifyConstant = createSimplifyConstant;