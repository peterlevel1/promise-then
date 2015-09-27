

This a extending code with some modification from [Promises/A+](http://promises-aplus.github.com/promises-spec/) implementation.

It is designed to get the basics spot on correct, so that you can build extended promise implementations on top of it.

## API

```javascript

var Promise = require('./promise');

var promiseSomeTask = new Promise(function (resolve, reject) {
    get('http://www.baidu.com', function (err, res) {
      if (err) reject(err);
      else resolve(res);
    });
  });
```

### Inheritance

  You can use inheritance if you want to create your own complete promise library with this as your basic starting point, perfect if you have lots of cool features you want to add.  Here is an example of a promise library called `Awesome`, which is built on top of `Promise` correctly.

```javascript
var Promise = require('./promise');
var factory = Promise.factory;

function Awesome(name) {
  if (!(this instanceof Awesome)) return new Awesome(fn);
  this.name = name;
  this.then = factory(name).then;
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
