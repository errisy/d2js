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
 * 所有渲染器
 * @namespace 
 */
d2js.Renderers = function(){}

/**
 * 渲染器管道
 * @namespace
 */
d2js.Renderers.Pipelines = function(){}	// 管道函数

d2js.KNOWN_RENDERERS = {};

d2js.KNOWN_RENDER_PIPELINES = {};

d2js.Renderers.EmbedRenderers = {};
d2js.Renderers.EmbedRenderers.nextId = 1;
d2js.Renderers.EmbedRenderers.codeMap = {};

(function addcss(){
	   if(window.ActiveXObject)
	   {
		   $('<style id="custom_persona_css"></style>').appendTo('head'); 
		   $("#custom_persona_css").prop('styleSheet').cssText='render,div.d2js-render {display:none}';
		   $("#custom_persona_css")[0].id = '';
	   }
	   else
	   {
		   $('<style type="text/css">render,div.d2js-render {display:none}</style>').appendTo(document.head);
	   }
	
})();

/**
 * 发起渲染函数。渲染总入口。设置好数据路径(html attribute `data`)和渲染器(html attribute `renderer`)后，调用该函数，绘制所有相关元素。
 * 也可使用封装了该函数的 jQuery 函数:
 * ```js
 * $(htmlElement).render(baseData, direct, customRenderers)
 * ```
 * @param [htmlElement=document.body] {HTMLElement} html 元素，渲染该元素及其子元素。
 * @param [baseData=d2js.dataset} {object} 数据，要渲染的数据
 * @param [direct=false] {bool} true - 直接渲染  false - 使用绝对数据路径渲染
 * @param [customRenders] {object} 自定义渲染器（含管道）。如
 * ```js
 * {
 * 	myRender : function(el, value){el.innerHTML = value}
 * }
 * ```
 * 对 htmlElement 及其子元素有指定 renderer="myRender"，该函数会被套用。
 */
d2js.render = function(htmlElement, baseData, direct, customRenders){
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
		var renderer = e.getAttribute('renderer');
		var embedRenderer = $(e).children('renderer, .d2js-render');
		if(embedRenderer.length){
			var emb = prepareEmbedRenderer(embedRenderer.html());
			renderer = renderer ? renderer + '|' + emb : emb;
		}
		if(dataPath && renderer){
			var data = [e]; 
			var match = d2js.extractData(baseData, dataPath, data, direct);
			if(match){
				if(e.hasAttribute('trace-render')) debugger;
				
				data.splice(1, 0, data[data.length - 1]);		// value 始终作为第二个参数
				
				var pipelined = (renderer.indexOf('|') != -1);
				if(pipelined){		// pipeline 函数仅翻译值，其有可能会加 html 效果
					var parr = renderer.split('|');
					for(var i=0; i<parr.length - 1; i++){
						var fun = extractPipeline(parr[i].trim());
						if(fun != null) {
							var piped = fun.apply(null, data);
							data[1] = piped;
						}
					}
					renderer = parr[parr.length -1];
				} 
				var fun = extractRenderer(renderer.trim());
				if(fun){
					var r = fun.apply(null, data);				
					$(e).trigger('d2js.rendered', data);
					if(direct && r == 'break') continue;
				} else {
					console.error(renderer + ' not found');
				}
			}
		}
		
		if(e.children.length){
			for(var i=e.children.length -1; i>=0; i--){
				stk.push(e.children[i]);
			}
		}
	}
	
	function extractRenderer(rendererDesc){
		if(customRenders){
			var fun = customRenders[rendererDesc];
			if(fun) return fun;
		}
		return d2js.extractCachedFunction(rendererDesc, d2js.Renderers, 'd2js.Renderers.', d2js.KNOWN_RENDERERS);
	}
	
	function extractPipeline(pipelineDesc){
		if(customRenders){
			var fun = customRenders[pipelineDesc];
			if(fun) return fun;
		}
		return d2js.extractCachedFunction(pipelineDesc, d2js.Renderers.Pipelines, 'd2js.Renderers.Pipelines.', d2js.KNOWN_RENDER_PIPELINES);
	}
	
	function prepareEmbedRenderer(code){
		var id = d2js.Renderers.EmbedRenderers.codeMap[code];
		if(id){
			return id;
		} else {
			id = d2js.Renderers.EmbedRenderers.nextId ++;
			id = '__embed_renderer__' + id;
			// code = 'function ' + id + '(element, value, table, _1, rows, index, row, columnName){ \r\n' + code + '\r\n}';
			var fun = new Function('element', 'value', 'table', '_1', 'rows', 'index', 'row', 'columnName', code);
			d2js.Renderers.EmbedRenderers.codeMap[code] = id;
			d2js.Renderers[id] = fun;
			return id;
		}
	}
}

/**
 * 按 element 指定的 data 路径定位数据
 * 可使用 jQuery 函数：
 * ```js
 * $(element).locateData(baseData, direct)
 * ```
 * @param [element=document.body] {HTMLElement} 包含数据路径的 html 元素
 * @param [baseData=d2js.dataset] {object} 出发数据
 * @param [direct=false] {bool} true - 不使用绝对路径  false - 使用绝对路径
 * @return {array} 数组，第一项为最终锚定的值，后面项为按数据路径展开的各项
 */
d2js.locateData = function(element, baseData, direct){
	if(element.jquery) element = element[0];
	baseData = baseData || d2js.dataset;
	var dataPath = element.getAttribute('data');
	var data = [];
	if(dataPath == null) return null;
	this.extractData(baseData, dataPath, data, direct);
	data.splice(0, 0, data[data.length - 1]);		// value 设为第一个值
	return data;
};

+(function ( $ ) {
    $.fn.locateData = function() {
    	return d2js.locateData(this);
    };
}( jQuery ));

+(function ( $ ) {
    $.fn.render = function(baseData, direct, customRenders) {
    	return d2js.render(this, baseData, direct, customRenders);
    };
}( jQuery ));

/**
 * 从参数数组查找符合条件的参数
 * @param {Arguments} arguments。从 locateData, render 等得到的数据参数。
 * @param pattern {object} 类型字符串，允许的有（table, dataset, row, column），predicate函数，返回 true|false
 */
d2js.findArg = function(args, pattern){
	var types = {table: d2js.DataTable, dataset: d2js.Dataset, row: d2js.DataRow, column: d2js.DataColumn};
	if(typeof pattern == 'object'){
		return Array.prototype.find(args, pattern);
	} else {
		pattern = types[pattern];
		for(var i=0;i<args.length; i++){
			var arg = args[i];
			if(arg instanceof pattern){
				return arg;
			}
		}
	}
}


d2js.extractData = function(baseData, dataPath, output, direct){
	var arr = dataPath.split(',');
	var attr = arr[0].trim();		// 对象，通常为表名
	var start = baseData;
	
	var i = 0;
	if(attr.charAt(0) == '#'){		// find d2js attr in descendent
		var selector = attr.substr(1);
		var found = false;
		if(baseData['d2js'] == selector) {
			// start = baseData;		
			found = true;
		} else {
			var history = [];
			for(var stk = [baseData]; stk.length;){
				if(stk.length > 100) debugger;
				var obj = stk.pop();
				history.push(obj);
				if(obj != null && obj['d2js'] == selector){
					start = obj;
					found = true;
					break;
				}
				if((typeof obj == 'object' || typeof obj == 'function') && obj && !obj['isD2jsTerm']){
					for(var k in obj){
						var v = obj[k];
						if(history.indexOf(v) == -1){
							stk.push(v);
						}
					}
				}
			}
		}
		if(!found) return false;
		i = 1;		// by-pass the selector;
	} else {
		if(!direct) return false;		// 只有direct方式可以不使用命中器
	}
	output.push(start);
	
	if(arr.length == 1 && arr[0] == 'this') return true;	// 像这种<p data="this"></p>只为命中本身
	
	var obj = start;
	for(; i<arr.length; i++){
		var a = arr[i].trim();
		if(!isNaN(a)){
			output.push(a * 1);		// 数字，应该是个索引
		} else {
			output.push(a);
		}
		if(obj != null) obj = obj[a];
		output.push(obj);
	}
	return true;
}



d2js.extractCachedFunction = (function(){
	var JsSymbols = '~!@#%^&*()-+=[]{}\|;:\'",.<>/? \r\n\t';
	return function(desc, functions, functionsStr, cache){
	
		if(cache && cache[desc]) return cache[desc];
		
		var r = functions[desc];
		if(!r){
			if(desc.indexOf(functionsStr) == -1){
				desc = functionsStr + desc; 
			}
			r = window.eval(desc);
		} 
		if(cache) cache[desc] = r;
		return r;
	}
})();
