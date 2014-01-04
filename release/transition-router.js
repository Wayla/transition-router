
/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(path, parent, orig) {
  var resolved = require.resolve(path);

  // lookup failed
  if (null == resolved) {
    orig = orig || path;
    parent = parent || 'root';
    var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
    err.path = orig;
    err.parent = parent;
    err.require = true;
    throw err;
  }

  var module = require.modules[resolved];

  // perform real require()
  // by invoking the module's
  // registered function
  if (!module._resolving && !module.exports) {
    var mod = {};
    mod.exports = {};
    mod.client = mod.component = true;
    module._resolving = true;
    module.call(this, mod.exports, require.relative(resolved), mod);
    delete module._resolving;
    module.exports = mod.exports;
  }

  return module.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path) {
  if (path.charAt(0) === '/') path = path.slice(1);

  var paths = [
    path,
    path + '.js',
    path + '.json',
    path + '/index.js',
    path + '/index.json'
  ];

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (require.modules.hasOwnProperty(path)) return path;
    if (require.aliases.hasOwnProperty(path)) return require.aliases[path];
  }
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `definition`.
 *
 * @param {String} path
 * @param {Function} definition
 * @api private
 */

require.register = function(path, definition) {
  require.modules[path] = definition;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to) {
  if (!require.modules.hasOwnProperty(from)) {
    throw new Error('Failed to alias "' + from + '", it does not exist');
  }
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj) {
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function localRequire(path) {
    var resolved = localRequire.resolve(path);
    return require(resolved, parent, path);
  }

  /**
   * Resolve relative to the parent.
   */

  localRequire.resolve = function(path) {
    var c = path.charAt(0);
    if ('/' == c) return path.slice(1);
    if ('.' == c) return require.normalize(p, path);

    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    var segs = parent.split('/');
    var i = lastIndexOf(segs, 'deps') + 1;
    if (!i) i = 0;
    path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
    return path;
  };

  /**
   * Check if module is defined at `path`.
   */

  localRequire.exists = function(path) {
    return require.modules.hasOwnProperty(localRequire.resolve(path));
  };

  return localRequire;
};
require.register("component-path-to-regexp/index.js", function(exports, require, module){
/**
 * Expose `pathtoRegexp`.
 */

module.exports = pathtoRegexp;

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Object} options
 * @return {RegExp}
 * @api private
 */

function pathtoRegexp(path, keys, options) {
  options = options || {};
  var sensitive = options.sensitive;
  var strict = options.strict;
  keys = keys || [];

  if (path instanceof RegExp) return path;
  if (path instanceof Array) path = '(' + path.join('|') + ')';

  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push({ name: key, optional: !! optional });
      slash = slash || '';
      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');

  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
};

});
require.register("component-route/index.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var toRegexp = require('path-to-regexp');

/**
 * Expose `Route`.
 */

module.exports = Route;

/**
 * Initialize a route with the given `path`.
 *
 * @param {String|Regexp} path
 * @return {Type}
 * @api public
 */

function Route(path) {
  this.path = path;
  this.keys = [];
  this.regexp = toRegexp(path, this.keys);
  this._before = [];
  this._after = [];
}

/**
 * Add before `fn`.
 *
 * @param {Function} fn
 * @return {Route} self
 * @api public
 */

Route.prototype.before = function(fn){
  this._before.push(fn);
  return this;
};

/**
 * Add after `fn`.
 *
 * @param {Function} fn
 * @return {Route} self
 * @api public
 */

Route.prototype.after = function(fn){
  this._after.push(fn);
  return this;
};

/**
 * Invoke callbacks for `type` with `args`.
 *
 * @param {String} type
 * @param {Array} args
 * @api public
 */

Route.prototype.call = function(type, args){
  args = args || [];
  var fns = this['_' + type];
  if (!fns) throw new Error('invalid type');
  for (var i = 0; i < fns.length; i++) {
    fns[i].apply(null, args);
  }
};

/**
 * Check if `path` matches this route,
 * returning `false` or an object.
 *
 * @param {String} path
 * @return {Object}
 * @api public
 */

Route.prototype.match = function(path){
  var keys = this.keys;
  var qsIndex = path.indexOf('?');
  var pathname = ~qsIndex ? path.slice(0, qsIndex) : path;
  var m = this.regexp.exec(pathname);
  var params = [];
  var args = [];

  if (!m) return false;

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = keys[i - 1];

    var val = 'string' == typeof m[i]
      ? decodeURIComponent(m[i])
      : m[i];

    if (key) {
      params[key.name] = undefined !== params[key.name]
        ? params[key.name]
        : val;
    } else {
      params.push(val);
    }

    args.push(val);
  }

  params.args = args;
  return params;
};

});
require.register("kaerus-component-microTask/index.js", function(exports, require, module){

(function(root){
    "use strict"

    try {root = global} catch(e){ try {root = window} catch(e){} };

    var defer, deferred, observer, queue = [];
    
    if(root.process && typeof root.process.nextTick === 'function'){
        /* avoid buggy nodejs setImmediate */ 
        if(root.setImmediate && root.process.versions.node.split('.')[1] > '10') defer = root.setImmediate;
        else defer = root.process.nextTick;
    } else if(root.vertx && typeof root.vertx.runOnLoop === 'function') defer = root.vertx.RunOnLoop;
    else if(root.vertx && typeof root.vertx.runOnContext === 'function') defer = root.vertx.runOnContext;
    else if(observer = root.MutationObserver || root.WebKitMutationObserver) {
        defer = (function(document, observer, drain) {
            var el = document.createElement('div');
                new observer(drain).observe(el, { attributes: true });
                return function() { el.setAttribute('x', 'y'); };
        }(document, observer, drain));
    }
    else if(typeof root.setTimeout === 'function' && (root.ActiveXObject || !root.postMessage)) {
        /* use setTimeout to avoid buggy IE MessageChannel */
        defer = function(f){ root.setTimeout(f,0); }
    }
    else if(root.MessageChannel && typeof root.MessageChannel === 'function') {
        var fifo = [], channel = new root.MessageChannel();
        channel.port1.onmessage = function () { (fifo.shift())() };
        defer = function (f){ fifo[fifo.length] = f; channel.port2.postMessage(0); };
    } 
    else if(typeof root.setTimeout === 'function') defer = function(f){ root.setTimeout(f,0); } 
    else throw new Error("No candidate for microTask defer()")

    deferred = head;

    function mikroTask(func,args){
        deferred(func,args);
    }

    function head(func,args){
        queue[queue.length] = [func,args]; 
        deferred = tail;
        defer(drain); 
    }

    function tail(func,args){
        queue[queue.length] = [func,args];
    }

    function drain(){      
        for(var i = 0; i < queue.length; i++){ queue[i][0].apply(null,queue[i][1]) }
        deferred = head;
        queue = [];
    }
    
    if(module && module.exports) module.exports = mikroTask;
    else if(typeof define ==='function' && define.amd) define(mikroTask); 
    else root.microTask = mikroTask;
}(this));
});
require.register("kaerus-component-uP/index.js", function(exports, require, module){
 /**      
 * Provides A+ v1.1 compliant promises.   
 * @module uP
 * @name microPromise
 * @main uP
 */

var task = require('microTask'); // nextTick shim

(function(root){
    "use strict"

    try {root = global} catch(e){ try {root = window} catch(e){} };

    var slice = Array.prototype.slice,
        isArray = Array.isArray;

    var uP = function microPromise(proto){
        // object mixin
        if(proto && typeof proto === 'object'){ 
            for(var key in uP.prototype) proto[key] = uP.prototype[key];
            proto._tuple = [];
            return proto;
        }

        if(!(this instanceof microPromise))
            return new microPromise(proto);

        this._tuple = [];

        // resolver callback
        if(typeof proto === 'function') {
            proto(this.resolve,this.reject,this.progress,this.timeout);
        }
    }

    /**
     * Attaches callback,errback,notify handlers and returns a promise 
     * 
     * Example: catch fulfillment or rejection
     *      var p = uP();
     *      p.then(function(value){
     *          console.log("received:", value);
     *      },function(error){
     *          console.log("failed with:", error);
     *      });
     *      p.fulfill('hello world!'); // => 'received: hello world!'
     *
     * Example: chainable then clauses
     *      p.then(function(v){
     *          console.log('v is:', v);
     *          if(v > 10) throw new RangeError('to large!');
     *          return v*2;
     *      }).then(function(v){ 
     *          // gets v*2 from above
     *          console.log('v is:', v)
     *      },function(e){
     *          console.log('error2:', e);
     *      });
     *      p.fulfill(142); // => v is: 142, error2: [RangeError:'to large']
     *
     * Example: undefined callbacks are ignored
     *      p.then(function(v){
     *          if(v < 0) throw v;
     *          return v;
     *      }).then(undefined,function(e){
     *          e = -e;
     *          return e;
     *      }).then(function(value){
     *          console.log('we got:', value);
     *      });
     *      p.fulfill(-5); // => we got: 5
     *      
     * @param {Function} onFulfill callback
     * @param {Function} onReject errback 
     * @param {Function} onNotify callback 
     * @return {Object} a decendant promise
     * @api public
     */
    uP.prototype.then = function(f,r,n){
        var p = new uP();

        this._tuple[this._tuple.length] = [p,f,r,n];

        if(this._state) task(resolver,[this._tuple,this._state,this._value]);

        return p;
    }
    /**
     * Same semantic as `then` but spreads array value into separate arguments 
     *
     * Example: Multiple fulfillment values
     *      p = uP();
     *      p.fulfill([1,2,3])
     *      p.spread(function(a,b,c){
     *          console.log(a,b,c); // => '1 2 3'
     *      });
     *  
     * @param {Function} onFulfill callback
     * @param {Function} onReject errback 
     * @param {Function} onNotify callback 
     * @return {Object} a decendant promise
     * @api public
     */
    uP.prototype.spread = function(f,r,n){  
        function s(v){
            if(!isArray(v)) v = [v];
            return f.apply(f,v); 
        }

        return this.then(s,r,n);
    }
    /**
     * Same as `then` but terminates a promise chain and calls onerror / throws error on unhandled Errors 
     *
     * Example: capture error with done
     *      p.then(function(v){
     *          console.log('v is:', v);
     *          if(v > 10) throw new RangeError('to large!');
     *          return v*2;
     *      }).done(function(v){ 
     *          // gets v*2 from above
     *          console.log('v is:', v)
     *      });
     *      p.fulfill(142); // => v is: 142, throws [RangeError:'to large']
     * Example: use onerror handler
     *      p.onerror = function(error){ console.log("Sorry:",error) };
     *      p.then(function(v){
     *          console.log('v is:', v);
     *          if(v > 10) throw new RangeError('to large!');
     *          return v*2;
     *      }).done(function(v){ 
     *          // gets v*2 from above
     *          console.log('v is:', v)
     *      });
     *      p.fulfill(142); // => v is: 142, "Sorry: [RangeError:'to large']"
     *
     * @param {Function} onFulfill callback
     * @param {Function} onReject errback 
     * @param {Function} onNotify callback 
     * @api public
     */
    uP.prototype.done = function(f,r,n){
    
        if(typeof r !== 'function') r = handleError;

        var self = this, p = this.then(f,r,n);
    
        function handleError(e){
            task(function(){
                if(typeof self.onerror === 'function'){
                    self.onerror(e);
                } else {
                    throw e;
                }
            });
        }
    }

    /**
     * Fulfills a promise with a `value` 
     * 
     *  Example: fulfillment
     *      p = uP();
     *      p.fulfill(123);
     *  
     *  Example: multiple fulfillment values in array
     *      p = uP();
     *      p.fulfill([1,2,3]);
     *      p.resolved; // => [1,2,3]
     *      
     * @param {Object} value
     * @return {Object} promise
     * @api public
     */
    uP.prototype.fulfill = function(x){
        if(!this._state){
            task(resolver,[this._tuple,this._state = 1,this._value = x]);
        }

        return this;    
    }

    /**
     * Resolves a promise with a `value` yielded from another promise 
     * 
     *  Example: resolve literal value
     *      p = uP();
     *      p.resolve(123); // fulfills promise with 123
     *      
     *  Example: resolve value from another pending promise
     *      p1 = uP();
     *      p2 = uP();
     *      p1.resolve(p2);
     *      p2.fulfill(123) // => p2._value = 123
     *      
     * @param {Object} value
     * @return {Object} promise
     * @api public
     */
    uP.prototype.resolve = function(x){
        var then, z = 0, p = this, z = 0;

        if(!this._state){
            if(x === p) p.reject(new TypeError("x === p"));

            if(x && (typeof x === 'object' || typeof x === 'function')){
                try { then = x.then } catch(e){ p.reject(e) }
            } 

            if(typeof then !== 'function'){
                task(resolver,[this._tuple,this._state = 1,this._value = x])   
            } else if(!z){
                try {
                    then.apply(x,[function(y){
                        if(!z++) p.resolve(y);
                    },function(r){
                        if(!z++) p.reject(r);
                    }]);
                } catch(e) {
                    if(!z++) p.reject(e);
                }  
            }
        }

        return this;
    }

    /**
     * Rejects promise with a `reason`
     *
     *  Example:
     *      p = uP();
     *      p.then(function(ok){
     *         console.log("ok:",ok);
     *      }, function(error){
     *         console.log("error:",error);
     *      });
     *      p.reject('some error'); // outputs => 'error: some error' 
     *      
     * @param {Object} reason 
     * @return {Object} promise
     * @api public
     */
    uP.prototype.reject = function(x){
        if(!this._state){
            task(resolver,[this._tuple,this._state = 2,this._value = x]);
        }

        return this;    
    }

    /**
     * Notifies attached handlers
     *
     *  Example:
     *      p = uP();
     *      p.then(function(ok){
     *         console.log("ok:",ok);
     *      }, function(error){
     *         console.log("error:",error);
     *      }, function(notify){
     *         console.log(notify);
     *      });
     *      p.progress("almost done"); // optputs => 'almost done' 
     *      p.reject('some error'); // outputs => 'error: some error' 
     *      
     * @param {Object} arguments 
     * @api public
     */
    uP.prototype.progress = function(){
        var args = slice.call(arguments), fn;
        for(var i = 0, l = this._tuple.length; i < l; i++){
            if(typeof (fn = this._tuple[i][3]) === 'function')
                fn.apply(this,arguments);
        }
    }

    /**
     * Timeout a pending promise and invoke callback function on timeout.
     * Without a callback it throws a RangeError('exceeded timeout').
     *
     * Example: timeout & abort()
     *      var p = Promise();
     *      p.attach({abort:function(msg){console.log('Aborted:',msg)}});
     *      p.timeout(5000);
     *      // ... after 5 secs ... => Aborted: |RangeError: 'exceeded timeout']
     *      
     * Example: cancel timeout
     *      p.timeout(5000);
     *      p.timeout(null); // timeout cancelled
     *            
     * @param {Number} time timeout value in ms or null to clear timeout
     * @param {Function} callback optional timeout function callback
     * @throws {RangeError} If exceeded timeout  
     * @return {Object} promise
     * @api public
     */
    uP.prototype.timeout = function(msec,func){
        var p = this;

        if(msec === null) {
            clearTimeout(p._timer);
            p._timer = null;
        } else if(!p._timer){             
            p._timer = setTimeout(onTimeout,msec);
        }       

        function onTimeout(){ 
            var e = RangeError("exceeded timeout");
            if(!p._state) {
                if(typeof func === 'function') func(p);
                else if(typeof p.onerror === 'function') p.onerror(e);
                else throw e;
            }
        }

        return this;
    }

    /**
     * Wraps a `proto` into a promise
     * 
     * Example: wrap an Array
     *      p = Promise();
     *      c = p.wrap(Array);
     *      c(1,2,3); // => calls constructor and fulfills promise 
     *      p.resolved; // => [1,2,3]
     *
     * @param {Object} proto
     * @return {Object} promise
     * @api public
     */
    uP.prototype.wrap = function(proto){
        var p = this;

        return function(){
            var args = slice.call(arguments), ret;

            if(proto instanceof uP){
                proto.fulfill(args).then(p.fulfill,p.reject);
            } else if(typeof proto === 'function'){
                try{
                    ret = proto.apply(p,args);
                    p.resolve(ret);
                } catch(err) {
                    p.reject(err);
                }
            }
                
            return p;
        }              
    }
    /**
     * Deferres a task and fulfills with return value.
     * The process may also return a promise itself which to wait on.  
     * 
     * Example: Make readFileSync async
     *      fs = require('fs');
     *      var asyncReadFile = uP().defer(fs.readFileSync,'./index.js','utf-8');
     *      asyncReadFile.then(function(data){
     *          console.log(data)
     *      },function(error){
     *          console.log("Read error:", error);
     *      });
     *         
     * @return {Object} promise
     * @api public
     */
    uP.prototype.defer = function(){
        var args = slice.call(arguments),
            proc = args.shift(),
            p = this;

        if(typeof proc === 'function'){
            task(enclose,args);
        }

        function enclose(){
            try { p.resolve(proc.apply(p,args)) } catch(err) { p.reject(err) } 
        }

        return this;
    }
    /**
     * Adapted for nodejs style functions expecting a callback. 
     * 
     * Example: make readFile async
     *      fs = require('fs');
     *      var asyncReadFile = uP.async(fs.readFile,'./index.js','utf-8');
     *      asyncReadFile.then(function(data){
     *          console.log(data);
     *      },function(error){
     *          console.log("Read error:", error);
     *      });
     *         
     * @return {Object} promise
     * @api public
     */
    uP.prototype.async = function(){
        var p = this,
            args = slice.call(arguments);

        function callback(err,ret){ if(!err) p.fulfill(ret); else p.reject(ret); }

        args[args.length] = callback;

        return this.defer.apply(this,args);
    }

    /**
     * Joins promises and collects results into an array.
     * If any of the promises are rejected the chain is also rejected.  
     * 
     * Example: join with two promises
     *      a = uP();
     *      b = uP();
     *      c = uP();
     *      a.join([b,c]).spread(function(a,b,c){
     *          console.log(a,b,c);
     *      },function(err){
     *          console.log('error=',err);
     *      });
     *      b.fulfill('world');
     *      a.fulfill('hello'); 
     *      c.fulfill('!'); // => 'hello world !''
     *
     * @param {Array} promises
     * @return {Object} promise
     * @api public
     */
    uP.prototype.join = function(j){
        var p = this, 
            y = [], 
            u = new uP().resolve(p).then(function(v){y[0] = v});

        if(arguments.length > 1) {
            j = slice.call(arguments);
        }

        if(!isArray(j)) j = [j];

        function collect(i){
            j[i].done(function(v){
                y[i+1] = v;
            },u.reject);

            return function(){return j[i]}    
        }

        for(var i = 0; i < j.length; i++){
            u = u.then(collect(i));
        }
        
        return u.then(function(){return y});
    }


    /* Resolver function, yields back a promised value to handlers */
    function resolver(tuple,state,value){
        var t, p, h, x = value;

        while(t = tuple.shift()) {
            p = t[0];
            h = t[state];

            if(typeof h === 'function') {
                try {
                    x = h(value);
                    p.resolve(x);
                } catch(e) {
                    p.reject(e);
                }     
            } else {
                p._state = state;
                p._value = x;
                task(resolver,[p._tuple, p._state, p._value]);
            }
        }
    }

    /* expose this module */
    if(module && module.exports) module.exports = uP;
    else if(typeof define ==='function' && define.amd) define(uP); 
    else root.uP = uP;
}(this));


});
require.register("kewah-mixin/index.js", function(exports, require, module){
if (typeof Object.keys === 'function') {
  module.exports = function(to, from) {
    Object.keys(from).forEach(function(property) {
      Object.defineProperty(to, property, Object.getOwnPropertyDescriptor(from, property));
    });
  };
} else {
  module.exports = function(to, from) {
    for (var property in from) {
      if (from.hasOwnProperty(property)) {
        to[property] = from[property];
      }
    }
  };
}

});
require.register("transition-router/src/transition-router.js", function(exports, require, module){
var states //would be ideal if we could store state
           //in the pushState state object - but apparently
           //there's a size limit
           //https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Manipulating_the_browser_history
  , Promise = require('micropromise')
  , Route = require('route')
  , PromiseQueue = require('./promise-queue')
  , persistence = require('./persistence')
  , mixin = require('mixin')
  , everPushedSomething
  , initialUrl = location.href
  , animationQueue //a queue of calls to animateBetweenPages()

//generateNextElement() should return an element which will be animated into the viewport

//the PromiseQueue is used to ebsure that only one route transion occurs at a time :)

animationQueue = new PromiseQueue

module.exports = Router

function Router(options) {

  this.containerElement = options.containerElement
  this.persistence = options.persistence || false

  if (this.persistence) mixin(this,persistence())

  this.routes = []

  //should this stuff go in here?

  this.lastPath = document.location.pathname + document.location.search

  if (this.persistence) this.restore()

  window.addEventListener('popstate', function(event) {
    var onloadPop = !everPushedSomething && location.href == initialUrl
    everPushedSomething = true
    if (onloadPop) return

    this.dispatch(window.document.location.pathname, { direction : 'back'})
    if (this.persistence) this.persist(window.document.location.pathname)

  }.bind(this))

}

Router.prototype.go = function(path,metadata) {

  everPushedSomething = true

  if(this.lastPath !== path) {
    if (this.persistence) persist(path)
    history.pushState({}, "title", path)
    this.dispatch(path,metadata)
  }

}

//can invoke in two different ways:
//get(route, handler)
//get(route, middleware, handler)

Router.prototype.get = function(){

  var path = arguments[0]
    , middleware
    , generateNextElement

  //get(route, handler)
  if (arguments.length === 2) {
    middleware = undefined
    generateNextElement = arguments[1]
  }
  //get(route, middleware, handler)
  else if (arguments.length === 3) {
    middleware = arguments[1]
    generateNextElement = arguments[2]
  }
  else {
    throw "invalid number of arguments"
  }

  var route = new Route(path)
  this.routes.push(route)
  route.before(function (options) {

    var args = options.args
    var metadata = options.metadata || {}



    var next = function () {
      var nextElement
      nextElement = generateNextElement.apply(null, args)
      //so we dont execute the transition right away, we queue it up until any current animations finish (though most probably the queue is empty and it will get executed right away)
      animationQueue.enqueue(function () { return animateBetweenPages({
        direction : metadata.direction,
        nextElement : nextElement,
        currentElement : this.containerElement.children[0] || null, //probably a better way to determine this that doesnt depend on the DOM (i.e. children[0])
                                                                    //null === tehre isn't an existing page (i.e. initial load)
                                                                    //basically we're saying that this.containerElement.children.length === 0 means that it's initial load
        containerElement : this.containerElement
      }) }.bind(this))
    }.bind(this)
    //maybe i should use https://github.com/segmentio/ware
    if (middleware) middleware(next) //the middleware is supposed to call next() - if there's no middleware, then we call next() ourselves
    else next()
  }.bind(this))
  return route
}


Router.prototype.dispatch = function(path, metadata){

  var ret
  for (var i = 0; i < this.routes.length; i++) {
    var route = this.routes[i]
    if (ret = route.match(path)) {
      this.route = route
      this.args = ret.args
      route.call('before', [{ args : ret.args, metadata : metadata}])
      break
    }
  }
}


function animateBetweenPages(options) {

  var finishedAnimatingPromise = new Promise // Helps to keep two route transitions from happening at the same time
                                             // and helps ensure that one route change finishes before the next one occurs
                                             // In the future, maybe we can cancel route changes instead of waiting for them to finish?
                                             // Used by the PromiseQueue



  options = options || {}

  options.order = options.order || 'addThenRemove'
  //options.keepCurrentElement = options.keepCurrentElement || false //TODO: dont think this is doing anything ATM

  var nextElement       = options.nextElement
    , currentElement    = options.currentElement //null in the case of initial load
    , containerElement  = options.containerElement
    , direction         = options.direction

  //elementCache isnt currently being used
  //var elementCache = {} //probably better to use like Component.set or ecma sets if such a thing exists
                        //elementCache will only be used if options.keepCurrentElement === true

  var Classes = {
    Show : 'show' //i'd like to use .adding and .removing, but the current css markup is using .show a lot
  }

  /*
    promises and event listeners
  */

  //is it cool that we assume that these promises will only be resolved once?

  var nextElementAnimationEndPromise = new Promise
    , currentElementAnimationEndPromise = new Promise

  if (!currentElement) {currentElementAnimationEndPromise.fulfill()} //in the case of initial load, just fulfill the promise right away. otherwise the promise gets resolved when animationend occurs

  currentElement && currentElement.addEventListener('transitionend', function () { //no event listener if currentElement === null
    currentElementAnimationEndPromise.fulfill()
  })

  var nextElementAnimationEndListener = function () {
    nextElement.removeEventListener('transitionend', nextElementAnimationEndListener)
    nextElementAnimationEndPromise.fulfill()
  }

  nextElement.addEventListener('transitionend', nextElementAnimationEndListener)

  /*
    end promises and event listeners
  */

  switch (options.order){
    case 'parallel':

      requestAnimationFrame(function () {


        if (direction === 'back') {
          containerElement.insertBefore(nextElement, containerElement.firstChild) //does this need to be done in a requestAnimationFrame that is seperate from the one in which .adding is added?
        }
        else {
          containerElement.appendChild(nextElement) //does this need to be done in a requestAnimationFrame that is seperate from the one in which .adding is added?
        }

        currentElement && currentElement.classList.remove(Classes.Show)  //Classes.Show should specify an outro transition - if it doesnt, the currentElementAnimationEndPromise will never get resolved
        requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) }) //without the requestAnimationFrame, the loading animation never occurs

        currentElementAnimationEndPromise //if an element doesnt have an animation, i dont think this promise will ever get resolved...
          .then(function () {
            currentElement && containerElement.removeChild(currentElement)
          })

        nextElementAnimationEndPromise
          .then(function () {
            //nextElement.classList.remove(Classes.Adding)
          })

        // Since we are using micropromises, we dont have a Q.all() (see https://github.com/kriskowal/q),
        // which is basically what the following statement represents. The order in which these promises
        // are fulfilled doesn't matter.

        currentElementAnimationEndPromise
          .then(function () {return nextElementAnimationEndPromise})
          .then(function (){ finishedAnimatingPromise.fulfill()})

      })

    break
  // not sure there's a use case for removeThenAdd, so commenting out
  //
  // case 'removeThenAdd': //the currentElement will go through its remove transition first, then the nextElement will go through its add transition.
  //                       //the currentElement does get added right away though

  //   requestAnimationFrame(function () {

  //     currentElement.classList.remove(Classes.Show)

  //     currentElementAnimationEndPromise
  //       .then(function () {
  //         containerElement.removeChild(currentElement)
  //         containerElement.appendChild(nextElement)
  //         requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) })
  //       })

  //     nextElementAnimationEndPromise
  //       .then(function () {
  //         //nextElement.classList.remove(Classes.Adding)
  //       })

  //   })

  //   break
  case 'addThenRemove': //the nextElement will go through its add transition first, then the currentElement will go through its remove transition
                        //obviously (I guess), the currentElement does get removed until it finishes its remove transition

    requestAnimationFrame(function () {

      //TODO: incorporate this back functionality into the other orders
      if (direction === 'back') {
        containerElement.insertBefore(nextElement, containerElement.firstChild)
      }
      else {
        containerElement.appendChild(nextElement)
      }

      requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) })

      currentElementAnimationEndPromise
        .then(function () {
          currentElement && containerElement.removeChild(currentElement)
          finishedAnimatingPromise.fulfill()
        })

      nextElementAnimationEndPromise
        .then(function () {
          //currentElement && currentElement.classList.remove(Classes.Adding)
          currentElement && currentElement.classList.remove(Classes.Show)
        })

     })

    break
  default:
    throw 'invalid order ' + options.order

  }

  return finishedAnimatingPromise

}

});
require.register("transition-router/src/promise-queue.js", function(exports, require, module){
module.exports = PromiseQueue

function PromiseQueue() {

  var _queueOfPromiseProducingFunctions = []
  var _currentlyExecutingPromise = undefined

  function _executeNextPromiseProducingFunction() {

    //assumption: _queueOfPromiseProducingFunctions.length > 0

    var promiseProducingFunctionToExecute = _queueOfPromiseProducingFunctions.splice(0,1)[0]
    _currentlyExecutingPromise = promiseProducingFunctionToExecute()
    _currentlyExecutingPromise
      .then(function () {
        if (_queueOfPromiseProducingFunctions.length) {
          _executeNextPromiseProducingFunction()
        }
        else {
          _currentlyExecutingPromise = undefined
          //then wait for the next call to enqueue()
        }
      })
  }

  this.enqueue = function (promiseProducingFunction) {
    if (!_currentlyExecutingPromise && !_queueOfPromiseProducingFunctions.length) { //may be redundant to also check for _queueOfPromiseProducingFunctions.length - also we'd be stuck if _queueOfPromiseProducingFunctions.length > 0 but _currentlyExecutingPromise === undefined
      _queueOfPromiseProducingFunctions.push(promiseProducingFunction)
      _executeNextPromiseProducingFunction()
      return
    }
    else {
      _queueOfPromiseProducingFunctions.push(promiseProducingFunction)
      return
    }

  }

}

});






require.alias("component-route/index.js", "transition-router/deps/route/index.js");
require.alias("component-route/index.js", "route/index.js");
require.alias("component-path-to-regexp/index.js", "component-route/deps/path-to-regexp/index.js");

require.alias("kaerus-component-uP/index.js", "transition-router/deps/micropromise/index.js");
require.alias("kaerus-component-uP/index.js", "micropromise/index.js");
require.alias("kaerus-component-microTask/index.js", "kaerus-component-uP/deps/microTask/index.js");

require.alias("kewah-mixin/index.js", "transition-router/deps/mixin/index.js");
require.alias("kewah-mixin/index.js", "transition-router/deps/mixin/index.js");
require.alias("kewah-mixin/index.js", "mixin/index.js");
require.alias("kewah-mixin/index.js", "kewah-mixin/index.js");
require.alias("transition-router/releases/transition-router.js", "transition-router/index.js");