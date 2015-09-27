;(function (root) {

  var nextTick,
    __Promise = root.Promise,
    slice = Array.prototype.slice,
    toString = Object.prototype.toString,
    isPromise = function (obj) {
      return obj && typeof obj.then === 'function';
    },
    defaultResolve = function (value) {
      return value;
    },
    defaultReject = defaultResolve,
    isError = function (o) {
      return !!o && typeof o === 'object' && (
        toString.call(o) === '[object Error]' ||
        o instanceof Error );
    },
    isObject = function (o) {
      return o && toString.call(o) === '[object Object]';
    },
    hasError = function (o) {
      return isError(o) || o === false;
    },
    extendObject = function (o, src) {
      var result = src || {};

      if (isObject(o)) {
        for (var prop in o) {
          if (o.hasOwnProperty(prop)) {
            if (prop === 'mode' && result[prop]) {
              continue;
            }

            if (prop === 'name' && result.name && Promise.promises[result.name]) {
              continue;
            }

            result[prop] = o[prop];
          }
        }
      }

      return result;
    },
    pickArray = function (args) {
      return Array.isArray(args[0]) ?
        args[0] :
        slice.call(args);
    };

  if (typeof process === 'object' && process.nextTick) {
    nextTick = process.nextTick;
  }
  else if (typeof setImmediate === 'function') {
    nextTick = setImmediate;
  }
  else {
    nextTick = function (cb) {
      setTimeout(cb, 0);
    };
  }

  function settle(_promiseState, reason, value) {
    if (_promiseState.isSettled) {
      return;
    }
    _promiseState.isSettled = true;
    _promiseState.reason = reason;
    _promiseState.value = value;

    if (typeof _promiseState.waiting === 'function') {
      _promiseState.waiting();
    }
    else {
      nextTick(function () {
        if (typeof _promiseState.waiting === 'function') {
          _promiseState.waiting();
        }
      });
    }
  }

  function waitForSettle(previousState, onResolving, onRejecting, thenResolve, thenReject) {
    return function () {
      var value,
        hasError = !previousState.isResolved,
        failedPass = false;

      try {
        value = hasError ?
          onRejecting(previousState.reason, previousState.opts) :
          onResolving(previousState.value, previousState.opts);
      } catch (reason) {
        failedPass = true;
        thenReject(reason);
      }

      Promise.unset(previousState);
      previousState.isOver = true;

      if (!failedPass) {
        if (!hasError) {
          thenResolve(value);
        }
        else {
          thenReject(value);
        }
      }
    };
  }

  function handleInnerPromise(_promiseState, innerPromise) {
    var success = function (value) {
        if (Promise.isPromise(value)) {
          handleInnerPromise(_promiseState, value);
        }
        else {
          settle(_promiseState, null, value);
        }
      },
      fail = function (reason) {
        _promiseState.isResolved = false;
        _promiseState.isRejected = true;
        settle(_promiseState, reason);
      };

    try {
      innerPromise.then(success, fail);
    } catch (reason) {
      fail(reason);
    }
  }

  function Promise(fn) {
    if (!(this instanceof Promise)) {
      return new Promise(fn);
    }

    var self = this;

    self.guid = Promise.guid++;
    Promise.idMap[self.guid] = self;

    self._promiseState = {
      isResolved: false,
      isRejected: false,
      isSettled: false,
      isOver: false,
      reason: null,
      value: null,
      progressValue : null,
      //-----------------
      waiting: null,
      opts : null,
      progressCallback : null,
      doneCallback : null,
      failCallback : null
    };

    self._promiseState.opts = {};
    self._promiseState._resolve = Promise._resolve.bind(self);
    self._promiseState._reject  = Promise._reject.bind(self);

    if (typeof fn === 'function' && fn.length >= 1) {
      self._promiseState.opts.mode = 'init_fire';

      try {
        fn(self._promiseState._resolve, self._promiseState._reject);
      }
      catch (reason) {
        self._promiseState._reject(reason);
      }

      return self;
    }

    self._promiseState.opts.mode = 'not_init_fire';

    if (typeof fn === 'string') {
      self._promiseState.opts.name = fn;
    }
    else {
      extendObject(fn, self.getOptions());
    }

    if (self._promiseState.opts.name) {
      Promise.promises[self._promiseState.opts.name] =
      Promise.promises[self._promiseState.opts.name] || self;
    }
  }

  Promise._resolve = function (value) {
    if (this._promiseState.isResolved) {
      return;
    }
    this._promiseState.isResolved = true;

    if (Promise.isPromise(value)) {
      handleInnerPromise(this._promiseState, value);
    }
    else {
      settle(this._promiseState, null, value);
    }
  };

  Promise._reject = function (reason) {
    if (this._promiseState.isRejected) {
      return;
    }
    this._promiseState.isRejected = true;

    settle(this._promiseState, reason);
  };

  Promise.prototype.then = function (onResolving, onRejecting) {
    var self = this;
    if (self.isPending() && !self._promiseState.waiting) {
      return new Promise(function (thenResolve, thenReject) {
        self._promiseState.waiting = waitForSettle(
          self._promiseState,
          onResolving || self._promiseState.doneCallback || defaultResolve,
          onRejecting || self._promiseState.failCallback || defaultReject,
          thenResolve,
          thenReject );
      });
    }

    var error = new Error("Promise.prototype.then: already has waiting or not pending !\n");

    if (Promise.debugType === 'development') {
      console.warn(self);
      throw error;
    }
    else if (!self.isRejected() &&
      typeof self._promiseState.failCallback === 'function') {
      self.reject(error);
    }
  };

  Promise.guid = 1;
  Promise.idMap = {};
  Promise.promises = {};
  Promise.getPromise = function (name) {
    return (typeof name === 'string' && Promise.promises[name]) ||
      (typeof name === 'number' && Promise.idMap[name]);
  };

  Promise.factory = function (fn) {
    var commitment = typeof fn !== 'function' &&
      Promise.getPromise(fn);

    if (commitment && commitment.isPending()) {
      return commitment;
    }
    return new Promise(fn);
  };

  Promise.defaultResolve = defaultResolve;
  Promise.defaultReject = defaultReject;
  Promise.isPromise = isPromise;
  Promise.isError = isError;
  Promise.hasError = hasError;
  Promise.noConflict = function () {
    if (__Promise !== void 0) {
      root.Promise = __Promise;
    }
    return Promise;
  };

  Promise.debugType = 'development';
  Promise.setDebugType = function (type) {
    Promise.debugType = type;
  };

  Promise.error = function (err) {
    throw new Error(err);
  };

  Promise.logError = function (err) {
    console.log(err);
    return err;
  };

  Promise.reset = function (name) {
    var commitment = isPromise(name) ?
      name :
      Promise.getPromise(name);

    if (commitment && commitment.isOver()) {
      extendObject({
        isResolved: false,
        isRejected: false,
        isSettled: false,
        isOver : false,
        reason: null,
        value: null,
        progressValue : null,
      }, commitment._promiseState );

      commitment._promiseState.opts.mode = 'not_init_fire';
      commitment._promiseState._resolve = Promise._resolve.bind(commitment);
      commitment._promiseState._reject  = Promise._reject.bind(commitment);

      return true;
    }

    return false;
  };

  Promise.unset = function (promiseState) {

    extendObject({
      _resolve : null,
      _reject : null,
      waiting : null,
      progressCallback : null,
      doneCallback : null,
      failCallback : null
    }, promiseState );
  };

  function tellAll(state, arr) {

    arr = arr.reduce(function (memo, v, i) {
      memo.commitments.push(v[0]);
      memo.values.push(v[1]);
      return memo;
    }, { commitments : [], values : [] });

    var values = arr.values;
    var commitments = arr.commitments;
    var results = [];
    var allArePromise = commitments.every(function (commitment, index) {
      if (isPromise(commitment)) {

        if (state === 'resolve') {
          if (commitment.isSolving()) {
            results[index] = commitment;
          }
          else {
            commitment.resolve(values[index]);
          }
        }
        else if (state === 'reject') {
          if (commitment.isSolving()) {
            results[index] = commitment;
          }
          else {
            commitment.reject(values[index]);
          }
        }
        else if (state === 'notify') {
          if (commitment.isPending() &&
            typeof commitment._promiseState.progress === 'function') {
            commitment.notify(values[index]);
          }
          else {
            results[index] = commitment;
          }
        }

        return true;
      }

      return false;
    });

    return allArePromise &&
      ( !results.length ? true : results );
  };

  function handleOnePromise(state, o, v) {
    if (!~['resolve', 'reject', 'notify'].indexOf(state)) {
      return false;
    }

    if (typeof o === 'object' && isPromise(o) && o.isPending()) {
      o[state](v);
      return true;
    }
    else if (typeof o === 'string' || typeof o === 'number') {
      return handleOnePromise(state, Promise.getPromise(o), v);
    }

    return false;
  }

  Promise.resolve = function (o, v) {
    return handleOnePromise('resolve', o, v);
  };

  Promise.reject = function (o, v) {
    return handleOnePromise('reject', o, v);
  };

  Promise.notify = function (o, v) {
    return handleOnePromise('notify', o, v);
  };

  Promise.resolveAll = function (/*...array */) {
    return tellAll('resolve', slice.call(arguments));
  };

  Promise.rejectAll = function (/*...array */) {
    return tellAll('reject', slice.call(arguments));
  };

  Promise.notifyAll = function (/*...array */) {
    return tellAll('notify', slice.call(arguments));
  };

  Promise.nodeify = function (nodejsCallback, ctx) {
    return function (value, done, fail) {
      var commitment = new Promise(function (resolve, reject) {
        var memoryDone = function  (err, value) {
          if (hasError(err)) {
            reject(err);
          }
          else if (arguments.length <= 2) {
            resolve(value);
          }
          else {
            resolve(core_slice.call(arguments, 1));
          }
        };

        if (hasError(value)) {
          reject(value);
        }
        else if (Array.isArray(value)) {
          if (hasError(value[0])) {
            reject(value[0]);
          }
          else {
            nodejsCallback.apply((ctx || null), value.concat(memoryDone));
          }
        }
        else {
          nodejsCallback(value, memoryDone);
        }
      });

      if (done || fail) {
        return commitment.then(done, fail);
      }

      return commitment;
    };
  };

  function addStateCallback(who, state, fn) {
    if (who.isPending() && typeof fn === 'function') {
      switch (state) {
        case 'progress' :
        case 'done'     :
        case 'fail'     :
          who._promiseState[state + 'Callback'] =
            who._promiseState[state + 'Callback'] || fn;
          break;
      }
    }

    return who;
  }

  Promise.prototype.progress = function (fn) {
    return addStateCallback(this, 'progress', fn);
  };

  Promise.prototype.done = function (fn) {
    return addStateCallback(this, 'done', fn);
  };

  Promise.prototype.fail = function (fn) {
    return addStateCallback(this, 'fail', fn);
  };

  Promise.prototype.ready = function (onResolving, onRejecting) {
    if (this.isPending() && !this._promiseState.waiting) {
      return this.then(onResolving, onRejecting);
    }
    return this;
  };

  Promise.prototype.resolve = function (v) {
    if (this.isPending()) {
      this._promiseState._resolve(v);
    }
  };

  Promise.prototype.reject = function (reason) {
    if (this.isPending()) {
      this._promiseState._reject(reason);
    }
  };

  Promise.prototype.notify = function (v, opts) {
    if (this.isPending() &&
      typeof this._promiseState.progressCallback === 'function') {
      this._promiseState.progressValue = this._promiseState.progressCallback(v, opts);
    }
  };

  function raceOrWaterFall(who, isRace, args) {
    if (who.isSolving()) {
      return;
    }

    commitments = pickArray(args);
    var resolve = who._promiseState._resolve;
    var reject = who._promiseState._reject;

    commitments.forEach(function (commitment, index) {
      if (isPromise(commitment)) {
        if (isRace) {
          commitment.then(resolve, reject);
        }
        else {
          who = who.then(
            commitment._promiseState.progressCallback || Promise.defaultResolve,
            Promise.defaultReject );
        }
      }
      else if (typeof commitment === 'function') {
        if (isRace) {
          var ret = commitment();
          if ((isPromise(ret))) {
            ret.then(resolve, reject);
          }
        }
        else {
          who = who.then(commitment, Promise.defaultReject);
        }
      }
    });

    return who;
  };

  Promise.prototype.waterFall = function (commitments) {
    return raceOrWaterFall(this, false, arguments);
  };

  Promise.prototype.race = function (commitments) {
    return raceOrWaterFall(this, true, arguments);
  };

  Promise.prototype.value = function () {
    if (this.isResolved()) {
      return this._promiseState.value;
    }
  };

  Promise.prototype.reason = function () {
    if (this.isRejected()) {
      return this._promiseState.reason;
    }
  };

  Promise.prototype.progressValue = function () {
    return this._promiseState.progressValue;
  };

  Promise.prototype.toString = function () {
    return "[object Promise]";
  };

  Promise.prototype.isPending = function () {
    return !this._promiseState.isSettled &&
      !this._promiseState.isResolved &&
      !this._promiseState.isRejected;
  };

  Promise.prototype.isSolving = function () {
    return this._promiseState.isRejected || this._promiseState.isResolved;
  };

  Promise.prototype.isSettled = function () {
    return this._promiseState.isSettled;
  };

  Promise.prototype.isRejected = function () {
    return this._promiseState.isSettled && this._promiseState.isRejected;
  };

  Promise.prototype.isResolved = function () {
    return this._promiseState.isSettled && this._promiseState.isResolved;
  };

  Promise.prototype.isOver = function () {
    return this._promiseState.isSettled && this._promiseState.isOver;
  };

  Promise.prototype.getState = function () {
    return {
      isSettled  : this.isSettled(),
      isResolved : this.isResolved(),
      isRejected : this.isRejected(),
      isPending  : this.isPending(),
      isSolving  : this.isSolving(),
      isOver     : this.isOver()
    };
  };

  Promise.prototype["catch"] = function (fn) {
    return this.then(null, fn);
  };

  Promise.prototype.always = function (fn) {
    return this.then(fn, fn);
  };

  function judgeWhen(who, check, timeout, fn /*... promises */) {
    if (!who.isPending()) {
      return who;
    }

    var index = typeof timeout === 'number' && typeof fn === 'function' ? 4 :
              typeof timeout === 'number' ? 3 :
              2,
      commitments = pickArray(slice.call(arguments, index)),
      opts = {};

    typeof timeout === 'number' && (opts.timeout = timeout);
    typeof fn === 'function' && (opts.timeoutCallback = fn);

    new Promise(opts)
      .when(commitments)
      .always(function (arr) {
        if (hasError(arr)) {
          return who.reject(arr);
        }

        var expected = check(arr);
        if (!hasError(expected)) {
          who.resolve(expected);
        }
        else {
          who.reject(expected);
        }
      });

    return who;
  }

  function filterWhenResults(arr) {
    var results = [];
    results.target = {
      hasTruthy : false,
      hasFalsy : false
    };

    arr.forEach(function (v) {
      if (!hasError(v) && !!v) {
        results.target.hasTruthy = true;
        results.push(v);
      }
      else {
        results.target.hasFalsy = true;
        results.push(v);
      }
    });

    return results;
  }

  Promise.prototype.whenAllResolved = function (timeout, fn /*... promises */) {
    return judgeWhen.apply(null, [this, function (arr) {
      arr = filterWhenResults(arr);
      return !arr.target.hasFalsy ?
        arr.slice() :
        new Error('not all resolved:\n ' + arr);
    }].concat(slice.call(arguments)));
  };

  Promise.prototype.whenAnyResolved = function (timeout, fn /*... promises */) {
    return judgeWhen.apply(null, [this, function (arr) {
      arr = filterWhenResults(arr);

      return arr.target.hasTruthy ?
        arr.slice() :
        new Error('no resolved value, all has Error or false:\n ' + arr);
    }].concat(slice.call(arguments)));
  };

  Promise.prototype.whenOneResolved = function (n, timeout, fn /*... promises */) {
    var self = this;

    return judgeWhen.apply(null, [this, function (arr) {
      var array = filterWhenResults(arr);

      return hasError(array[n]) || !arr[n] ?
        new Error('target: [' + n + '] is not resolved:' + '\n' +
          'arr.length: ' + array.length + '\n' + array ) :
        array.slice();
    }].concat(slice.call(arguments, 1)));
  };

  Promise.prototype.when = function (/*... promises */) {
    if (!arguments.length || this.isSolving()) {
      return;
    }

    var self = this,
      results = [],
      args = pickArray(arguments),
      len = args.length,
      count = len,
      i = -1,
      commitment,
      options = self.getOptions(),
      timeout = options.timeout,
      progress = function (v) {
        if (v !== void 0) {
          results[this.index] = v;
        }
        if (--count <= 0) {
          self.resolve(results);
        }
      };

    if (typeof timeout === 'number' && timeout > 0) {
      setTimeout(function () {
        var ret;

        if (self.isPending()) {
          if (typeof options.timeoutCallback === 'function') {
            ret = options.timeoutCallback(results);

            if (options.timeoutCallbackOnlyOnce) {
              options.timeoutCallback = null;
            }
          }

          if (ret !== false) {
            self.reject(new Error(
              'Promise.prototype.when: timeout: ' + timeout +
              '\nresults: ' + results ) );
          }
        }
      }, timeout);
    }

    while (++i < len) {
      commitment = args[i];

      if (!commitment || !isPromise(commitment)) {
        if (typeof commitment === 'function') {
          results[i] = commitment();
        }
        else {
          results[i] = commitment;
        }
        count--;
      }
      else {
        commitment.always(progress.bind({index : i}));
      }
    }

    if (!count) {
      progress();
    }

    return self;
  };

  Promise.prototype.getOptions = function (key) {
    this._promiseState.opts = this._promiseState.opts || {};
    return !key || typeof key !== 'string' ?
      this._promiseState.opts :
      this._promiseState.opts[key];
  };

  Promise.prototype.setOptions = function (opts) {
    if (!opts || typeof opts !== 'object') {
      extendObject({}, this.getOptions());
      return this;
    }
    else {
      extendObject(opts, this.getOptions());
    }

    var name = this.getOptions().name;
    if (name && !Promise.promises[name]) {
      Promise.promises[name] = this;
    }
    return this;
  };

  if (!!root.window && root.window === root) {
    if (typeof define === 'function' && define.amd) {
      define(function () {
        return Promise;
      });
    }
    else {
      root.Promise = Promise;
    }
  }
  else if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  }

})(this);