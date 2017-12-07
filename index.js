const http = require('http');
const url = require('url');

const addCustomResMethods = require('./lib/res.methods');
const { errors: { defaultResponse } } = require('./lib/middlewares');
const { getParams,
  PathObject } = require('./lib/url_path');

function Hexpress() {
  this.middlewares = [];
  this.errorMiddlewares = [defaultResponse];
}

Hexpress.prototype.get = function (path, handler) {
  this.middlewares.push({
    type: 'route',
    path: new PathObject(path, 'GET'),
    handler
  });
};

Hexpress.prototype.post = function (path, handler) {
  this.middlewares.push({
    type: 'route',
    path: new PathObject(path, 'POST'),
    handler
  });
};

Hexpress.prototype.put = function (path, handler) {
  this.middlewares.push({
    type: 'route',
    path: new PathObject(path, 'PUT'),
    handler
  });
};

Hexpress.prototype.delete = function (path, handler) {
  this.middlewares.push({
    type: 'route',
    path: new PathObject(path, 'DELETE'),
    handler
  });
};

Hexpress.prototype.use = function (mw) {
  if (mw.length === 4) this.errorMiddlewares.splice(this.errorMiddlewares.length - 1, 0, mw);
  else {
    this.middlewares.push({
      type: 'custom',
      path: null,
      handler: mw
    });
  }
};

// app.get('/api', (req, res, next) => {
//   next('Some error');
// });

const defaultError = {
  error: 'Internal server error'
};

Hexpress.prototype.listen = function (...args) {
  const nodeServer = http.createServer((req, res) => {
    const { pathname } = url.parse(req.url);
    const method = req.method;
    res = addCustomResMethods(res);

    const tryMiddlewares = (middlewares, req, res, err = defaultError) => {
      if (middlewares.length === 0) return tryErrorMiddlewares(this.errorMiddlewares, err, req, res);
      const mw = middlewares[0];
      if (mw.type === 'custom') {
        mw.handler(req, res, (err) => {
          if (err) return tryMiddlewares([], req, res, err);
          return tryMiddlewares(middlewares.slice(1), req, res);
        });
      } else if (mw.path && mw.path.method === method) {
        if (!mw.path.parameterized && (mw.path.path === pathname)) return mw.handler(req, res, (err) => {
          if (err) tryMiddlewares([], req, res, err);
        });
        else if (!mw.path.parameterized && (mw.path.path !== pathname)) return tryMiddlewares(middlewares.slice(1), req, res);
        else if (mw.path.regex.test(pathname)) {
          const params = getParams(mw.path.fragments, pathname);
          req.params = params;
          return mw.handler(req, res, (err) => {
            if (err) tryMiddlewares([], req, res, err);
          });
        }
      }
    };

    const tryErrorMiddlewares = (errorMiddlewares, err, req, res) => {
      let mw = errorMiddlewares[0];
      mw(err, req, res, (error = err) => {
        tryErrorMiddlewares(errorMiddlewares.slice(1), error, req, res);
      });
    };

    tryMiddlewares(this.middlewares, req, res);

  });

  nodeServer.listen(...args);
  return nodeServer;
};

module.exports = Hexpress;