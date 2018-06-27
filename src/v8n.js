function v8n() {
  const context = {
    chain: []
  };

  return buildProxy(context, contextProxyHandler);
}

// Storage for user defined rules
v8n.customRules = {};

const contextProxyHandler = {
  get: function(obj, prop, receiver) {
    if (prop === "not") {
      receiver.invert = true;
      return receiver;
    }
    if (prop in v8n.customRules) {
      return buildProxy(v8n.customRules[prop], ruleProxyHandler(prop));
    }
    if (prop in rules) {
      return buildProxy(rules[prop], ruleProxyHandler(prop));
    }
    if (prop in core) {
      return core[prop];
    }
    if (prop in obj) {
      return obj[prop];
    }
  }
};

const ruleProxyHandler = name => ({
  apply: function(target, thisArg, args) {
    const fn = target.apply(rules, args);
    thisArg.chain.push({
      name,
      fn,
      args,
      invert: !!thisArg.invert
    });
    delete thisArg.invert;
    return thisArg;
  }
});

function buildProxy(target, handler) {
  return new Proxy(target, handler);
}

const core = {
  test(value) {
    return this.chain.every(rule => {
      try {
        return rule.fn(value) !== rule.invert;
      } catch (ex) {
        return rule.invert;
      }
    });
  },

  check(value) {
    this.chain.forEach(rule => {
      try {
        if (rule.fn(value) === rule.invert) {
          throw new Error("Rule has failed");
        }
      } catch (ex) {
        throw { rule, value, cause: ex };
      }
    });
  }
};

const rules = {
  pattern: testPattern,

  // Types
  string: makeTestType("string"),
  number: makeTestType("number"),
  boolean: makeTestType("boolean"),
  undefined: makeTestType("undefined"),
  null: makeTestType("null"),
  array: makeTestType("array"),

  // Pattern
  lowercase: makeTestPattern(/^([a-z]+\s*)+$/),
  uppercase: makeTestPattern(/^([A-Z]+\s*)+$/),
  vowel: makeTestPattern(/^[aeiou]+$/i),
  consonant: makeTestPattern(/^(?=[^aeiou])([a-z]+)$/i),

  // Value at
  first: makeTestValueAt(0),
  last: makeTestValueAt(-1),

  // Length
  empty: makeTestLength(true, true),
  length: makeTestLength(true, true),
  minLength: makeTestLength(true, false),
  maxLength: makeTestLength(false, true),

  // Range
  negative: makeTestRange(undefined, -1),
  positive: makeTestRange(0, undefined),
  between: makeTestRange(),

  even: makeTestDivisible(2, true),
  odd: makeTestDivisible(2, false),

  includes(expected) {
    return testIncludes(expected);
  }
};

function testPattern(pattern) {
  return value => pattern.test(value);
}

function makeTestPattern(pattern) {
  return () => testPattern(pattern);
}

function makeTestType(type) {
  return () => value =>
    typeof value === type || (Array.isArray(value) && type === "array");
}

function makeTestValueAt(index) {
  return expected => value => {
    const i = index < 0 ? value.length + index : index;
    return value[i] == expected;
  };
}

function makeTestLength(useMin, useMax) {
  return (min, max) => value => {
    let valid = true;
    if (useMin) valid = valid && value.length >= (min || 0);
    if (useMax) valid = valid && value.length <= (max || min || 0);
    return valid;
  };
}

function makeTestRange(defaultMin, defaultMax) {
  return (min, max) => value => {
    min = min || defaultMin;
    max = max || defaultMax;

    let valid = true;
    if (min !== undefined) valid = valid && value >= min;
    if (max !== undefined) valid = valid && value <= max;

    return valid;
  };
}

function makeTestDivisible(by, expected) {
  return () => value => (value % by === 0) === expected;
}

function testIncludes(expected) {
  return value => value.indexOf(expected) !== -1;
}

export default v8n;
