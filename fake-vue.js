/**
 * @author onaug6th <onaug6th@qq.com>
 * @description 模仿Vue实现的假Vue
 */

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

        //  调度中心
        this.binding = {};

        //  数据劫持
        this.obverse(this.$data);

        //  遍历模板
        this.complie(this.$el);
    }

    /**
     * 劫持属性重写getter，setter属性。数据更新时，调用存储的所有更新方法。
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
             *  在调度中心中为当前属性添加更新方法数组，其中存储着所有更新方法
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

        //  FakeVue实例对象
        var that = this;

        //  获取目标下的所有子节点
        var nodes = root.children;

        //  递归寻找，如发现对应的标记。进行特定处理。
        for (var i = 0; i < nodes.length; i++) {

            var node = nodes[i];

            //  如果存在子DOM节点，继续递归寻找
            if (node.children.length) {
                that.complie(node);
            }

            //  v-click
            if (node.hasAttribute('v-click')) {

                that.directiveClick(node);

            }

            //  v-model只有在input和textarea输入框才起效
            if (node.hasAttribute('v-model') && (node.tagName = 'INPUT' || node.tagName == 'TEXTAREA')) {

                that.directiveModel(node);

            }

            //  v-bind
            if (node.hasAttribute('v-bind')) {

                that.directiveBind(node);

            }

            if (node.hasAttribute('v-for')) {

                that.directiveFor(node);

            }
        }
    }

    /**
     * 模板指令，v-click
     * v-click：
     * 1. 给需要绑定的节点，添加点击事件。在点击时执行绑定的回调
     * @param {HTMLElement} node 解析的DOM节点
     */
    FakeVue.prototype.directiveClick = function (node) {

        var that = this;

        node.addEventListener("click", (function () {
            /**
             * 这里的fnName 是 v-click 的方法名。
             * v-click="sayName" fnName就为sayName
             */
            var fnName = node.getAttribute('v-click');

            /**
             * 使用Function.prototype.bind，将执行作用域指向vue实例的data属性，返回原函数的copy
             */
            return that.$methods[fnName].bind(that.$data);
        })());
    }

    /**
     * 模板指令，v-model
     * v-mode:
     * 1. 给绑定的属性，添加模板更新队列方法。
     * 2. 给模板添加事件，当模板输入时，更新绑定的属性值
     * @param {HTMLElement} node 解析的DOM节点
     */
    FakeVue.prototype.directiveModel = function (node) {

        var that = this;

        //  当前节点v-model的数据，会被转义成&分割的属性字符串
        var attrVal = that.replaceUnderLine(node.getAttribute('v-model'));

        //  推入回调函数队列，在绑定的数据更新时，也更新该 node
        that.binding[attrVal].directives.push(new Watcher(node, 'value', that, attrVal));

        /**
         * 监听“input” 输入
         */
        node.addEventListener('input', function () {

            //  获取最深属性所属对象，及最深属性名称
            var deepObj = that.getDeepValOrObj(attrVal, "obj");

            //  更新的对象，默认为实例的data属性
            var obj = deepObj.obj;
            //  更新的属性名称
            var attr = deepObj.attr;

            //  将需要更新的对象的值，修改为当前DOM节点新内容
            obj[attr] = node.value;
        });
    }

    /**
     * 模板指令，v-bind
     * v-bind：
     * 1. 仅仅是给绑定的属性添加一个更新队列方法
     * @param {HTMLElement} node 解析的DOM节点
     */
    FakeVue.prototype.directiveBind = function (node) {

        var attrVal = this.replaceUnderLine(node.getAttribute('v-bind'));

        this.binding[attrVal].directives.push(new Watcher(node, 'innerHTML', this, attrVal));
    }

    /**
     * 模板指令，v-for
     */
    FakeVue.prototype.directiveFor = function (node) {
        
        /**
         * (item, index) in list
         * (item) in list
         * item in list
         */
        var template = node.getAttribute('v-for');

        var templateList = template.split("in");

        
    }

    /**
     * 替换分割符
     * @param {string} value 需要替换的内容
     */
    FakeVue.prototype.replaceUnderLine = function (value) {
        return value.replace(/\./g, "&");
    }

    /**
     * 负责更新视图的观察者对象
     * @param {HTMLElement} el    指令对应的DOM元素
     * @param {string} elAttr  绑定的属性值，例如 "value，innerHTML"
     * @param {object} vm    指令所属FakeVue实例
     * @param {string} vmAttr   指令对应在data的值，例如 "number，name"
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

        //  获取vue实例的值
        var vmValue = this.vm.getDeepValOrObj(this.vmAttr, "val");
        //  绑定的DOM的值进行更新
        this.el[this.elAttr] = vmValue;

    }

    /**
     * 根据属性名称进行切割，获取最深属性值 或者 最深属性所属对象 和 最深属性名称
     * @param {string} attrList 属性列表
     */
    FakeVue.prototype.getDeepValOrObj = function (attrList, type) {
        //  默认取实例数据
        var obj = this.$data;
        //  默认属性名称
        var attr = "";
        //  切割属性列表
        attrList = attrList.split("&");

        attrList.forEach(function (item, index) {
            if (type == "val") {
                obj = obj[item];
            } else {
                if (index != attrList.length - 1) {
                    obj = obj[item];
                } else {
                    attr = item;
                }
            }
        });
        return attr ? { obj: obj, attr: attr } : obj;

    }

    window.FakeVue = FakeVue;

})(window, window.document);
