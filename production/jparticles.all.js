'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * 规定：
 *  defaultConfig：默认配置项，需挂载到构造函数对象上
 *
 * 对象的属性
 *  set: 参数配置
 *  set.color: 颜色
 *  set.resize: 自适应
 *
 *  c: canvas对象
 *  cw: canvas宽度
 *  ch: canvas高度
 *  cxt: canvas 2d 绘图环境
 *  container: {DOM Element} 包裹canvas的容器
 *  dots: {array} 通过arc绘制的粒子对象集
 *  [dot].x: 通过arc绘制的粒子的x值
 *  [dot].y: 通过arc绘制的粒子的y值
 *  paused: {boolean} 是否暂停
 *
 * 对象的方法
 *  color：返回随机或设定好的粒子颜色
 *
 * 子类原型对象的方法
 *  init: 初始化配置或方法调用
 *  draw: 绘图函数
 *
 * 继承 Base 父类的方法
 *  pause: 暂停粒子运动
 *  open: 开启粒子运动
 *  resize: 自适应窗口
 */
var version = '2.0.0';
var win = window;
var doc = document;
var random = Math.random,
    floor = Math.floor;
var isArray = Array.isArray;


var canvasSupport = !!doc.createElement('canvas').getContext;
var defaultCanvasWidth = 485;
var defaultCanvasHeight = 300;
var regExp = {
    trimAll: /\s/g,
    styleValue: /^\d+(\.\d+)?[a-z]+$/i
};

function pInt(str) {
    return parseInt(str, 10);
}

function trimAll(str) {
    return str.replace(regExp.trimAll, '');
}

function randomColor() {
    // http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript
    return '#' + random().toString(16).slice(-6);
}

/**
 * 限制随机数的范围
 * @param max {number}
 * @param min {number}
 * @returns {number}
 */
function limitRandom(max, min) {
    return max === min ? max : random() * (max - min) + min;
}

/**
 * 对象的复制，跟jQuery extend方法一致（站在jQuery的肩膀之上）。
 * extend( target [, object1 ] [, objectN ] )
 * extend( [ deep ,] target, object1 [, objectN ] )
 * @returns {object}
 */
function extend() {
    var arg = arguments,
        target = arg[0] || {},
        deep = false,
        length = arg.length,
        i = 1,
        value = void 0,
        attr = void 0;

    if (isBoolean(target)) {
        deep = target;
        target = arg[1] || {};
        i++;
    }

    for (; i < length; i++) {
        for (attr in arg[i]) {

            value = arg[i][attr];

            if (deep && (isPlainObject(value) || isArray(value))) {

                target[attr] = extend(deep, isArray(value) ? [] : {}, value);
            } else {
                target[attr] = value;
            }
        }
    }

    return target;
}

/**
 * 对象的检测
 * @param obj {*} 需要检测的对象
 * @param type {string} 对象所属类型
 * @returns {boolean}
 */
function typeChecking(obj, type) {
    // 直接使用 toString.call(obj) 在 ie 会下报错
    return Object.prototype.toString.call(obj) === type;
}

function isFunction(obj) {
    return typeChecking(obj, '[object Function]');
}

function isPlainObject(obj) {
    return typeChecking(obj, '[object Object]');
}

function isElement(obj) {
    // document(nodeType===9)不能是element，因为它没有很多element该有的属性
    // 如用getComputedStyle获取不到它的宽高，就会报错
    // 当传入0的时候，不加!!会返回0，而不是Boolean值
    return !!(obj && obj.nodeType === 1);
}

function isString(val) {
    return typeof val === 'string';
}

function isBoolean(val) {
    return typeof val === 'boolean';
}

/**
 * 获取对象的css属性值
 * @param elem {element}
 * @param attr {string}
 * @returns {string|number}
 */
function getCss(elem, attr) {
    var val = win.getComputedStyle(elem)[attr];

    // 对于属性值是 200px 这样的形式，返回 200 这样的数字值
    return regExp.styleValue.test(val) ? pInt(val) : val;
}

/**
 * 获取对象距离页面的top、left值
 * @param elem {element}
 * @returns {{left: (number), top: (number)}}
 */
function offset(elem) {
    var left = elem.offsetLeft || 0;
    var top = elem.offsetTop || 0;
    while (elem = elem.offsetParent) {
        left += elem.offsetLeft;
        top += elem.offsetTop;
    }
    return {
        left: left,
        top: top
    };
}

function on(elem, evtName, handler) {
    elem.addEventListener(evtName, handler);
}

function off(elem, evtName, handler) {
    elem.removeEventListener(evtName, handler);
}

function setCanvasWH(context) {
    context.cw = context.c.width = getCss(context.container, 'width') || defaultCanvasWidth;
    context.ch = context.c.height = getCss(context.container, 'height') || defaultCanvasHeight;
}

/**
 * 计算刻度值
 * @param val {number} 乘数，(0, 1)表示被乘数的倍数，0 & [1, +∞)表示具体数值
 * @param scale {number} 被乘数
 * @returns {number}
 */
function scaleValue(val, scale) {
    return val > 0 && val < 1 ? scale * val : val;
}

/**
 * 计算速度值
 * @param max {number}
 * @param min {number}
 * @returns {number}
 */
function calcSpeed(max, min) {
    return (limitRandom(max, min) || max) * (random() > .5 ? 1 : -1);
}

/**
 * 设置color函数
 * @param color {string|array} 颜色数组
 * @returns {function}
 */
function setColor(color) {
    var colorLength = isArray(color) ? color.length : false;
    var recolor = function recolor() {
        return color[floor(random() * colorLength)];
    };
    return isString(color) ? function () {
        return color;
    } : colorLength ? recolor : randomColor;
}

// 暂停粒子运动
function _pause(context, callback) {
    // 没有set表示实例创建失败，防止错误调用报错
    if (context.set && !context.paused) {
        // 传递 pause 关键字供特殊使用
        isFunction(callback) && callback.call(context, 'pause');
        context.paused = true;
    }
}

// 开启粒子运动
function _open(context, callback) {
    if (context.set && context.paused) {
        isFunction(callback) && callback.call(context, 'open');
        context.paused = false;
        context.draw();
    }
}

// 自适应窗口，重新计算粒子坐标
function _resize(context, callback) {
    if (context.set.resize) {
        // 不采用函数节流，会出现卡顿延迟效果
        on(win, 'resize', function () {
            var oldCW = context.cw;
            var oldCH = context.ch;

            // 重新设置canvas宽高
            setCanvasWH(context);

            // 计算比例
            var scaleX = context.cw / oldCW;
            var scaleY = context.ch / oldCH;

            // 重新赋值
            if (isArray(context.dots)) {
                context.dots.forEach(function (v) {
                    if (isPlainObject(v)) {
                        v.x *= scaleX;
                        v.y *= scaleY;
                    }
                });
            }

            isFunction(callback) && callback.call(context, scaleX, scaleY);

            context.paused && context.draw();
        });
    }
}

/**
 * 修改原型上的方法
 * 使用：utils.modifyPrototype(fn, 'pause', function(){})
 * @param prototype {Object} 原型对象
 * @param names {string} 方法名，多个方法名用逗号隔开
 * @param callback {function} 回调函数
 */
function modifyPrototype(prototype, names, callback) {
    // 将方法名转成数组格式，如：'pause, open'
    if (canvasSupport) {
        trimAll(names).split(',').forEach(function (name) {
            prototype[name] = function () {
                utils[name](this, callback);
            };
        });
    }
}

var Base = function () {
    function Base(constructor, selector, options) {
        _classCallCheck(this, Base);

        if (canvasSupport && (this.container = isElement(selector) ? selector : doc.querySelector(selector))) {

            this.set = extend(true, {}, Base.commonConfig, constructor.defaultConfig, options);
            this.c = doc.createElement('canvas');
            this.cxt = this.c.getContext('2d');
            this.paused = false;

            setCanvasWH(this);

            this.container.innerHTML = '';
            this.container.appendChild(this.c);

            this.color = setColor(this.set.color);
            this.init();
        }
    }

    _createClass(Base, [{
        key: 'requestAnimationFrame',
        value: function requestAnimationFrame() {
            !this.paused && win.requestAnimationFrame(this.draw.bind(this));
        }
    }, {
        key: 'pause',
        value: function pause() {
            _pause(this);
        }
    }, {
        key: 'open',
        value: function open() {
            _open(this);
        }
    }, {
        key: 'resize',
        value: function resize() {
            _resize(this);
        }
    }]);

    return Base;
}();

// requestAnimationFrame 兼容处理


Base.commonConfig = {

    // 画布全局透明度 {number}
    // 取值范围：[0-1]
    opacity: 1,

    // 粒子颜色 {string|array}
    // 1、空数组表示随机取色。
    // 2、在特定颜色的数组里随机取色，如：['red', 'blue', 'green']。
    // 3、当为 string 类型时，如：'red'，则表示粒子都填充为红色。
    color: [],

    // 自适应窗口尺寸变化 {boolean}
    resize: true
};
win.requestAnimationFrame = function (win) {
    return win.requestAnimationFrame || win.webkitRequestAnimationFrame || win.mozRequestAnimationFrame || function (fn) {
        win.setTimeout(fn, 1000 / 60);
    };
}(win);

// 工具箱
var utils = {
    canvasSupport: canvasSupport,
    regExp: regExp,
    pInt: pInt,
    trimAll: trimAll,
    randomColor: randomColor,
    limitRandom: limitRandom,
    extend: extend,
    typeChecking: typeChecking,
    isFunction: isFunction,
    isPlainObject: isPlainObject,
    isElement: isElement,
    isString: isString,
    isBoolean: isBoolean,
    getCss: getCss,
    offset: offset,
    scaleValue: scaleValue,
    calcSpeed: calcSpeed,
    on: on,
    off: off,
    modifyPrototype: modifyPrototype
};

var JParticles = {
    version: version,
    utils: utils,
    Base: Base
};

win.JParticles = JParticles;
//# sourceMappingURL=maps/jparticles.js.map

'use strict';

// lowpoly.js
+function (JParticles) {
    'use strict';

    var utils = JParticles.utils,
        event = JParticles.event,
        random = Math.random,
        abs = Math.abs,
        pi2 = Math.PI * 2;

    function Lowpoly(selector, options) {
        utils.createCanvas(this, Lowpoly, selector, options);
    }

    Lowpoly.defaultConfig = {
        // 粒子个数，默认为容器宽度的0.12倍
        // 传入(0, 1)显示容器宽度相应倍数的个数，传入[1, +∞)显示具体个数
        num: .12,
        // 粒子最大半径(0, +∞)
        maxR: 2.4,
        // 粒子最小半径(0, +∞)
        minR: .6,
        // 粒子最大运动速度(0, +∞)
        maxSpeed: 1,
        // 粒子最小运动速度(0, +∞)
        minSpeed: 0,
        // 线段的宽度
        lineWidth: .2
    };

    var fn = Lowpoly.prototype = {
        version: '1.0.0',
        init: function init() {
            this.dots = [];
            this.createDots();
            this.draw();
            this.resize();
        },
        createDots: function createDots() {
            var cw = this.cw,
                ch = this.ch,
                set = this.set,
                color = this.color,
                limitRandom = utils.limitRandom,
                calcSpeed = utils.calcSpeed,
                maxSpeed = set.maxSpeed,
                minSpeed = set.minSpeed,
                maxR = set.maxR,
                minR = set.minR,
                num = 40 || utils.pInt(utils.scaleValue(set.num, cw)),
                dots = [],
                r;

            while (num--) {
                r = limitRandom(maxR, minR);
                dots.push({
                    x: limitRandom(cw - r, r),
                    y: limitRandom(ch - r, r),
                    r: r,
                    vx: calcSpeed(maxSpeed, minSpeed),
                    vy: calcSpeed(maxSpeed, minSpeed),
                    color: color()
                });
            }

            dots.sort(function (a, b) {
                return a.x - b.x;
            });

            this.dots = dots;
        },
        draw: function draw() {
            var self = this,
                set = self.set,
                cxt = self.cxt,
                cw = self.cw,
                ch = self.ch;

            cxt.clearRect(0, 0, cw, ch);

            // 当canvas宽高改变的时候，全局属性需要重新设置
            cxt.lineWidth = set.lineWidth;
            cxt.globalAlpha = set.opacity;

            self.dots.forEach(function (v) {
                var r = v.r;
                cxt.save();
                cxt.beginPath();
                cxt.arc(v.x, v.y, r, 0, pi2);
                cxt.fillStyle = v.color;
                cxt.fill();
                cxt.restore();
            });

            this.connectDots();
            // self.requestAnimationFrame();
        },
        connectDots: function connectDots() {
            var cxt = this.cxt,
                dots = this.dots;

            cxt.save();
            cxt.beginPath();
            cxt.moveTo(0, 0);

            dots.forEach(function (v) {
                cxt.lineTo(v.x, v.y);
            });

            cxt.strokeStyle = dots[0].color;
            cxt.stroke();
            cxt.restore();
        }
    };

    JParticles.extend(fn);

    JParticles.lowpoly = fn.constructor = Lowpoly;
}(JParticles);
//# sourceMappingURL=maps/lowpoly.js.map

'use strict';

// meteor.js
+function (JParticles) {
    'use strict';

    var utils = JParticles.utils,
        random = Math.random,
        abs = Math.abs,
        pi2 = Math.PI * 2;

    function Meteor(selector, options) {
        utils.createCanvas(this, Meteor, selector, options);
    }

    Meteor.defaultConfig = {
        maxR: 6.5,
        minR: .4,
        maxSpeed: .6,
        minSpeed: 0
    };

    var fn = Meteor.prototype = {
        version: '1.0.0',
        init: function init() {},
        createDots: function createDots() {},
        draw: function draw() {

            this.requestAnimationFrame();
        }
    };

    JParticles.extend(fn);

    JParticles.meteor = fn.constructor = Meteor;
}(JParticles);
//# sourceMappingURL=maps/meteor.js.map

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

+function (JParticles) {
    var _class, _temp;

    var utils = JParticles.utils,
        Base = JParticles.Base;
    var pInt = utils.pInt,
        limitRandom = utils.limitRandom,
        calcSpeed = utils.calcSpeed,
        scaleValue = utils.scaleValue;
    var getCss = utils.getCss,
        offset = utils.offset,
        isElement = utils.isElement,
        modifyPrototype = utils.modifyPrototype;
    var random = Math.random,
        abs = Math.abs,
        PI = Math.PI;

    var twicePI = PI * 2;

    /**
     * 检查元素或其祖先节点的属性是否等于预给值
     * @param elem {element} 起始元素
     * @param property {string} css属性
     * @param value {string} css属性值
     * @returns {boolean}
     */
    function checkParentsProperty(elem, property, value) {
        while (elem = elem.offsetParent) {
            if (getCss(elem, property) === value) {
                return true;
            }
        }
        return false;
    }

    function eventHandler(eventType) {
        var _set = this.set,
            num = _set.num,
            range = _set.range,
            eventElem = _set.eventElem;


        if (num > 0 && range > 0) {

            // 使用传递过来的关键字判断绑定事件还是移除事件
            eventType = eventType === 'pause' ? 'off' : 'on';
            utils[eventType](eventElem, 'mousemove', this.moveHandler);
            utils[eventType](eventElem, 'touchmove', this.moveHandler);
        }
    }

    JParticles.particle = (_temp = _class = function (_Base) {
        _inherits(Particle, _Base);

        function Particle(selector, options) {
            _classCallCheck(this, Particle);

            return _possibleConstructorReturn(this, (Particle.__proto__ || Object.getPrototypeOf(Particle)).call(this, Particle, selector, options));
        }

        _createClass(Particle, [{
            key: 'init',
            value: function init() {
                var _set2 = this.set,
                    num = _set2.num,
                    range = _set2.range,
                    eventElem = _set2.eventElem;


                if (num > 0) {
                    if (range > 0) {

                        // 设置移动事件元素
                        if (!isElement(eventElem) && eventElem !== document) {
                            this.set.eventElem = this.c;
                        }

                        // 定位点坐标
                        this.posX = random() * this.cw;
                        this.posY = random() * this.ch;
                        this.event();
                    }
                    this.createDots();
                    this.draw();
                    this.resize();
                }
            }
        }, {
            key: 'createDots',
            value: function createDots() {
                var cw = this.cw,
                    ch = this.ch,
                    color = this.color;
                var _set3 = this.set,
                    num = _set3.num,
                    maxR = _set3.maxR,
                    minR = _set3.minR,
                    maxSpeed = _set3.maxSpeed,
                    minSpeed = _set3.minSpeed;

                var realNumber = pInt(scaleValue(num, cw));
                var dots = [],
                    r = void 0;

                while (realNumber--) {
                    r = limitRandom(maxR, minR);
                    dots.push({
                        r: r,
                        x: limitRandom(cw - r, r),
                        y: limitRandom(ch - r, r),
                        vx: calcSpeed(maxSpeed, minSpeed),
                        vy: calcSpeed(maxSpeed, minSpeed),
                        color: color()
                    });
                }

                this.dots = dots;
            }
        }, {
            key: 'draw',
            value: function draw() {
                var cw = this.cw,
                    ch = this.ch,
                    cxt = this.cxt,
                    paused = this.paused;
                var _set4 = this.set,
                    num = _set4.num,
                    range = _set4.range,
                    lineWidth = _set4.lineWidth,
                    opacity = _set4.opacity;


                if (num <= 0) return;

                cxt.clearRect(0, 0, cw, ch);

                // 当canvas宽高改变的时候，全局属性需要重新设置
                cxt.lineWidth = lineWidth;
                cxt.globalAlpha = opacity;

                this.dots.forEach(function (dot) {
                    var r = dot.r;

                    cxt.save();
                    cxt.beginPath();
                    cxt.arc(dot.x, dot.y, r, 0, twicePI);
                    cxt.fillStyle = dot.color;
                    cxt.fill();
                    cxt.restore();

                    // 暂停的时候，vx和vy保持不变，
                    // 处理自适应窗口变化时出现粒子移动的状态
                    if (!paused) {
                        dot.x += dot.vx;
                        dot.y += dot.vy;

                        var x = dot.x;
                        var y = dot.y;

                        if (x + r >= cw || x - r <= 0) {
                            dot.vx *= -1;
                        }

                        if (y + r >= ch || y - r <= 0) {
                            dot.vy *= -1;
                        }
                    }
                });

                // 当连接范围小于 0 时，不连接线段
                if (range > 0) {
                    this.connectDots();
                }

                this.requestAnimationFrame();
            }
        }, {
            key: 'connectDots',
            value: function connectDots() {
                var dots = this.dots,
                    cxt = this.cxt,
                    posX = this.posX,
                    posY = this.posY;
                var _set5 = this.set,
                    distance = _set5.distance,
                    range = _set5.range;

                var length = dots.length;

                dots.forEach(function (dot, i) {
                    var x = dot.x;
                    var y = dot.y;
                    var color = dot.color;

                    while (++i < length) {
                        var sibDot = dots[i];
                        var sx = sibDot.x;
                        var sy = sibDot.y;

                        if (abs(x - sx) <= distance && abs(y - sy) <= distance && (abs(x - posX) <= range && abs(y - posY) <= range || abs(sx - posX) <= range && abs(sy - posY) <= range)) {
                            cxt.save();
                            cxt.beginPath();
                            cxt.moveTo(x, y);
                            cxt.lineTo(sx, sy);
                            cxt.strokeStyle = color;
                            cxt.stroke();
                            cxt.restore();
                        }
                    }
                });
            }
        }, {
            key: 'getElemOffset',
            value: function getElemOffset() {
                return this.elemOffset = this.elemOffset ? offset(this.set.eventElem) : null;
            }
        }, {
            key: 'event',
            value: function event() {
                var eventElem = this.set.eventElem;


                if (eventElem !== document) {
                    this.elemOffset = true;
                }

                // move 事件处理函数
                this.moveHandler = function (e) {
                    this.posX = e.pageX;
                    this.posY = e.pageY;

                    // 动态计算 elemOffset 值
                    if (this.getElemOffset()) {

                        // 动态判断祖先节点是否具有固定定位，有则使用client计算
                        if (checkParentsProperty(eventElem, 'position', 'fixed')) {
                            this.posX = e.clientX;
                            this.posY = e.clientY;
                        }
                        this.posX -= this.elemOffset.left;
                        this.posY -= this.elemOffset.top;
                    }
                }.bind(this);

                // 添加 move 事件
                eventHandler.call(this);
            }
        }]);

        return Particle;
    }(Base), _class.defaultConfig = {

        // 粒子个数，默认为容器宽度的 0.12 倍
        // 传入 (0, 1) 显示容器宽度相应倍数的个数，传入 [1, +∞) 显示具体个数
        num: .12,

        // 粒子最大半径(0, +∞)
        maxR: 2.4,

        // 粒子最小半径(0, +∞)
        minR: .6,

        // 粒子最大运动速度(0, +∞)
        maxSpeed: 1,

        // 粒子最小运动速度(0, +∞)
        minSpeed: 0,

        // 两点连线的最大值
        // 在 range 范围内的两点距离小于 distance，则两点之间连线
        distance: 130,

        // 线段的宽度
        lineWidth: .2,

        // 定位点的范围，范围越大连线越多，当 range 等于 0 时，不连线，相关值无效
        range: 160,

        // 改变定位点坐标的事件元素，null 表示 canvas 画布，或传入原生元素对象，如 document 等
        eventElem: null
    }, _temp);

    Particle.prototype.version = '2.0.0';

    // 修改原型 pause, open 方法
    modifyPrototype(Particle.prototype, 'pause, open', eventHandler);

    // 修改原型 resize 方法
    modifyPrototype(Particle.prototype, 'resize', function (scaleX, scaleY) {
        var _set6 = this.set,
            num = _set6.num,
            range = _set6.range;

        if (num > 0 && range > 0) {
            this.posX *= scaleX;
            this.posY *= scaleY;
            this.getElemOffset();
        }
    });
}(JParticles);
//# sourceMappingURL=maps/particle.js.map

'use strict';

// snow.js
+function (JParticles) {
    'use strict';

    var utils = JParticles.utils,
        random = Math.random,
        abs = Math.abs,
        pi2 = Math.PI * 2;

    function Snow(selector, options) {
        utils.createCanvas(this, Snow, selector, options);
    }

    Snow.defaultConfig = {
        // 雪花颜色
        color: '#fff',
        maxR: 6.5,
        minR: .4,
        maxSpeed: .6,
        minSpeed: 0
    };

    var fn = Snow.prototype = {
        version: '1.1.0',
        init: function init() {
            this.dots = [];
            this.createDots();
            this.draw();
            this.resize();
        },
        snowShape: function snowShape() {
            var set = this.set,
                calcSpeed = utils.calcSpeed,
                maxSpeed = set.maxSpeed,
                minSpeed = set.minSpeed,
                r = utils.limitRandom(set.maxR, set.minR);
            return {
                x: random() * this.cw,
                y: -r,
                r: r,
                vx: calcSpeed(maxSpeed, minSpeed),

                // r 越大，设置垂直速度越快，这样比较有近快远慢的层次效果
                vy: abs(r * calcSpeed(maxSpeed, minSpeed)),
                color: this.color()
            };
        },
        createDots: function createDots() {
            // 随机创建0-6个雪花
            var count = utils.pInt(random() * 6);
            var dots = this.dots;
            while (count--) {
                dots.push(this.snowShape());
            }
        },
        draw: function draw() {
            var self = this,
                set = self.set,
                cxt = self.cxt,
                cw = self.cw,
                ch = self.ch,
                paused = self.paused;

            cxt.clearRect(0, 0, cw, ch);
            cxt.globalAlpha = set.opacity;

            self.dots.forEach(function (v, i, array) {
                var x = v.x;
                var y = v.y;
                var r = v.r;

                cxt.save();
                cxt.beginPath();
                cxt.arc(x, y, r, 0, pi2);
                cxt.fillStyle = v.color;
                cxt.fill();
                cxt.restore();

                if (!paused) {
                    v.x += v.vx;
                    v.y += v.vy;

                    // 雪花反方向飘落
                    if (random() > .99 && random() > .5) {
                        v.vx *= -1;
                    }

                    // 雪花从侧边出去，删除
                    if (x < 0 || x - r > cw) {
                        array.splice(i, 1, self.snowShape());

                        // 雪花从底部出去，删除
                    } else if (y - r >= ch) {
                        array.splice(i, 1);
                    }
                }
            });

            // 添加雪花
            if (!paused && random() > .9) {
                self.createDots();
            }

            self.requestAnimationFrame();
        }
    };

    // 继承公共方法，如pause，open
    JParticles.extend(fn);

    // 添加实例
    JParticles.snow = fn.constructor = Snow;
}(JParticles);
//# sourceMappingURL=maps/snow.js.map

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

// wave.js
+function (JParticles) {
    'use strict';

    var utils = JParticles.utils,
        limitRandom = utils.limitRandom,
        randomColor = utils.randomColor,
        _scaleValue = utils.scaleValue,
        random = Math.random,
        sin = Math.sin,
        pi2 = Math.PI * 2,
        UNDEFINED = 'undefined',
        isArray = Array.isArray;

    function Wave(selector, options) {
        utils.createCanvas(this, Wave, selector, options);
    }

    Wave.defaultConfig = {
        // 波纹个数
        num: 3,
        // 波纹背景颜色，当fill设置为true时生效
        fillColor: [],
        // 波纹线条(边框)颜色，当stroke设置为true时生效
        lineColor: [],
        // 线条宽度
        lineWidth: [],
        // 线条的横向偏移值，(0, 1)表示容器宽度的倍数，[1, +∞)表示具体数值
        offsetLeft: [],
        // 线条的纵向偏移值，线条中点到元素顶部的距离，(0, 1)表示容器高度的倍数，[1, +∞)表示具体数值
        offsetTop: [],
        // 波峰高度，(0, 1)表示容器高度的倍数，[1, +∞)表示具体数值
        crestHeight: [],
        // 波纹个数，即正弦周期个数
        rippleNum: [],
        // 运动速度
        speed: [],
        // 是否填充背景色，设置为false相关值无效
        fill: false,
        // 是否绘制边框，设置为false相关值无效
        stroke: true
    };

    var fn = Wave.prototype = {
        version: '1.0.0',
        init: function init() {
            if (this.set.num > 0) {

                // 线条波长，每个周期(2π)在canvas上的实际长度
                this.rippleLength = [];

                this.attrNormalize();
                this.createDots();
                this.draw();
                this.resize();
            }
        },
        attrNormalize: function attrNormalize() {
            ['fillColor', 'lineColor', 'lineWidth', 'offsetLeft', 'offsetTop', 'crestHeight', 'rippleNum', 'speed', 'fill', 'stroke'].forEach(function (attr) {

                this.attrProcessor(attr);
            }.bind(this));
        },
        attrProcessor: function attrProcessor(attr) {
            var num = this.set.num;
            var attrVal = this.set[attr];
            var std = attrVal;
            var scale = attr === 'offsetLeft' ? this.cw : this.ch;

            if (!isArray(attrVal)) {
                std = this.set[attr] = [];
            }

            // 将数组、字符串、数字、布尔类型属性标准化，假设num=3，如：
            // crestHeight: []或[2]或[2, 2], 标准化成: [2, 2, 2]
            // crestHeight: 2, 标准化成: [2, 2, 2]
            // 注意：(0, 1)表示容器高度的倍数，[1, +∞)表示具体数值，其他属性同理
            while (num--) {
                var val = isArray(attrVal) ? attrVal[num] : attrVal;

                std[num] = (typeof val === 'undefined' ? 'undefined' : _typeof(val)) === UNDEFINED ? this.generateAttrVal(attr) : this.scaleValue(attr, val, scale);

                if (attr === 'rippleNum') {
                    this.rippleLength[num] = this.cw / std[num];
                }
            }
        },
        scaleValue: function scaleValue(attr, val, scale) {
            if (attr === 'offsetTop' || attr === 'offsetLeft' || attr === 'crestHeight') {
                return _scaleValue(val, scale);
            }
            return val;
        },
        generateAttrVal: function generateAttrVal(attr) {
            var cw = this.cw;
            var ch = this.ch;

            switch (attr) {
                case 'lineColor':
                case 'fillColor':
                    attr = randomColor();
                    break;
                case 'lineWidth':
                    attr = limitRandom(2, .2);
                    break;
                case 'offsetLeft':
                    attr = random() * cw;
                    break;
                case 'offsetTop':
                case 'crestHeight':
                    attr = random() * ch;
                    break;
                case 'rippleNum':
                    attr = limitRandom(cw / 2, 1);
                    break;
                case 'speed':
                    attr = limitRandom(.4, .1);
                    break;
                case 'fill':
                    attr = false;
                    break;
                case 'stroke':
                    attr = true;
                    break;
            }
            return attr;
        },
        setOffsetTop: function setOffsetTop(topVal) {
            if (this.set.num > 0) {

                if (!isArray(topVal) && topVal > 0 && topVal < 1) {
                    topVal *= this.ch;
                }

                this.set.offsetTop.forEach(function (v, i, array) {

                    // topVal[i] || v: 当传入的topVal数组少于自身数组的长度，
                    // 超出部分保持它的原有值，以保证不出现undefined
                    array[i] = isArray(topVal) ? topVal[i] || v : topVal;
                });
            }
        },
        createDots: function createDots() {
            var dots = this.dots = [];
            var rippleLength = this.rippleLength;
            var cw = this.cw;
            var num = this.set.num;

            while (num--) {
                var line = [];

                // 点的y轴步进
                var step = pi2 / rippleLength[num];

                // 创建一条线段所需的点
                for (var j = 0; j < cw; j++) {
                    line.push({
                        x: j,
                        y: j * step
                    });
                }

                dots[num] = line;
            }
        },
        draw: function draw() {
            var set = this.set;
            if (set.num <= 0) {
                return;
            }

            var cxt = this.cxt,
                cw = this.cw,
                ch = this.ch,
                paused = this.paused;

            cxt.clearRect(0, 0, cw, ch);
            cxt.globalAlpha = set.opacity;

            this.dots.forEach(function (lineDots, i) {
                var crestHeight = set.crestHeight[i];
                var offsetLeft = set.offsetLeft[i];
                var offsetTop = set.offsetTop[i];
                var speed = set.speed[i];

                cxt.save();
                cxt.beginPath();
                lineDots.forEach(function (v, j) {
                    cxt[j ? 'lineTo' : 'moveTo'](v.x,

                    // y = A sin ( ωx + φ ) + h
                    crestHeight * sin(v.y + offsetLeft) + offsetTop);
                    !paused && (v.y -= speed);
                });
                if (set.fill[i]) {
                    cxt.lineTo(cw, ch);
                    cxt.lineTo(0, ch);
                    cxt.closePath();
                    cxt.fillStyle = set.fillColor[i];
                    cxt.fill();
                }
                if (set.stroke[i]) {
                    cxt.lineWidth = set.lineWidth[i];
                    cxt.strokeStyle = set.lineColor[i];
                    cxt.stroke();
                }
                cxt.restore();
            });
            this.requestAnimationFrame();
        }
    };

    // 继承公共方法，如pause，open
    JParticles.extend(fn);

    utils.modifyPrototype(fn, 'resize', function (scaleX, scaleY) {
        if (this.set.num > 0) {
            this.dots.forEach(function (lineDots) {
                lineDots.forEach(function (v) {
                    v.x *= scaleX;
                    v.y *= scaleY;
                });
            });
        }
    });

    // 添加实例
    JParticles.wave = fn.constructor = Wave;
}(JParticles);
//# sourceMappingURL=maps/wave.js.map
