; (function () {

    /**
     * 构造函数
     * 请查阅vue文档，传个正儿八经的配置进来
     * @param {*} options 配置
     */
    function SuperVue(options) {
        this.init(options);
    }

    /**
     * 初始化
     * @param {object} options 配置
     */
    SuperVue.prototype.init = function (options) {
        //  储存配置
        this.$options = options;
        //  挂靠目标
        this.$el = document.querySelector(options.el);
        //  内部数据
        this.$data = options.data;
        //  内部方法
        this.$methods = options.methods;

        //  _binding保存着model与view的映射关系，Watcher的实例。当model改变时，我们会触发其中的指令类更新，保证view也能实时更新。
        this._binding = {};

        //  劫持数据getter，setter
        this._obverse(this.$data);

        //  对模板进行遍历，将符合要求的DOM绑定上更新指令
        this._complie(this.$el);
    }
    
    /**
     * 劫持属性重写getter，setter属性。数据更新时，调用更新方法。
     * @param {object} obj 需要劫持的对象
     */
    SuperVue.prototype._obverse = function (obj) {

        var that = this;

        Object.keys(obj).forEach(function (key) {

            //  只有自身属性才需要劫持
            if (obj.hasOwnProperty(key)) {
                /*
                 *  调度中心   
                 *  为该数据添加映射关系
                 *  this._binding = {
                        key : {
                            directives:[]   
                        }
                    }
                 * 
                 */
                that._binding[key] = {
                    directives: []
                };
                //  值
                var value = obj[key];
                //  如果是对象，对内部数据再次遍历
                if (typeof value === 'object') {
                    that._obverse(value);
                }
                /**
                 * binding是个对象，下有个directives属性数组，其中存储着所有监听事件的函数
                 * binding = {
                    directives : []
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
                            binding.directives.forEach(function (item) {
                                //  循环调用该值绑定的watcher更新方法
                                item.update();
                            })
                        }
                    }
                });
            }
        });

    }

    /**
     * 递归寻找符合指令要求的dom绑定模版语法
     * @param {HTMLElement} root 遍历的根dom
     */
    SuperVue.prototype._complie = function (root) {

        var that = this;

        //  获取挂靠目标下的所有子节点
        var nodes = root.children;

        //  一层一层递归寻找对应的标记来绑定对应的事件。
        for (var i = 0; i < nodes.length; i++) {

            var node = nodes[i];
            
            //  如果存在子DOM节点，递归寻找
            if (node.children.length) {
                this._complie(node);
            }

            /**
             * 当我们发现了 v-click 属性，说明要绑定 click事件。
             * 而这里做的事情，仅仅是从将拥有v-click的按钮绑定点击事件，指向实例对象里的方法。
             */
            if (node.hasAttribute('v-click')) {
                
                node.onclick = (function () {
                    /**
                     * 这里的fnName 是 v-click 的方法名。
                     * v-click="sayName" fnName就为sayName
                     */
                    var fnName = nodes[i].getAttribute('v-click');
                    
                    /**
                     * 返回method配置中的方法，延后执行
                     * 传递that.$data 是为了能在method中进行 this.xxx 进行取值
                     */
                    return that.$methods[fnName].bind(that.$data);
                })();

            }

            //  v-model只有在input和textarea输入框才起效
            if (node.hasAttribute('v-model') && (node.tagName = 'INPUT' || node.tagName == 'TEXTAREA')) {

                //  监听“input”事件，注意！“input”事件是一个事件，和change事件一样的。
                node.addEventListener('input', (function (i) {

                    //  attrVal：存在data对象中的属性
                    var attrVal = node.getAttribute('v-model');
                    
                    //  往回调函数队列中推入观察者函数
                    that._binding[attrVal].directives.push(new Watcher(
                        node,
                        'value',
                        that,
                        attrVal
                    ));

                    //  将data对象中的属性，修改为节点的值
                    return function () {
                        that.$data[attrVal] = nodes[i].value;
                    }

                })(i));
            }

            //  v-bind视图层绑定数据
            if (node.hasAttribute('v-bind')) {
                var attrVal = node.getAttribute('v-bind');
                that._binding[attrVal].directives.push(new Watcher(
                    node,
                    'innerHTML',
                    that,
                    attrVal
                ))
            }
        }
    }

    /**
     * 负责更新视图的观察者对象
     * @param {HTMLElement} el    指令对应的DOM元素
     * @param {string} elAttr  绑定的属性值，本例为"innerHTML"
     * @param {object} vm    指令所属SuperVue实例
     * @param {string} vmAttr   指令对应的值，本例如"number"
     */
    function Watcher(el, elAttr, vm, vmAttr ) {

        this.el = el;             //    指令对应的DOM元素
        this.elAttr = elAttr;     //    绑定的属性值，本例为"innerHTML"
        this.vm = vm;             //    指令所属SuperVue实例
        this.vmAttr = vmAttr;     //    指令对应的值，本例如"number"

        this.update();
    }

    //  更新方法
    Watcher.prototype.update = function () {

        //  这里将 el(指令挂载的DOM，例如input,textarea)的attr（挂载的DOM的属性，例如value或者innerHTML）修改为vm（实例对象）的data属性中的（vmAttr）值
        this.el[this.elAttr] = this.vm.$data[this.vmAttr];
    }

    window.SuperVue = SuperVue;

})();