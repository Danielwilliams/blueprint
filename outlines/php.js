/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Stefan Schulz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
*/
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */
/*global define, brackets */
define(function (require, exports) {
    "use strict";
	var CodeMirror	= brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
		$root;

	function update(code) {
		var mode = CodeMirror.getMode(CodeMirror.defaults, 'php'),
			lines = CodeMirror.splitLines(code),
			state = CodeMirror.startState(mode),
			rootElement = {
				childs : [],// the root element just needs childs, the next lines are the required fields for all elements
				//startline : 1, //
				//name : 'name string for sorting',
				//line : 'content of the "li>.line" element. can contain html elements',
			},
			currElement = rootElement,
			elementStack = [rootElement],
			stream;

		var getNext = function() {
			var curr = stream.current();
			stream.start = stream.pos;
			return curr;
		};
		var push = function(element) {
			currElement.childs.push(element);
			elementStack.push(element);
			currElement = element;
		};
		var pop = function() {
			if (elementStack.length === 1) {
			}
			elementStack.pop();
			currElement = elementStack[elementStack.length - 1];
		};
		var STATE,
			define,
			lastToken = '',
			curlyCount = 1;

		var callback = function(token, lineNumber, style) {
			var element,
				i,
				extendsString = '',
				implementsString = '';

			if (style === 'comment') { return; }
			//foreach found element create a element like rootElement
			//style can be null, this occurse on space, brackets, etc
			switch (style) {
				case 'meta':
					//<?php
					break;
				case 'keyword':
					switch (token) {
						case 'interface':
							define = token;
							//interface
							element = {
								type : 'interface',
								name : '',
								childs : [],
								startline : lineNumber,
								line : '',
								_extends : []
							};
							push(element);
							STATE = 'wait4Name';
							break;
						case 'function':
							define = token;
							element = {
								type : 'func',
								name : '',
								childs : [],
								startline : lineNumber,
								line : '',
								_params : []
							};
							push(element);
							STATE = 'wait4Name';
							break;
						case 'class':
							define = token;
							//interface
							element = {
								type : 'class',
								name : '',
								childs : [],
								startline : lineNumber,
								line : '',
								_extends : [],
								_implements : []
							};
							push(element);
							STATE = 'wait4Name';
							break;
						case 'extends':
							STATE = 'wait4Extends';
							break;
						case 'implements':
							STATE = 'wait4Implements';
							break;
					}
					break;
				case 'variable':
					//  .. function/class name
					if (define) {
						switch (STATE) {
							case 'wait4Name':
								currElement.name = token;
								if (define === 'function') {
									STATE = 'wait4Params';
								} else if (define === 'class') {
									STATE = 'wait4Extend';
								} else if (define === 'interface') {
									STATE = 'wait4Extend';
								}
								break;
							case 'wait4Extends':
								currElement._extends.push(token);
								break;
							case 'wait4Implements':
								currElement._implements.push(token);
								break;
						}

					}
					break;
				case 'variable-2':
					//function attributes
					if (define) {
						if (define === 'function') {
							//add param
							currElement._params.push({
								type : null,
								name : token,
							});
						}
					}
					break;
				case null:
					switch (token) {
						case '(':
							if (define === 'function') {
								STATE = 'params';
							}
							break;
						case ')':
							if (define === 'function') {
								STATE = 'wait4Body';
							}
							break;
						case ';':
							if (define === 'function' && STATE === 'wait4Body') {
								//function define ends here because of interface notation
							} else {
								break;
							}
						case '{':
							curlyCount++;
							if (define === 'function' && STATE === 'wait4Body') {
								//close define here
								var paramString = '',
									returnType = '';

								for (i=0;i<currElement._params.length;i++) {
									var typeTag = (currElement._params[i].type)?' <span class="type">&lt;' + currElement._params[i].type + '&gt;</span>': '';
									var nameTag = ' <span class="name">' + currElement._params[i].name + '</span>,';
									paramString += typeTag + nameTag;
								}
								paramString = paramString.substr(0, paramString.length-1);
								currElement.line = '' +
									'<span class="type">' + currElement.type + '</span> ' +
									'<span class="name">' + currElement.name + '</span> (' +
									'<span class="params">' + paramString + '</span> )' +
									'<span class="return">' + returnType + '</span>';
								define = null;
								STATE = null;
								if (token === ';') { pop(); }
								curlyCount = 1;
							} else if (define === 'class') {
								//close define here
								for (i in currElement._extends) {
									extendsString += '<span class="base-class">' + currElement._extends[i] + '</span>,';
								}
								extendsString = extendsString.substr(0, extendsString.length-1);
								if (extendsString.length > 0) {
									extendsString = 'Ext:' + extendsString;
								}
								for (i in currElement._implements) {
									implementsString += '<span class="interface">' + currElement._implements[i] + '</span>,';
								}
								implementsString = implementsString.substr(0, implementsString.length-1);
								if (implementsString.length > 0) {
									implementsString = 'Impl:' + implementsString;
								}
								currElement.line = '' +
									'<span class="type">' + currElement.type + '</span> ' +
									'<span class="name">' + currElement.name + '</span> ' +
									'<span class="extends">' + extendsString + '</span> ' +
									'<span class="implements">' + implementsString + '</span>';
								define = null;
								STATE = null;
								curlyCount = 1;
							} else if (define === 'interface') {
								for (i in currElement._extends) {
									extendsString += '<span class="base-class">' + currElement._extends[i] + '</span>,';
								}
								extendsString = extendsString.substr(0, extendsString.length-1);
								if (extendsString.length > 0) {
									extendsString = 'Ext:' + extendsString;
								}
								currElement.line = '' +
									'<span class="type">' + currElement.type + '</span> ' +
									'<span class="name">' + currElement.name + '</span> ' +
									'<span class="extends">' + extendsString + '</span>';
								define = null;
								STATE = null;
								curlyCount = 1;
							}
							break;
						case '}':
							//check current function/class body end
							curlyCount--;
							if (curlyCount < 1) {
								pop();
								curlyCount = 1;
							}
							break;
					}
					break;
				case 'meta':
					//<?php
					break;
			}
			if (token.match(/[^\s]/) === null) {
				return;
			}
			lastToken = token;
		};

		//loop over lines
		for (var i = 0, e = lines.length; i < e; ++i) {
			stream = new CodeMirror.StringStream(lines[i]);
			while (!stream.eol()) {
				var style = mode.token(stream, state),
					token = getNext();
				callback(token, i + 1, style);
			}
		}


		return rootElement;
	}
	/*
	 *	@param {object} outliner api
	 *	@param {object} $ele
	 */
	exports.init = function(outliner, $ele) {
		$root = $ele;
		//set dom
		//register buttons
		//outliner.registerButton('class/button-name', function() {
			//onclick
		//});
	};
	/*
	 *	@param {string} code string
	 */
	exports.update = function(code, cb) {
		var data = update(code);
		cb(data);
	};
});
