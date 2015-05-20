

This a extending code with some modification from [Promises/A+](http://promises-aplus.github.com/promises-spec/) implementation.

It is designed to get the basics spot on correct, so that you can build extended promise implementations on top of it.

## API

```javascript

var promise = require('./promise'); 

var promiseSomeTask = promise(function (resolve, reject) {
    get('http://www.baidu.com', function (err, res) {
      if (err) reject(err);
      else resolve(res);
    });
  });
```

## Important Points

  1 : promise --- is lowercase with the initial letter
  2 : promise --- has only one method : then
  3 : 1st argument for promise is function, and the 2nd can be 
  ---true if u need catch some error when the sync codes running 
  4 : the promise is not a construtor but a factory 
  5 : when rejected, the onRejecting callback can receive 2 args ------ 1st : the error
  ------ 2nd : the value for the current resolved ! 

### Inheritance

  You can use inheritance if you want to create your own complete promise library with this as your basic starting point, perfect if you have lots of cool features you want to add.  Here is an example of a promise library called `Awesome`, which is built on top of `Promise` correctly.

```javascript
var promise = require('./promise');
function Awesome(fn) {
  if (!(this instanceof Awesome)) return new Awesome(fn);
  this.then = promise(fn).then;
}

//Awesome extension
Awesome.prototype.spread = function (cb) {
  return this.then(function (arr) {
    return cb.apply(this, arr);
  })
};
```

  N.B. if you fail to set the prototype and constructor properly or fail to do Promise.call, things can fail in really subtle ways.

## License

  MIT
