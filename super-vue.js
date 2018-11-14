; (function () {

    function SuperVueES5(options) {
        this._init(options);
    }

    SuperVueES5.prototype._init = function (options) {
        //  将配置储存起来
        this.$options = options;
        //  挂靠目标
        this.$el = document.querySelector(options.el);
        //  内部数据
        this.$data = options.data;
        //  内部方法
        this.$methods = options.methods;

        //  _binding保存着model与view的映射关系，也就是我们前面定义的Watcher的实例。当model改变时，我们会触发其中的指令类更新，保证view也能实时更新。
        this._binding = {};
        //  劫持数据getter，setter
        this._obverse(this.$data);
        //  对模板进行遍历，将符合要求的DOM绑定上指令
        this._complie(this.$el);
    }

    //  劫持属性重写getter，setter属性。数据更新时，调用更新方法。
    SuperVueES5.prototype._obverse = function (obj) {
        var that = this;
        Object.keys(obj).forEach(function (key) {

            //  只有自身属性才需要劫持
            if (obj.hasOwnProperty(key)) {
                /*
                 *  调度中心   
                 *  为该数据添加映射关系
                 *  this._binding = {
                        key : {
                            _directives:[]   
                        }
                    }
                 * 
                 */
                that._binding[key] = {
                    _directives: []
                };
                //  值
                var value = obj[key];
                //  如果是对象，对内部数据再次遍历
                if (typeof value === 'object') {
                    that._obverse(value);
                }
                /**
                 * binding是个对象，下有个_directives属性数组，其中存储着所有监听事件的函数
                 * binding = {
                     _directives : []
                 } 
                 *
                 */
                var binding = that._binding[key];
                //  对vue实例的data属性进行重写getter，setter
                //  对defineProperty不熟悉，可以查阅 http://www.onaug6th.com/#/article/10
                Object.defineProperty(that.$data, key, {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        console.log("属性名：" + key + "getter获取为：" + value);
                        return value;
                    },
                    set: function (newVal) {
                        console.log("属性名：" + key + "getter获取为：" + newVal);
                        if (value !== newVal) {
                            value = newVal;
                            //  触发更新方法，更新视图
                            binding._directives.forEach(function (item) {
                                //  循环调用该值绑定的watcher更新方法
                                item.update();
                            })
                        }
                    }
                })
            }
        })
    }

    //  递归寻找符合指令要求的dom绑定模版语法
    SuperVueES5.prototype._complie = function (root) {
        var that = this;
        var nodes = root.children;
        //  一层一层递归寻找对应的标记来绑定对应的事件。
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            //  如果存在子DOM节点，递归寻找
            if (node.children.length) {
                this._complie(node);
            }
            //  v-click
            if (node.hasAttribute('v-click')) {
                node.onclick = (function () {
                    var attrVal = nodes[i].getAttribute('v-click');
                    return that.$methods[attrVal].bind(that.$data);
                })();
            }
            //  v-model
            //  v-model只有在input和textarea输入框才起效
            if (node.hasAttribute('v-model') && (node.tagName = 'INPUT' || node.tagName == 'TEXTAREA')) {
                //  监听“input”事件，注意！“input”事件是一个事件，和change事件一样的。
                node.addEventListener('input', (function (key) {
                    //  attrVal：存在data对象中的属性
                    var attrVal = node.getAttribute('v-model');
                    //  往回调函数队列中推入观察者函数
                    that._binding[attrVal]._directives.push(new Watcher(
                        'input',
                        node,
                        that,
                        attrVal,
                        'value'
                    ));

                    //  将data对象中的属性，修改为节点的值
                    return function () {
                        that.$data[attrVal] = nodes[key].value;
                    }
                })(i));
            }

            //  v-bind
            //  视图层绑定数据
            if (node.hasAttribute('v-bind')) {
                var attrVal = node.getAttribute('v-bind');
                that._binding[attrVal]._directives.push(new Watcher(
                    'text',
                    node,
                    that,
                    attrVal,
                    'innerHTML'
                ))
            }
        }
    }

    /**
     * 观察者
     * @param {string} name  指令名称，例如文本节点，该值设为"text"
     * @param {HTMLDivElement} el    指令对应的DOM元素
     * @param {object} vm    指令所属myVueES5实例
     * @param {string} exp   指令对应的值，本例如"number"
     * @param {string} attr  绑定的属性值，本例为"innerHTML"
     */
    function Watcher(name, el, vm, exp, attr) {
        this.name = name;         //    指令名称，例如文本节点，该值设为"text"
        this.el = el;             //    指令对应的DOM元素
        this.vm = vm;             //    指令所属myVueES5实例
        this.exp = exp;           //    指令对应的值，本例如"number"
        this.attr = attr;         //    绑定的属性值，本例为"innerHTML"

        this.update();
    }

    //  更新方法
    Watcher.prototype.update = function () {
        //  el  模板语法绑定的DOM
        //  attr   指令修改的attribute
        //  vm  vue实例
        //  exp vue实例属性
        //  这里将 el(指令挂载的DOM，例如input,textarea)的attr（挂载的DOM的属性，例如value或者innerHTML）修改为vm（实例对象）的属性（exp）
        this.el[this.attr] = this.vm.$data[this.exp];
    }

    window.SuperVueES5 = SuperVueES5;

})();