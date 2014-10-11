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
/*global define, $, brackets, window, Worker */
define(function (require, exports, modul) {
    "use strict";
    var EditorManager   = brackets.getModule("editor/EditorManager"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
		Resizer			= brackets.getModule('utils/Resizer'),
		DocumentManager = brackets.getModule('document/DocumentManager'),
		CodeMirror		= brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
		CurrentDocument,
		$content,
		$root,
		$minimapOverlay,
		$minimapRoot;


	// CodeMirror, copyright (c) by Marijn Haverbeke and others
	// Distributed under an MIT license: http://codemirror.net/LICENSE
	CodeMirror.runMode = function(string, modespec) {
		var mode = CodeMirror.getMode(CodeMirror.defaults, modespec),
			options,
			ie = /MSIE \d/.test(navigator.userAgent),
			ie_lt9 = ie && (document.documentMode == null || document.documentMode < 9),
			html = '',
			tabSize = (options && options.tabSize) || CodeMirror.defaults.tabSize,
			col = 0;

		var callback = function(text, style) {
			if (text == "\n") {
				// Emitting LF or CRLF on IE8 or earlier results in an incorrect display.
				// Emitting a carriage return makes everything ok.
				html += '\n';
				//node.appendChild(document.createTextNode(ie_lt9 ? '\r' : text));
				col = 0;
				return;
			}
			var content = "";
			// replace tabs
			for (var pos = 0;;) {
				var idx = text.indexOf("\t", pos);
				if (idx == -1) {
					content += text.slice(pos);
					col += text.length - pos;
					break;
				} else {
					col += idx - pos;
					content += text.slice(pos, idx);
					var size = tabSize - col % tabSize;
					col += size;
					for (var i = 0; i < size; ++i) content += " ";
					pos = idx + 1;
				}
			}
			if (style) {
				var className = "cm-" + style.replace(/ +/g, " cm-");
				html += '<span class="' + className + '">' + content + '</span>';
				//sp.className = "cm-" + style.replace(/ +/g, " cm-");
				//var sp = node.appendChild(document.createElement("span"));
				//sp.appendChild(document.createTextNode(content));
			} else {
				html += content;
				//node.appendChild(document.createTextNode(content));
			}
		};

		var lines = CodeMirror.splitLines(string),
			state = CodeMirror.startState(mode);

		for (var i = 0, e = lines.length; i < e; ++i) {
			if (i) callback("\n");
			var stream = new CodeMirror.StringStream(lines[i].substr(0,100));
			while (!stream.eol()) {
				var style = mode.token(stream, state);
				callback(stream.current(), style, i, stream.start, state);
				stream.start = stream.pos;
			}
		}
		return html;
	};

	function jumpTo(y, setCursor) {
		//y == mouse.y relative 2 minimap
//		var t = $minimapRoot.css('top');
//		var top = Math.abs(parseInt(t.replace('px', '')));
		var clickedLine = Math.round(y / 20 * 4);
		if (setCursor) {
			setEditorLine(clickedLine);
		} else {
			console.log(clickedLine, y);
			setEditorView(clickedLine);
		}
	}
	function setEditorView(firstLine) {
		var currentEditor = EditorManager.getActiveEditor(), //egal welcher editor für getTextHeight
			scrollPosition = firstLine * currentEditor.getTextHeight();
		currentEditor.setScrollPos(0, scrollPosition);
		currentEditor.focus();
		updateScrollOverlay();
	}
	function setEditorLine(line) {
		var currentEditor = EditorManager.getActiveEditor();
        currentEditor.setCursorPos(line - 1, 0, true);
        currentEditor.focus();
        //setTimeout(function(){currentEditor.focus()}, 10);
	}
	function updateScrollOverlay() {
		var currentEditor = CurrentDocument._masterEditor,
			editorHeight = $(currentEditor.getScrollerElement()).height(),
			firstLine = Math.round(currentEditor.getScrollPos().y / currentEditor.getTextHeight()),
			lineHight = 20,
	   /*k*/contentHeight = $content[0].parentNode.clientHeight - 54,
	   /*k*/scrollPercent = currentEditor.getScrollPos().y / (currentEditor.totalHeight() - 18 - editorHeight),
	   /*k*/lines = currentEditor.lineCount();


		var overlayHeight = Math.round(editorHeight / currentEditor.getTextHeight() * lineHight / 4);
		$minimapOverlay.css('height', overlayHeight + 'px');
		if ((lines * 5) > contentHeight) {
			var overageLines = lines - contentHeight / 5;

	/*k*/	$minimapRoot.css('top', 0 - (scrollPercent * (overageLines) * 20 + 18) + 'px');
			var t = scrollPercent * (contentHeight - $minimapOverlay.height());// - overlayHeight;//(overlayHeight / 4)) * 4;
		} else {
			$minimapRoot.css('top', 0 + 'px');
			var t = scrollPercent * ($minimapRoot.height() / 4 - $minimapOverlay.height());// - overlayHeight;//(overlayHeight / 4)) * 4;
		}
		$minimapOverlay.css('top', t + 'px');
	}
	function moveOverlay(y) {
		var contentHeight = $content[0].parentNode.clientHeight - 54,
			hundertPro,
			perCent,
			lines = CurrentDocument._masterEditor.lineCount();


		if ((lines * 5) > contentHeight) {
			hundertPro = contentHeight - $minimapOverlay.height();
		} else {
			hundertPro = (lines * 5) - $minimapOverlay.height();
		}
		perCent = (parseInt($minimapOverlay.css('top')) + y) / hundertPro;
		var currentEditor = CurrentDocument._masterEditor,
			editorHeight = $(currentEditor.getScrollerElement()).height(),
			scrollPercent = currentEditor.getScrollPos().y / (currentEditor.totalHeight() - 18 - editorHeight);
		if (perCent > 1) {
			perCent = 1;
		}
		//set scroll pos
		var newY = Math.round(perCent * (currentEditor.totalHeight() - 18 - editorHeight));

		currentEditor.setScrollPos(0, newY);
		updateScrollOverlay();
		//console.log(currentEditor.getScrollPos().y , newY)
	};

	function appendStringAsNodes(element, html) {
		var frag = document.createDocumentFragment(),
			tmp = document.createElement('body'), child;
		tmp.innerHTML = html;
		// Append elements in a loop to a DocumentFragment, so that the browser does
		// not re-render the document for each node
		while (child = tmp.firstChild) {
			frag.appendChild(child);
		}
		element.appendChild(frag); // Now, append all elements at once
		frag = tmp = null;
	}
	//api
	var dragState = false,
		lastEvent,
		JsWorker;

	exports.init = function ($parent) {
		$root = $parent;
		$minimapOverlay = $('<div class="minimap-overlay"></div>');
		$minimapRoot = $('<div class="minimap-root cm-s-dark-theme"></div>');
		$content = $($parent.parent('.content')[0]);



		$parent.on('mousedown', function(e) {
			if (e.target === $minimapOverlay[0]) {
				dragState = 'possible';
				lastEvent = e;
			} else if (e.target === $minimapRoot[0] || e.target.offsetParent === $minimapRoot[0]) {
				//console.log(e.offsetY);
				//scrollTo(e.offsetY);
				jumpTo(e.offsetY , true);
			}
		});
		$parent.on('mousemove', function(e) {
			if (dragState == 'possible') {
				//start dragging
				dragState = 'dragging';
			}
			if (dragState == 'dragging') {
				var minimapRootTop = parseInt($minimapRoot.css('top')),
					minimapOverlayTop = parseInt($minimapOverlay.css('top'));
				//scroll in %
				moveOverlay(e.clientY - lastEvent.clientY);
				//jumpTo(minimapRootTop + minimapOverlayTop + e.offsetY, false);
				lastEvent = e;
			}
		});
		//mouseup on document
		$(document).on('mouseup', function(e) {
			if (dragState === 'dragging' || dragState === 'possible') {
				dragState = false;
			}
		});

		$parent.on('mousewheel', function(e) {
			moveOverlay(e.originalEvent.wheelDeltaY * -1);
		});
		$parent.append($minimapOverlay);
		$parent.append($minimapRoot);
//		var modulePath = ExtensionUtils.getModulePath(modul);
//		JsWorker = new Worker(modulePath + "minimapWorker.js");
//		JsWorker.onmessage = function (e) {
//			if (e.data.type === 'log') {
//				console.log(e.data.value[0], e.data.value[1]);
//			} else if (e.data.type === 'data') {
//				$minimapRoot.append('<div class="wrap"></div>');
//				appendStringAsNodes($('.wrap' ,$minimapRoot)[0], e.data.value)
//				updateScrollOverlay();
//			}
//		};
//		JsWorker.addEventListener('error', function(e) {
//			console.log(['filename: ', e.filename, ' lineno: ', e.lineno, ' error: ', e.message].join(' '));
//		}, false);
	};
	exports.update = function (doc) {
		var mode = doc.getLanguage().getMode(),
			text = doc.getText();
//		JsWorker.postMessage({
//			mode : mode,
//			content : text
//		});
		$('.wrap' ,$minimapRoot).remove();
		CurrentDocument = doc;

		var html = CodeMirror.runMode(text, mode);
		$minimapRoot.append('<div class="wrap"></div>');
		appendStringAsNodes($('.wrap' ,$minimapRoot)[0], html);
//
		var currentEditor = doc._masterEditor;
		$(currentEditor).on('scroll', function(e) {
			if (dragState === false) {
				updateScrollOverlay();
			}
		});
	};
});
