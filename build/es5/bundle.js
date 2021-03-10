(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@babel/runtime/helpers/toConsumableArray'), require('@babel/runtime/helpers/slicedToArray'), require('rxjs'), require('rxjs-broker'), require('rxjs/operators'), require('@babel/runtime/helpers/classCallCheck'), require('@babel/runtime/helpers/createClass'), require('@babel/runtime/helpers/defineProperty'), require('@babel/runtime/helpers/inherits'), require('@babel/runtime/helpers/possibleConstructorReturn'), require('@babel/runtime/helpers/getPrototypeOf'), require('backoff-rxjs'), require('rxjs-connector'), require('rxjs-etc/operators'), require('subscribable-things'), require('timing-object')) :
    typeof define === 'function' && define.amd ? define(['exports', '@babel/runtime/helpers/toConsumableArray', '@babel/runtime/helpers/slicedToArray', 'rxjs', 'rxjs-broker', 'rxjs/operators', '@babel/runtime/helpers/classCallCheck', '@babel/runtime/helpers/createClass', '@babel/runtime/helpers/defineProperty', '@babel/runtime/helpers/inherits', '@babel/runtime/helpers/possibleConstructorReturn', '@babel/runtime/helpers/getPrototypeOf', 'backoff-rxjs', 'rxjs-connector', 'rxjs-etc/operators', 'subscribable-things', 'timing-object'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.timingProvider = {}, global._toConsumableArray, global._slicedToArray, global.rxjs, global.rxjsBroker, global.operators, global._classCallCheck, global._createClass, global._defineProperty, global._inherits, global._possibleConstructorReturn, global._getPrototypeOf, global.backoffRxjs, global.rxjsConnector, global.operators$1, global.subscribableThings, global.timingObject));
}(this, (function (exports, _toConsumableArray, _slicedToArray, rxjs, rxjsBroker, operators, _classCallCheck, _createClass, _defineProperty, _inherits, _possibleConstructorReturn, _getPrototypeOf, backoffRxjs, rxjsConnector, operators$1, subscribableThings, timingObject) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var _toConsumableArray__default = /*#__PURE__*/_interopDefaultLegacy(_toConsumableArray);
    var _slicedToArray__default = /*#__PURE__*/_interopDefaultLegacy(_slicedToArray);
    var _classCallCheck__default = /*#__PURE__*/_interopDefaultLegacy(_classCallCheck);
    var _createClass__default = /*#__PURE__*/_interopDefaultLegacy(_createClass);
    var _defineProperty__default = /*#__PURE__*/_interopDefaultLegacy(_defineProperty);
    var _inherits__default = /*#__PURE__*/_interopDefaultLegacy(_inherits);
    var _possibleConstructorReturn__default = /*#__PURE__*/_interopDefaultLegacy(_possibleConstructorReturn);
    var _getPrototypeOf__default = /*#__PURE__*/_interopDefaultLegacy(_getPrototypeOf);

    var createEstimateOffset = function createEstimateOffset(performance) {
      return function (dataChannelSubject) {
        var pingSubject = rxjsBroker.mask({
          action: 'ping'
        }, dataChannelSubject);
        var pongSubject = rxjsBroker.mask({
          action: 'pong'
        }, dataChannelSubject); // Respond to every ping event with the current value returned by performance.now().

        var pingSubjectSubscription = pingSubject.subscribe(function () {
          return pongSubject.send(performance.now());
        });
        return rxjs.zip(rxjs.interval(1000).pipe(operators.startWith(), // @todo It should be okay to send an empty message.
        operators.tap(function () {
          return pingSubject.send(undefined);
        }), operators.map(function () {
          return performance.now();
        })), pongSubject).pipe(operators.finalize(function () {
          return pingSubjectSubscription.unsubscribe();
        }), // This will compute the offset with the formula "remoteTime - localTime".
        operators.map(function (_ref) {
          var _ref2 = _slicedToArray__default['default'](_ref, 2),
              pingTime = _ref2[0],
              pongTime = _ref2[1];

          return pongTime - (pingTime + performance.now()) / 2;
        }), operators.scan(function (latestValues, newValue) {
          return [].concat(_toConsumableArray__default['default'](latestValues.slice(-4)), [newValue]);
        }, []), // @todo Do fire an update event whenever the offset changes.
        operators.map(function (values) {
          return values.reduce(function (sum, currentValue) {
            return sum + currentValue;
          }, 0) / values.length;
        }), operators.map(function (offset) {
          return offset / 1000;
        }));
      };
    };

    var createEventTargetConstructor = function createEventTargetConstructor(createEventTarget, wrapEventListener) {
      return /*#__PURE__*/function () {
        function EventTarget() {
          _classCallCheck__default['default'](this, EventTarget);

          this._listeners = new WeakMap();
          this._nativeEventTarget = createEventTarget();
        }

        _createClass__default['default'](EventTarget, [{
          key: "addEventListener",
          value: function addEventListener(type, listener, options) {
            if (listener !== null) {
              var wrappedEventListener = this._listeners.get(listener);

              if (wrappedEventListener === undefined) {
                wrappedEventListener = wrapEventListener(this, listener);

                if (typeof listener === 'function') {
                  this._listeners.set(listener, wrappedEventListener);
                }
              }

              this._nativeEventTarget.addEventListener(type, wrappedEventListener, options);
            }
          }
        }, {
          key: "dispatchEvent",
          value: function dispatchEvent(event) {
            return this._nativeEventTarget.dispatchEvent(event);
          }
        }, {
          key: "removeEventListener",
          value: function removeEventListener(type, listener, options) {
            var wrappedEventListener = listener === null ? undefined : this._listeners.get(listener);

            this._nativeEventTarget.removeEventListener(type, wrappedEventListener === undefined ? null : wrappedEventListener, options);
          }
        }]);

        return EventTarget;
      }();
    };

    var createEventTargetFactory = function createEventTargetFactory(window) {
      return function () {
        if (window === null) {
          throw new Error('A native EventTarget could not be created.');
        }

        return window.document.createElement('p');
      };
    };

    function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

    function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty__default['default'](target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

    function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf__default['default'](Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf__default['default'](this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn__default['default'](this, result); }; }

    function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }
    var SUENC_URL = 'wss://matchmaker.suenc.io';
    var PROVIDER_ID_REGEX = /^[\dA-Za-z]{20}$/;
    var createTimingProviderConstructor = function createTimingProviderConstructor(estimateOffset, eventTargetConstructor, performance, setTimeout) {
      return /*#__PURE__*/function (_eventTargetConstruct) {
        _inherits__default['default'](TimingProvider, _eventTargetConstruct);

        var _super = _createSuper(TimingProvider);

        function TimingProvider(providerIdOrUrl, isMain) {
          var _this;

          _classCallCheck__default['default'](this, TimingProvider);

          // tslint:disable-next-line:no-console
          console.log('TimingProvider constructor url', providerIdOrUrl, 'isMain', isMain);
          _this = _super.call(this);
          var timestamp = performance.now() / 1000;
          _this._isMain = isMain;
          _this._endPosition = Number.POSITIVE_INFINITY;
          _this._error = null;
          _this._onadjust = null;
          _this._onchange = null;
          _this._onreadystatechange = null;
          _this._providerIdOrUrl = providerIdOrUrl;
          _this._readyState = 'connecting';
          _this._remoteRequestsSubscription = null;
          _this._remoteUpdatesSubscription = null;
          _this._skew = 0;
          _this._startPosition = Number.NEGATIVE_INFINITY;
          _this._updateRequestsSubject = new rxjs.Subject();
          _this._vector = {
            acceleration: 0,
            position: 0,
            timestamp: timestamp,
            velocity: 0
          };

          _this._createClient();

          return _this;
        }

        _createClass__default['default'](TimingProvider, [{
          key: "destroy",
          value: function destroy() {
            var _this2 = this;

            if (this._remoteRequestsSubscription === null || this._remoteUpdatesSubscription === null) {
              throw new Error('The timingProvider is already destroyed.');
            }

            this._readyState = 'closed';

            this._remoteRequestsSubscription.unsubscribe();

            this._remoteRequestsSubscription = null;

            this._remoteUpdatesSubscription.unsubscribe();

            this._remoteUpdatesSubscription = null;

            this._updateRequestsSubject.complete();

            setTimeout(function () {
              return _this2.dispatchEvent(new Event('readystatechange'));
            });
          }
        }, {
          key: "update",
          value: function update(newVector) {
            if (this._remoteUpdatesSubscription === null) {
              return Promise.reject(new Error("The timingProvider is destroyed and can't be updated."));
            }

            this._updateRequestsSubject.next(_objectSpread(_objectSpread({}, timingObject.translateTimingStateVector(this._vector, performance.now() / 1000 - this._vector.timestamp)), timingObject.filterTimingStateVectorUpdate(newVector)));

            return Promise.resolve();
          }
        }, {
          key: "_createClient",
          value: function _createClient() {
            var _this3 = this;

            var url = PROVIDER_ID_REGEX.test(this._providerIdOrUrl) ? "".concat(SUENC_URL, "?providerId=").concat(this._providerIdOrUrl) : this._providerIdOrUrl;
            var subjectConfig = {
              openObserver: {
                next: function next() {
                  _this3._readyState = 'open';

                  _this3.dispatchEvent(new Event('readystatechange'));
                }
              }
            };
            var dataChannelSubjects = rxjs.concat(rxjs.from(subscribableThings.online()).pipe(operators$1.equals(true), operators.first(), operators.ignoreElements()), rxjs.defer(function () {
              return rxjsConnector.accept(url, subjectConfig);
            })).pipe(backoffRxjs.retryBackoff({
              initialInterval: 1000,
              maxRetries: 3
            }), operators.catchError(function (err) {
              // tslint:disable-next-line:no-console
              console.error('TimingProvider server connection err', err);

              _this3._doCloseError(err);

              return rxjs.EMPTY;
            }), operators.map(function (dataChannel) {
              return rxjsBroker.wrap(dataChannel);
            }), operators.publish() // tslint:disable-line:rxjs-no-connectable
            );
            var updateSubjects = dataChannelSubjects.pipe(operators.map(function (dataChannelSubject) {
              return rxjsBroker.mask({
                type: 'update'
              }, dataChannelSubject);
            }));
            var currentlyActiveUpdateSubjects = updateSubjects.pipe(operators.expand(function (updateSubject) {
              return updateSubject.pipe(operators.catchError(function () {
                return rxjs.EMPTY;
              }), operators.ignoreElements(), operators.endWith(updateSubject));
            }), operators.scan(function (activeUpdateSubjects, activeUpdateSubject) {
              var index = activeUpdateSubjects.indexOf(activeUpdateSubject);

              if (index > -1) {
                return [].concat(_toConsumableArray__default['default'](activeUpdateSubjects.slice(0, index)), _toConsumableArray__default['default'](activeUpdateSubjects.slice(index + 1)));
              }

              return [].concat(_toConsumableArray__default['default'](activeUpdateSubjects), [activeUpdateSubject]);
            }, []), operators.startWith([]));

            this._updateRequestsSubject.pipe(operators.withLatestFrom(currentlyActiveUpdateSubjects)).subscribe(function (_ref) {
              var _ref2 = _slicedToArray__default['default'](_ref, 2),
                  vector = _ref2[0],
                  activeUpdateSubjects = _ref2[1];

              // tslint:disable-next-line:no-console
              console.log('TimingProvider _updateRequestsSubject send');
              activeUpdateSubjects.forEach(function (activeUpdateSubject) {
                try {
                  activeUpdateSubject.send(_objectSpread(_objectSpread({}, vector), {}, {
                    isMain: _this3._isMain
                  }));
                } catch (err) {
                  // tslint:disable-next-line:no-console
                  console.error('TimingProvider isMain update send err', err);
                }
              });

              if (_this3._isMain) {
                _this3._setInternalVector(vector);
              }
            });

            this._remoteRequestsSubscription = updateSubjects.pipe(operators.withLatestFrom(dataChannelSubjects), operators.mergeMap(function (_ref3, index) {
              var _ref4 = _slicedToArray__default['default'](_ref3, 2),
                  updateSubject = _ref4[0],
                  dataChannelSubject = _ref4[1];

              var requestSubject = rxjsBroker.mask({
                type: 'request'
              }, dataChannelSubject);

              if (index === 0) {
                try {
                  requestSubject.send(undefined);
                } catch (err) {
                  // tslint:disable-next-line:no-console
                  console.error('TimingProvider request undefined err', err);

                  if (!_this3._isMain) {
                    _this3._doCloseError(err);
                  }
                }
              }

              return requestSubject.pipe(operators.mapTo(updateSubject));
            })).subscribe(function (updatesSubject) {
              try {
                updatesSubject.send(_objectSpread(_objectSpread({}, _this3._vector), {}, {
                  isMain: _this3._isMain
                }));
              } catch (err) {
                // tslint:disable-next-line:no-console
                console.error('TimingProvider request vector err', err);

                if (!_this3._isMain) {
                  _this3._doCloseError(err);
                }
              }
            });
            this._remoteUpdatesSubscription = updateSubjects.pipe(operators.withLatestFrom(dataChannelSubjects), operators.mergeMap(function (_ref5) {
              var _ref6 = _slicedToArray__default['default'](_ref5, 2),
                  updateSubject = _ref6[0],
                  dataChannelSubject = _ref6[1];

              return rxjs.combineLatest([updateSubject, estimateOffset(dataChannelSubject)]).pipe(operators.catchError(function (err) {
                // tslint:disable-next-line:no-console
                console.error('TimingProvider estimateOffset err', err);
                return rxjs.EMPTY;
              }), operators.distinctUntilChanged(function (_ref7, _ref8) {
                var _ref9 = _slicedToArray__default['default'](_ref7, 1),
                    vectorA = _ref9[0];

                var _ref10 = _slicedToArray__default['default'](_ref8, 1),
                    vectorB = _ref10[0];

                return vectorA === vectorB;
              }));
            })).subscribe(function (_ref11) {
              var _ref12 = _slicedToArray__default['default'](_ref11, 2),
                  _ref12$ = _ref12[0],
                  acceleration = _ref12$.acceleration,
                  position = _ref12$.position,
                  isMain = _ref12$.isMain,
                  remoteTimestamp = _ref12$.timestamp,
                  velocity = _ref12$.velocity,
                  offset = _ref12[1];

              var timestamp = remoteTimestamp - offset;

              if (_this3._isMain) {
                var vector = timingObject.translateTimingStateVector(_this3._vector, performance.now() / 1000 - _this3._vector.timestamp);

                _this3._updateRequestsSubject.next(vector);
              } else if (isMain) {
                _this3._setInternalVector({
                  acceleration: acceleration,
                  position: position,
                  timestamp: timestamp,
                  velocity: velocity
                });
              }
            });
            dataChannelSubjects.connect();
          }
        }, {
          key: "_doCloseError",
          value: function _doCloseError(err) {
            this._error = err;
            this._readyState = 'closed';
            this.dispatchEvent(new Event('readystatechange'));
            this.dispatchEvent(new ErrorEvent('error', {
              error: err
            }));
          }
        }, {
          key: "_setInternalVector",
          value: function _setInternalVector(vector) {
            this._vector = vector;
            this.dispatchEvent(new CustomEvent('change', {
              detail: vector
            }));
          }
        }, {
          key: "endPosition",
          get: function get() {
            return this._endPosition;
          }
        }, {
          key: "error",
          get: function get() {
            return this._error;
          }
        }, {
          key: "onadjust",
          get: function get() {
            return this._onadjust === null ? this._onadjust : this._onadjust[0];
          },
          set: function set(value) {
            if (this._onadjust !== null) {
              this.removeEventListener('adjust', this._onadjust[1]);
            }

            if (typeof value === 'function') {
              var boundListener = value.bind(this);
              this.addEventListener('adjust', boundListener);
              this._onadjust = [value, boundListener];
            } else {
              this._onadjust = null;
            }
          }
        }, {
          key: "onchange",
          get: function get() {
            return this._onchange === null ? this._onchange : this._onchange[0];
          },
          set: function set(value) {
            if (this._onchange !== null) {
              this.removeEventListener('change', this._onchange[1]);
            }

            if (typeof value === 'function') {
              var boundListener = value.bind(this);
              this.addEventListener('change', boundListener);
              this._onchange = [value, boundListener];
            } else {
              this._onchange = null;
            }
          }
        }, {
          key: "onreadystatechange",
          get: function get() {
            return this._onreadystatechange === null ? this._onreadystatechange : this._onreadystatechange[0];
          },
          set: function set(value) {
            if (this._onreadystatechange !== null) {
              this.removeEventListener('readystatechange', this._onreadystatechange[1]);
            }

            if (typeof value === 'function') {
              var boundListener = value.bind(this);
              this.addEventListener('readystatechange', boundListener);
              this._onreadystatechange = [value, boundListener];
            } else {
              this._onreadystatechange = null;
            }
          }
        }, {
          key: "readyState",
          get: function get() {
            return this._readyState;
          }
        }, {
          key: "skew",
          get: function get() {
            return this._skew;
          }
        }, {
          key: "startPosition",
          get: function get() {
            return this._startPosition;
          }
        }, {
          key: "vector",
          get: function get() {
            return this._vector;
          }
        }]);

        return TimingProvider;
      }(eventTargetConstructor);
    };

    var wrapEventListener = function wrapEventListener(target, eventListener) {
      return function (event) {
        var descriptor = {
          value: target
        };
        Object.defineProperties(event, {
          currentTarget: descriptor,
          target: descriptor
        });

        if (typeof eventListener === 'function') {
          return eventListener.call(target, event);
        }

        return eventListener.handleEvent.call(target, event);
      };
    };

    var timingProviderConstructor = createTimingProviderConstructor(createEstimateOffset(performance), createEventTargetConstructor(createEventTargetFactory(window), wrapEventListener), performance, setTimeout);
     // @todo Expose an isSupported flag which checks for fetch and performance.now() support.

    exports.TimingProvider = timingProviderConstructor;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
