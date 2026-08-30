/**
 * Hermes (Expo Go / React Native) does not provide the DOMException global.
 * Libraries (AbortController, fetch, Redux Toolkit, etc.) throw
 * `ReferenceError: Property 'DOMException' doesn't exist` if this is missing.
 *
 * Must be imported before any other app code (see index.js).
 */
(function polyfillDOMException() {
  var g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : null;
  if (!g) {
    return;
  }

  try {
    if (typeof g.DOMException === 'function') {
      return;
    }
  } catch (_) {}

  function DOMException(message, name) {
    if (!(this instanceof DOMException)) {
      return new DOMException(message, name);
    }
    Error.call(this, message);
    this.message = message ? String(message) : '';
    this.name = name ? String(name) : 'Error';
    this.code = DOMException[this.name] || 0;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DOMException);
    } else {
      this.stack = new Error(this.message).stack;
    }
  }

  DOMException.prototype = Object.create(Error.prototype);
  DOMException.prototype.constructor = DOMException;
  DOMException.prototype.toString = function () {
    return this.name + ': ' + this.message;
  };

  DOMException.INDEX_SIZE_ERR = 1;
  DOMException.HIERARCHY_REQUEST_ERR = 3;
  DOMException.WRONG_DOCUMENT_ERR = 4;
  DOMException.INVALID_CHARACTER_ERR = 5;
  DOMException.NO_MODIFICATION_ALLOWED_ERR = 7;
  DOMException.NOT_FOUND_ERR = 8;
  DOMException.NOT_SUPPORTED_ERR = 9;
  DOMException.INUSE_ATTRIBUTE_ERR = 10;
  DOMException.INVALID_STATE_ERR = 11;
  DOMException.SYNTAX_ERR = 12;
  DOMException.INVALID_MODIFICATION_ERR = 13;
  DOMException.NAMESPACE_ERR = 14;
  DOMException.INVALID_ACCESS_ERR = 15;
  DOMException.SECURITY_ERR = 18;
  DOMException.NETWORK_ERR = 19;
  DOMException.ABORT_ERR = 20;
  DOMException.URL_MISMATCH_ERR = 21;
  DOMException.QUOTA_EXCEEDED_ERR = 22;
  DOMException.TIMEOUT_ERR = 23;
  DOMException.INVALID_NODE_TYPE_ERR = 24;
  DOMException.DATA_CLONE_ERR = 25;
  DOMException.IndexSizeError = 1;
  DOMException.AbortError = 20;
  DOMException.TimeoutError = 23;
  DOMException.NetworkError = 19;

  function install(target) {
    if (!target) {
      return;
    }
    try {
      Object.defineProperty(target, 'DOMException', {
        value: DOMException,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (_) {
      try {
        target.DOMException = DOMException;
      } catch (__) {}
    }
  }

  install(g);
  if (typeof global !== 'undefined' && global !== g) {
    install(global);
  }
})();
