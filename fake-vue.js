; (function (window, document) {

    /**
     * 构造函数
     * 请查阅vue文档，传个正儿八经的配置进来
     * @param {*} options 配置
     */
    function FakeVue(options) {
        this.init(options);
    }

    /**
     * 初始化
     * @param {object} options 配置
     */
    FakeVue.prototype.init = function (options) {
        //  储存配置
        this.$options = options;
        //  挂靠目标
        this.$el = document.querySelector(options.el);
        //  内部数据
        this.$data = options.data;
        //  内部方法
        this.$methods = options.methods;

        //  binding保存着model与view的映射关系，Watcher的实例。当model改变时，我们会触发其中的指令类更新，保证view也能实时更新。
        this.binding = {};

        //  劫持数据getter，setter
        this.obverse(this.$data);

        //  对模板进行遍历，将符合要求的DOM绑定上更新指令
        this.complie(this.$el);
    }

    /**
     * 劫持属性重写getter，setter属性。数据更新时，调用更新方法。
     * @param {object} obj 需要劫持的对象
     * @param {string} parentName obj所属父属性名称，以与操作符分割识别父属性
     */
    FakeVue.prototype.obverse = function (obj, parentName) {

        var that = this;

        Object.keys(obj).forEach(function (key) {

            //  闭包数据，代表当前劫持属性的值。用于setter旧新值对比
            var value = obj[key];
            //  添加监听的属性名称，如果是深层属性，会携带parentName以与操作符分割
            var attr = parentName ? (parentName + "&" + key) : key;

            /**
             *  {object} [binding] 调度中心
             *  在调度中心中为当前属性添加指令（directives）属性数组，其中存储着所有监听事件的函数
             *  that.binding.attr = {
             *      directives:[]
             * }
             * 
             */
            var binding = that.binding[attr] = {
                directives: []
            };

            //  如果当前对象的属性是object类型，对内部数据再次遍历
            if (typeof value === 'object') {
                that.obverse(value, attr);
            }

            /**
             * 对obj对象的key属性进行getter，setter劫持
             * obj与key是个不定值，可能是一级属性也可能是深度属性
             * 对defineProperty不熟悉，可以查阅 http://www.onaug6th.com/#/article/10
             */
            Object.defineProperty(obj, key, {
                enumerable: true,
                configurable: true,
                get: function () {
                    return value;
                },
                set: function (newVal) {

                    if (value !== newVal) {
                        value = newVal;
                        //  触发更新方法，更新视图
                        binding.directives.forEach(function (item) {
                            //  循环调用该值绑定的watcher更新方法
                            item.update();
                        });
                    }
                }
            });

        });

    }

    /**
     * 递归寻找符合指令要求的dom绑定模版语法
     * @param {HTMLElement} root 遍历的根dom
     */
    FakeVue.prototype.complie = function (root) {

        var that = this;

        //  获取挂靠目标下的所有子节点
        var nodes = root.children;

        //  一层一层递归寻找对应的标记来绑定对应的事件。
        for (var i = 0; i < nodes.length; i++) {

            var node = nodes[i];

            //  如果存在子DOM节点，递归寻找
            if (node.children.length) {
                that.complie(node);
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
                     * 使用Function.prototype.bind，将执行作用域指向vue实例的data属性，返回原函数的copy
                     */
                    return that.$methods[fnName].bind(that.$data);
                })();

            }

            //  v-model只有在input和textarea输入框才起效
            if (node.hasAttribute('v-model') && (node.tagName = 'INPUT' || node.tagName == 'TEXTAREA')) {

                /**
                 * 监听“input” 输入
                 * 为节点的input事情返回一个立即执行函数，为了每次的 i 能够正确获取。
                 */
                node.addEventListener('input', (function (i) {

                    //  attrVal：存在data对象中的属性
                    var attrVal = that.replaceUnderLine(node.getAttribute('v-model'));

                    //  往回调函数队列中推入观察者函数
                    that.binding[attrVal].directives.push(new Watcher(node, 'value', that, attrVal));

                    //  将data对象中的属性，修改为节点的值
                    return function () {
                        
                        //  绑定的属性
                        var attrList = attrVal.split("&");
                        //  当前节点值
                        var nodeValue = nodes[i].value;
                        //  更新的对象，默认为实例的data属性
                        var obj = that.$data;
                        //  更新的值
                        var attr = "";

                        attrList.forEach(function (item, index) {
                            if (index != attrList.length - 1) {
                                obj = obj[item];
                            } else {
                                attr = item;
                            }
                        });

                        obj[attr] = nodeValue;
                    }

                })(i));
            }

            /**
             * 为v-bind绑定的属性，添加到更新队列
             */
            if (node.hasAttribute('v-bind')) {
                var attrVal = that.replaceUnderLine(node.getAttribute('v-bind'));

                that.binding[attrVal].directives.push(new Watcher(node, 'innerHTML', that, attrVal));
            }
        }
    }

    /**
     * 替换与操作符
     * @param {string} value 需要替换的内容
     */
    FakeVue.prototype.replaceUnderLine = function (value) {
        return value.indexOf(".") && (value = value.replace(/\./g, "&"));
    }

    /**
     * 负责更新视图的观察者对象
     * @param {HTMLElement} el    指令对应的DOM元素
     * @param {string} elAttr  绑定的属性值，本例为"innerHTML"
     * @param {object} vm    指令所属FakeVue实例
     * @param {string} vmAttr   指令对应的值，本例如"number"
     */
    function Watcher(el, elAttr, vm, vmAttr) {

        this.el = el;
        this.elAttr = elAttr;
        this.vm = vm;
        this.vmAttr = vmAttr;

        this.update();
    }

    /**
     * 更新方法
     * 这里将 el(指令挂载的DOM，例如input,textarea)的attr（挂载的DOM的属性，例如value或者innerHTML）修改为vm（实例对象）中的对应的绑定属性值
     */
    Watcher.prototype.update = function () {

        var attrList = this.vmAttr.split("&");

        var vmValue = this.vm.getDeepValue(attrList);

        this.el[this.elAttr] = vmValue;

    }

    /**
     * 获取深层数据
     * @param {Array} attrList 属性列表
     */
    FakeVue.prototype.getDeepValue = function (attrList) {
        var answer = this.$data;
        for (var i in attrList) {
            answer = answer[attrList[i]];
        }
        return answer;
    }


    window.FakeVue = FakeVue;

})(window, window.document);
