/*******************************************************************************
 * The MIT License (MIT)
 * Copyright © 2015 Inshua,inshua@gmail.com, All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the “Software”), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
 * OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *******************************************************************************/

/**
 * 所有收集器
 * @namespace 
 */
d2js.Collectors = function(){}

/**
 * 所有收集器的管道函数
 * @namespace 
 */
d2js.Collectors.Pipelines = function(){}

d2js.KNOWN_COLLECTORS = {};

d2js.KNOWN_COLLECT_PIPELINES = {};

/**
 * 发起收集函数。收集总入口。设置好数据路径(html attribute `data`)和收集器(html attribute `collector`)后，调用该函数，绘制所有相关元素。
 * 也可使用封装了该函数的 jQuery 函数:
 * ```js
 * $(htmlElement).collect(baseData, direct, customCollectors)
 * ```
 * @param [htmlElement=document.body] {HTMLElement} html 元素，从该元素及其子元素收集。
 * @param [baseData=d2js.dataset} {object} 数据，要渲染的数据
 * @param [direct=false] {bool} true - 直接收集  false - 使用绝对数据路径收集
 * @param [customCollectors] {object} 自定义收集器（含管道）。如
 * ```js
 * {
 * 	myCollector : function(el, value){return $(el).height()}
 * }
 * ```
 * 对 htmlElement 及其子元素有指定 collector="myCollector|s"，该函数会被套用。
 */
d2js.collect = function(htmlElement, baseData, direct, customCollectors){
	baseData = baseData || d2js.dataset;

	var stk = [];
	if(htmlElement) {
		if(htmlElement.jquery){
			stk = htmlElement.toArray();
			if(stk.length == 0){
				stk = [document.body];
			}
		} else {
			stk = [htmlElement]
		}
	} else {
		stk = [document.body];
	}
	while(stk.length){
		var e = stk.pop();
		var dataPath = e.getAttribute('data');
		var collector = e.getAttribute('collector');
		if(e.hasAttribute('no-collect')) continue;
		
		if(dataPath && collector){
			if(e.hasAttribute('trace-collect')) debugger;
			var data = [e]; 
			var match = d2js.extractData(baseData, dataPath, data, direct);

			if(match){
				data.splice(1, 0, data[data.length - 1]);		// value 始终作为第二个参数
				data.pop();
				
				var pipelined = (collector.indexOf('|') != -1);
				if(pipelined){		// pipeline 函数仅翻译值，其有可能会加 html 效果
					var parr = collector.split('|');
					for(var i=0; i<parr.length - 1; i++){
						var fun = extractPipeline(parr[i].trim());
						if(fun != null) {
							var piped = fun.apply(null, data);
							data[1] = piped;
						}
					}
					collector = parr[parr.length -1];
				} 
				var fun = extractCollector(collector.trim());
				if(fun){
					fun.apply(null, data);
					$(e).trigger('d2js.collected', data);
				} else {
					console.error(collector + ' not found');
				}
			}
		}
		
		if(e.children.length){
			for(var i=e.children.length -1; i>=0; i--){
				stk.push(e.children[i]);
			}
		}
	}
	
	function extractCollector(desc){
		if(customCollectors){
			var fun = customCollectors[desc];
			if(fun) return fun;
		}
		return d2js.extractCachedFunction(desc, d2js.Collectors, 'd2js.Collectors.', d2js.KNOWN_COLLECTORS);
	}
	
	function extractPipeline(pipelineDesc){
		if(customCollectors){
			var fun = customCollectors[desc];
			if(fun) return fun;
		}
		return d2js.extractCachedFunction(pipelineDesc, d2js.Collectors.Pipelines, 'd2js.Collectors.Pipelines.', d2js.KNOWN_COLLECT_PIPELINES);
	}
	
};

+(function ( $ ) {
    $.fn.collect = function(baseData, direct, customCollectors) {
    	return d2js.collect(this, baseData, direct, customCollectors);
    };
}( jQuery ));


/**
 * 常用 html 元素收集器管道函数。收集 html element 的 value 属性或 innerHTML 属性。
 * 通常收集器写为 c|s 前者由控件获取内容，后者设置到对象，中间可插入其它管道，如 c|n|s
 */
d2js.Collectors.Pipelines.c = d2js.KNOWN_COLLECT_PIPELINES['c'] = function(element, value, table, _1, rows, index, row, columnName){
	var newValue = null;
	if('value' in element){
		newValue = element.value;
	} else if('innerHTML' in element){
		newValue = element.innerHTML;
	} else {
		throw new Error('unsupported element type' + element.nodeName);
	}
	return newValue;
}

/**
 * 复选框勾中状态收集器。单独使用时，勾中为 true, 未勾中为 false
 */
d2js.Collectors.Pipelines.check = d2js.KNOWN_COLLECT_PIPELINES['check'] = function(element, value, table, _1, rows, index, row, columnName){
	return element.checked;
}


/**
 * 设置对象属性收集器。
 * s 是 set 或 std 的首字母。
 * 该函数设置新值到数据对象。用法 collector="c|s"。遇到普通对象，则使用 obj[attr] = value, 遇到 d2js.DataRow，则调用 row._set('attr', value)。
 * @param newValue {object} 从前面的管道函数获得
 */
d2js.Collectors.s = d2js.KNOWN_COLLECTORS['s'] = function(element, newValue, table, _1, rows, index, row, columnName){
	var obj = arguments[arguments.length -2];
	var attr = arguments[arguments.length -1];
	if(newValue === '') newValue = null;
	if(obj != null){	// dont test attr in obj
		if(obj.set){
			obj.set(attr, newValue);
		} else if(obj._set){
			obj._set(attr, newValue);
		} else {
			obj[attr] = newValue;
		}
	}
}

/**
 * 数字转换管道。将值转为数字类型。用法 collector="c|n|s"
 * @returns {number} 数字
 */
d2js.Collectors.Pipelines.n = d2js.KNOWN_COLLECT_PIPELINES['n'] = function(element, newValue, table, _1, rows, index, row, columnName){
	if(newValue instanceof String) newValue = newValue.trim();
	if(isNaN(newValue)){
		return null;
	} else {
		return newValue * 1;
	}
}

/**
 * 日期转换管道。将值转为 Date 类型。用法 collector="c|d|s"
 * @param element
 * @param newValue
 * @returns {Date}
 */
d2js.Collectors.Pipelines.d = d2js.KNOWN_COLLECT_PIPELINES['d'] = function(element, newValue, table, _1, rows, index, row, columnName){
	if(newValue instanceof String) newValue = newValue.trim();
	if(!newValue){
		return null;
	} else if(newValue instanceof Date){
		return newValue;
	} else {
		return Date.parse(newValue, element.getAttribute('format'));
	}
}


/**
 * molecule收集器管道。
 * 对支持 getValue 的 molecule 收集。 
 * 用法: colector="m|s"
 */
d2js.Collectors.Pipelines.m = d2js.KNOWN_COLLECT_PIPELINES['m'] = function(element, value, table, _1, rows, index, row, columnName){
	var m = Molecule.of(element);
	if(m == null || !m.getValue){
		return;
	} else {
		return m.getValue();
	}
}


/**
 * repeater 收集器。对 repeater 渲染器产生的元素进行收集。
 * usage:
 * ```html
 * <div data="#authors,rows" renderer="repeater" collector="repeater">
		<h2 repeater="true"><span data="name" renderer="std"></span></h2>
		<h2 repeater-empty="true">no data found</h2>
	</div>
	```
 * @member
 */
d2js.Collectors.repeater = function(element, rows){
	var e = $(element);
	var copies = e.find('[repeater-copy]');
	copies.each(function(idx, c){
		if($(c).closest('[renderer=repeater]').is(e)){
			c.removeAttribute('no-collect');
			var row = $(c).data('repeater-obj');		
			if(row) d2js.collect(c, row, true);
			c.setAttribute('no-collect', true);
		}
	});
}


/**
 * Object Column 值设置器
 * 当 DataRow['field'] 为对象时，如果 element 绑定的是对象的属性，应当使用该收集器。
 * 例如
 * ```html
 * <input data="#table,rows,0,contact,email">
 * ```
 * 该表的 contact 字段为一JSON字段，表现在前端为一个对象，其中 email 是一个属性，此时应使用如下收集方式 
 * ```html
 * <input data="#table,rows,0,contact,email" collector="c|oc">
 * ```
 * 如使用
 * ```html
 * <input data="#table,rows,0,contact,email" collector="c|s">
 * ```
 * 则编辑时虽然值变化了，但行状态不会变化，将导致数据不提交。
 * 
 * @param element
 * @param newValue
 */
d2js.Collectors.oc = d2js.KNOWN_COLLECTORS['oc'] = function(element, newValue){
	var row = null;
	for(var i=1; i<arguments.length-1; i++){
		var colname = arguments[i+1];
		if(arguments[i] instanceof d2js.DataRow){
			row = arguments[i];
			for(i+=2; i<arguments.length-1; i+=2){
				if(arguments[i] == null){
					var attr = arguments[i-1];
					arguments[i] = arguments[i-2][attr] = {};
				}
			}
			break;
		}
	}
	
	if(!row) return;
	
	if(row._state == 'none'){
		if(row._origin == null){
			row._origin = JSON.parse(JSON.stringify(row._toJson()));
		}
	}
	
	d2js.Collectors.s.apply(this, arguments);
	
	if(row._state == 'none'){
		if(JSON.stringify(row._toJson()) != JSON.stringify(row._origin)){
			row._state = 'edit';
		}
	}	
}



