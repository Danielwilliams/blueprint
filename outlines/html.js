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
/*global define, $, brackets */
define(function (require, exports, modul) {
    "use strict";
	var	CodeMirror		= brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
		EditorManager   = brackets.getModule("editor/EditorManager"),
		prefs			= require('../preferences'),
		dataTree		= [],
		viewMode		= 'tree',
		currentEditorTabSize = 4;

	/**
	 *	@param {string} code
	 *	@param {string} modespec
	 *	@return {object} dataTree
	 */
	function updateHtml(code, modespec) {
		var mode = CodeMirror.getMode(CodeMirror.defaults, modespec),
			lines = CodeMirror.splitLines(code),
			state = CodeMirror.startState(mode),
			stream,
			lastBracket,
			rootElement = {childs : [], name : 'root' },
			currElement = rootElement,
			parentList = [rootElement],
			isAttr  = false,
			charNumber = 0,
			openTagCharPos = 0,
			inOpenTag = false,
			callback;

		var isVoidElement = function(tagName) {
			var voidTags = [
				"area", "base", "br", "col", "command", "embed",
				"hr", "img", "input", "keygen", "link",
				"meta", "param", "source", "track", "wbr"
			];
			return $.inArray(tagName, voidTags) > -1;
		};
		var getNext = function() {
			var curr = stream.current();
			stream.start = stream.pos;
			return curr;
		};
		var push = function(element) {
			currElement.childs.push(element);
			parentList.push(element);
			currElement = element;
		};
		var pop = function() {
			if (parentList.length < 2) { return; }
			parentList.pop();
			currElement = parentList[parentList.length-1];
		};
		var essentialCallback = function(token, lineNumber, style) {
			switch(style) {
				case 'tag bracket':
					lastBracket = token;
					if (token.search('>') !== -1) {
						//close tag
						var attribStr = '',
							nameStr = '';

						if (inOpenTag) {
							inOpenTag = false;

							if (!currElement) { break; }
							if (currElement.attr._length === 0) { break; }

							var weight = 0;
							if ('id' in currElement.attr) {
								attribStr += ' <span class="id">#' + currElement.attr.id + '</span>';
								nameStr += ' #' + currElement.attr.id;
								weight += 2;
							}
							if ('class' in currElement.attr) {
								attribStr += ' <span class="class">.' + currElement.attr.class + '</span>';
								nameStr += ' .' + currElement.attr.class;
								weight += 1;
							}

							if (weight < 1) { break; }

							currElement.line = '<span class="tag">' + currElement.name + '</span>' + attribStr;
							currElement.name = currElement.name + nameStr;
							rootElement.childs.push(currElement);
						}
						isAttr = false;
					} else if (token.search('<') !== -1) {
						openTagCharPos = charNumber -(token.length);
					}
					break;
				case 'tag':
					if (lastBracket === '<') {
						//open tag
						inOpenTag = true;
						var element = {
							name : token,
							line : '',
							startline : lineNumber,
							startchar : openTagCharPos,
							childs : [],
							attr : {
								_length : 0
							},
						};
						currElement = element;
					}
					break;
				case 'attribute':
					isAttr = token;
					break;
				case 'string':
					if (isAttr !== false) {
						//add attribute
						currElement.attr[isAttr] = token.replace(/["']/g, '');
						currElement.attr._length++;
						isAttr = false;
					}
					break;
			}
		}
		var treeCallback = function(token, lineNumber, style) {
			switch(style) {
				case 'tag bracket':
					lastBracket = token;
					if (token.search('>') !== -1) {
						//close tag
						var attribStr = '',
							nameStr = '';

						if (inOpenTag) {
							inOpenTag = false;
							if (!currElement) { break; }
							if ('id' in currElement.attr) {
								attribStr += ' <span class="id">#' + currElement.attr.id + '</span>';
								nameStr += ' #' + currElement.attr.id;
							}
							if ('class' in currElement.attr) {
								attribStr += ' <span class="class">.' + currElement.attr.class + '</span>';
								nameStr += ' .' + currElement.attr.class;
							}
							currElement.line = '<span class="tag">' + currElement.name + '</span>' + attribStr;
							var tagName = currElement.name;
							currElement.name = currElement.name + nameStr;

							if(isVoidElement(tagName)) {
								parentList.pop();
								currElement = parentList[parentList.length-1];
							}
						}
						isAttr = false;
					} else if (token.search('<') !== -1) {
						openTagCharPos = charNumber -(token.length);
					}
					break;
				case 'tag':
					if (lastBracket === '<') {
						//open tag
						inOpenTag = true;
						var element = {
							name : token,
							line : '',
							startline : lineNumber,
							startchar : openTagCharPos,
							childs : [],
							attr : [],
						};
						currElement.childs.push(element);
						parentList.push(element);
						currElement = element;
					} else if (lastBracket === '</') {
						//close tag
						parentList.pop();
						currElement = parentList[parentList.length-1];
					}
					break;
				case 'attribute':
					isAttr = token;
					break;
				case 'string':
					if (isAttr !== false) {
						//add attribute
						currElement.attr[isAttr] = token.replace(/["']/g, '');
						isAttr = false;
					}
					break;
			}
		};

		switch (viewMode) {
			case 'tree':
				callback = treeCallback;
				break;
			case 'essential':
				callback = essentialCallback;
				break;
		}
		for (var i = 0, e = lines.length; i < e; ++i) {
			stream = new CodeMirror.StringStream(lines[i]);
			charNumber = 0;
			while (!stream.eol()) {
				var style = mode.token(stream, state),
					token = getNext();

				if (style === null) {
					token = token.replace(/\\t/g, new Array(currentEditorTabSize).join(' '));
				}
				charNumber = charNumber + token.length;
				if (style !== null) {
					callback(token, i + 1, style);
				}
			}
		}
		return rootElement;
	}

	exports.init = function (outliner) {
		//set dom
		//register buttons
		outliner.registerButton('switchMode', function(e) {
			if (viewMode === 'tree') {
				viewMode = 'essential';
			} else {
				viewMode = 'tree';
			}
			outliner.forceDraw();
		});
	};
	exports.update = function (code, cb) {
		//currentEditorTabSize = EditorManager.getCurrentFullEditor().getTabSize();
		dataTree = updateHtml(code, 'text/x-brackets-html');
		console.log(dataTree)
		cb(dataTree);
	};

});
//		var essentialCallback = function(token, lineNumber, style) {
//			switch(style) {
//				case 'tag bracket':
//					lastBracket = token;
//					if (token.search('>') !== -1) {
//						//close tag
//						var attribStr = '',
//							nameStr = '';
//
//						if (inOpenTag) {
//							inOpenTag = false;
//
//							if (!currElement) { break; }
//							if (currElement.attr._length === 0) { break; }
//
//							var weight = 0;
//							if ('id' in currElement.attr) {
//								attribStr += ' <span class="id">#' + currElement.attr.id + '</span>';
//								nameStr += ' #' + currElement.attr.id;
//								weight += 2;
//							}
//							if ('class' in currElement.attr) {
//								attribStr += ' <span class="class">.' + currElement.attr.class + '</span>';
//								nameStr += ' .' + currElement.attr.class;
//								weight += 1;
//							}
//
//							if (weight < 1) { break; }
//
//							currElement.line = '<span class="tag">' + currElement.name + '</span>' + attribStr;
//							currElement.name = currElement.name + nameStr;
//							rootElement.childs.push(currElement);
//						}
//						isAttr = false;
//					} else if (token.search('<') !== -1) {
//						openTagCharPos = charNumber -(token.length);
//					}
//					break;
//				case 'tag':
//					if (lastBracket === '<') {
//						//open tag
//						inOpenTag = true;
//						var element = {
//							name : token,
//							line : '',
//							startline : lineNumber,
//							startchar : openTagCharPos,
//							childs : [],
//							attr : {
//								_length : 0
//							},
//						};
//						currElement = element;
//					}
//					break;
//				case 'attribute':
//					isAttr = token;
//					break;
//				case 'string':
//					if (isAttr !== false) {
//						//add attribute
//						currElement.attr[isAttr] = token.replace(/["']/g, '');
//						currElement.attr._length++;
//						isAttr = false;
//					}
//					break;
//			}
//		}
