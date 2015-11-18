/*
** tegaki client by secret
** very unfinished, but pretty easy to use. example of implementation at https://secret.graphics/k
** if you like it consider donating at https://cash.me/$secret
** todo list: marquee, lasso, and wand selection; move; fill; gradient; stroke event history and playback; netplay
**/
function nkTegaki(conf)
{
	var tegaki = {};
	//check for jquery
	if ('undefined' == typeof $)
	{
		console.log('jQuery not loaded');
		return;
	}
	//check for missing configuration
	if 
	(
		'undefined' == typeof conf 
		|| 'undefined' == typeof conf.container
		|| 'undefined' == typeof conf.container
		|| 'undefined' == typeof conf.canvasw
		|| 'undefined' == typeof conf.canvash
	)
	{
		console.log('missing configuration options');
		return;
	}
	//methods
	tegaki.colorformat = function(color)
	{
		if (3 == color.length)
		{
			color = color.substr(0, 1) + color.substr(0, 1) + color.substr(1, 1) + color.substr(1, 1) + color.substr(2, 1) + color.substr(2, 1);
		}
		return color;
	}
	tegaki.colorcheck = function(color)
	{
		//check that new color is a valid hex color string
		if (color.match(/[^a-f0-9]/) || (6 != color.length && 3 != color.length))
		{
			console.log('invalid hex color: ' + color);
			return 1;
		}
		return 0;
	}
	tegaki.rendertones = function()
	{
		var tonecanvas = document.createElement('canvas');
		var tonectx = tonecanvas.getContext('2d');
		for (toneid in tegaki.tonepack)
		{
			$(tonecanvas).attr('width', tegaki.tonepack[toneid].edge).attr('height', tegaki.tonepack[toneid].edge);
			//create background image for current tone
			var tonedata = tonectx.createImageData(tegaki.tonepack[toneid].edge, tegaki.tonepack[toneid].edge);
			//for each row of the tone
			for (var i = 0; i < tegaki.tonepack[toneid].edge; ++i)
			{
				//for each col of the tone
				for (var j = 0; j < tegaki.tonepack[toneid].edge; ++j)
				{
					if (1 == tegaki.tonepack[toneid].data[(i * tegaki.tonepack[toneid].edge) + j])
					{
						var index = (((i * tegaki.tonepack[toneid].edge) + j) * 4);
						tonedata.data[index] = tegaki.r;
						tonedata.data[index + 1] = tegaki.g;
						tonedata.data[index + 2] = tegaki.b;
						tonedata.data[index + 3] = 255;
					}
				}
			}
			tonectx.putImageData(tonedata, 0, 0);
			$(tegaki.control.tone[toneid]).css('background-image', 'url(' + tonecanvas.toDataURL() + ')');
		}
	}
	tegaki.changecolor = function(color)
	{
		if (0 < tegaki.colorcheck(color))
		{
			return;
		}
		//set new color
		tegaki.color = tegaki.colorformat(color);
		//convert existing paint to new color
		tegaki.drawcanvasctx.globalCompositeOperation = 'source-in';
		tegaki.drawcanvasctx.fillStyle = '#' + tegaki.color;
		tegaki.drawcanvasctx.fillRect
		(
			0, 
			0, 
			tegaki.canvasw, 
			tegaki.canvash
		);
		tegaki.r = parseInt(tegaki.color.substr(0, 2), 16);
		tegaki.g = parseInt(tegaki.color.substr(2, 2), 16);
		tegaki.b = parseInt(tegaki.color.substr(4, 2), 16);
		tegaki.buildtoolmask();
		tegaki.rendertones();
	}
	tegaki.cursorupdate = function()
	{
		//get real position
		tegaki.cursor.realx = Math.floor(tegaki.cursor.pagex - $(tegaki.drawcanvaswrap).offset().left);
		tegaki.cursor.realy = Math.floor(tegaki.cursor.pagey - $(tegaki.drawcanvaswrap).offset().top);
		if (tegaki.cursor.realx < 0 || tegaki.cursor.realx >= tegaki.canvasw || tegaki.cursor.realy < 0 || tegaki.cursor.realy >= tegaki.canvash)
		{
			return;
		}
	}
	tegaki.inputcancel = function()
	{
		console.log('cancelling current action');
		if (tegaki.toolid.marquee == tegaki.tool || tegaki.toolid.lasso == tegaki.tool || tegaki.toolid.wand == tegaki.tool)
		{
			console.log('cancelling select action');
		}
		else if (tegaki.toolid.eraser == tegaki.tool || tegaki.toolid.brush == tegaki.tool)
		{
			console.log('cancelling current stroke');
		}
		tegaki.inputfinish();
		tegaki.undo();
	}
	tegaki.inputstart = function()
	{
		tegaki.input = true;
		console.log('starting input');
		//starting new buffer
	}
	tegaki.inputupdate = function()
	{
		if (!tegaki.input)
		{
			return;
		}
		//!console.log('updating input');
		if (tegaki.toolid.brush == tegaki.tool || tegaki.toolid.eraser == tegaki.tool)
		{
			tegaki.strokeupdate();
			tegaki.paint(tegaki.cursor.realx, tegaki.cursor.realy, tegaki.tool, tegaki.size[tegaki.tool]);
		}
	}
	tegaki.strokeupdate = function()
	{
		if (0 == tegaki.strokebuffer.length)
		{
			//push to undo buffer
			var undoimagedata = tegaki.drawcanvasctx.getImageData(
				0, 
				0,
				tegaki.canvasw,
				tegaki.canvash
			);
			tegaki.undohistory.push([undoimagedata, tegaki.flipped]);
			tegaki.strokebuffer.push(Array(tegaki.tool, tegaki.size[tegaki.tool], tegaki.flipped));
		}
		else
		{
			//!check outside of canvas according to tool shape
			//outside canvas
			if (tegaki.cursor.realx < 0 || tegaki.cursor.realx >= tegaki.canvasw || tegaki.cursor.realy < 0 || tegaki.cursor.realy >= tegaki.canvash)
			{
				//last known was also outside canvas
				if (tegaki.cursor.lastx < 0 && tegaki.cursor.lastx >= tegaki.canvasw && tegaki.cursor.lasty < 0 && tegaki.cursor.lasty >= tegaki.canvash)
				{
					//set last known coords and return
					tegaki.cursor.lastx = tegaki.cursor.realx;
					tegaki.cursor.lasty = tegaki.cursor.realy;
					return;
				}
			}
			tegaki.interpolate(tegaki.cursor.realx, tegaki.cursor.realy, tegaki.cursor.lastx, tegaki.cursor.lasty);
		}
		tegaki.strokebuffer.push(Array(tegaki.cursor.realx, tegaki.cursor.realy));
		//set last known coords
		tegaki.cursor.lastx = tegaki.cursor.realx;
		tegaki.cursor.lasty = tegaki.cursor.realy;
	}
	tegaki.paint = function(x, y, tool, size)
	{
		//!console.log('painting at ' + x + ',' + y + ' with tool ' + tool + ', size: ' + size);
		var upperleftx = (x - tegaki.shapepack[size].hotspot[0]);
		var upperlefty = (y - tegaki.shapepack[size].hotspot[1]);
		switch (tool)
		{
			//brush
			case 0:
				tegaki.drawcanvasctx.globalCompositeOperation = 'source-over';
				//paint to current layer
				break;
			//eraser
			case 1:
				tegaki.drawcanvasctx.globalCompositeOperation = 'destination-out';
				//erase from current layer
				break;
		}
		if (0 == tegaki.tone)
		{
			tegaki.drawcanvasctx.drawImage
			(
				tegaki.toolmaskcanvas,
				upperleftx, 
				upperlefty
			);
			return;
		}
		//loop through tool edge x tool edge array and build shape for canvas masking out tone pixels
		var currentshape = tegaki.shapepack[size];
		var tooltonedata = tegaki.tooltonectx.createImageData(currentshape.edge, currentshape.edge);
		for (var i = 0; i < currentshape.edge; ++i)
		{
			var rowindex = (i * currentshape.edge);
			for (var j = 0; j < currentshape.edge; ++j)
			{
				//tonestate at current pixel was 1 and shapemask at current pixel was 1
				if (1 == currentshape.data[rowindex + j] && 1 == tegaki.tonemask[((upperlefty + i) * tegaki.canvasw) + upperleftx + j])
				{
					var index = ((rowindex + j) * 4);
					//write shapemask imagedata pixel
					tooltonedata.data[index] = tegaki.r;
					tooltonedata.data[index + 1] = tegaki.g;
					tooltonedata.data[index + 2] = tegaki.b;
					tooltonedata.data[index + 3] = 255;
				}
			}
		}
		tegaki.tooltonectx.putImageData(tooltonedata, 0, 0);
		tegaki.drawcanvasctx.drawImage
		(
			tegaki.tooltonecanvas,
			upperleftx, 
			upperlefty
		);
	}
	tegaki.interpolate = function(currentx, currenty, lastx, lasty)
	{
		//check for step distance
		var diffx = (currentx < lastx ? (lastx - currentx) : (-1 * (currentx - lastx)));
		var diffy = (currenty < lasty ? (lasty - currenty) : (-1 * (currenty - lasty)));
		var absdiffx = Math.abs(diffx);
		var absdiffy = Math.abs(diffy);
		//!console.log('interpolation check, (absdiffx: ' + absdiffx + ' > ' + tegaki.step + ') || (absdiffy: ' + absdiffy + ' > ' + tegaki.step + ')');
		//!console.log('might interpolate between (' + currentx + ',' + currenty + ') and (' + lastx + ',' + lasty + ')');
		if (absdiffx > tegaki.step || absdiffy > tegaki.step)
		{
			//!console.log('interpolating');
			//fill in missing steps
			var steps = Math.floor((absdiffx > absdiffy ? absdiffx : absdiffy) / tegaki.step);
			var interpx = 0;
			var interpy = 0;
			var stepx = (diffx / steps);
			var stepy = (diffy / steps);
			//dconsole.log('interpolating for ' + steps + ' steps, (' + stepx + ',' + stepy + ') apart');
			for (var i = 0; i <= steps; ++i)
			{
				interpx = Math.floor(currentx + (stepx * i));
				interpy = Math.floor(currenty + (stepy * i));
				//!tegaki.strokebuffer.push(Array(interpx, interpy));
				if (tegaki.toolid.brush == tegaki.tool || tegaki.toolid.eraser == tegaki.tool)
				{
					tegaki.paint(interpx, interpy, tegaki.tool, tegaki.size[tegaki.tool]);
				}
				//!other tools that use interpolation here
			}
		}
	}
	tegaki.inputfinish = function()
	{
		if (!tegaki.input)
		{
			return;
		}
		console.log('finishing input');
		tegaki.input = false;
		if (tegaki.toolid.brush == tegaki.tool || tegaki.toolid.eraser == tegaki.tool)
		{
			tegaki.strokehistory.push(tegaki.strokebuffer);
			tegaki.strokebuffer = Array();
		}
		//other tools here
		tegaki.redohistory = Array();
		tegaki.safetysave();
	}
	tegaki.buildtoolmask = function()
	{
		if ('undefined' == typeof tegaki.tool || 'undefined' == typeof tegaki.size[tegaki.tool] || 'undefined' == typeof tegaki.shapepack[tegaki.size[tegaki.tool]])
		{
			return 1;
		}
		if (tegaki.toolid.brush != tegaki.tool && tegaki.toolid.eraser != tegaki.tool)
		{
			console.log('tool mask has no meaning for tools other than brush and eraser');
			return 1;
		}
		console.log('building tool mask for tool ' + tegaki.tool + ', size ' + tegaki.size[tegaki.tool]);
		var currentshape = tegaki.shapepack[tegaki.size[tegaki.tool]];
		$(tegaki.tooltonecanvas).attr('width', currentshape.edge).attr('height', currentshape.edge);
		$(tegaki.toolmaskcanvas).attr('width', currentshape.edge).attr('height', currentshape.edge);
		var toolmaskdata = tegaki.toolmaskctx.createImageData(currentshape.edge, currentshape.edge);
		//cursor imagedata
		var cursordata = tegaki.toolmaskctx.createImageData(currentshape.edge, currentshape.edge);
		var cursor = false;
		var insidecursor = false;
		for (var i = 0; i < currentshape.edge; ++i)
		{
			for (var j = 0; j < currentshape.edge; ++j)
			{
				var currentpixel = (i * currentshape.edge) + j;
				var index = (currentpixel * 4);
				//shape data was 1
				if (1 == currentshape.data[currentpixel])
				{
					//write toolmask imagedata pixel
					toolmaskdata.data[index] = tegaki.r;
					toolmaskdata.data[index + 1] = tegaki.g;
					toolmaskdata.data[index + 2] = tegaki.b;
					toolmaskdata.data[index + 3] = 255;
					//first or last row
					if (0 == i || (currentshape.edge -1) == i)
					{
						cursor = true;
						cursordata.data[index] = 32;
						cursordata.data[index + 1] = 32;
						cursordata.data[index + 2] = 32;
						cursordata.data[index + 3] = 255;
					}
					//inside cursor
					else
					{
						if (!insidecursor || (currentshape.edge - 1) == j)
						{
							insidecursor = true;
							cursordata.data[index] = 32;
							cursordata.data[index + 1] = 32;
							cursordata.data[index + 2] = 32;
							cursordata.data[index + 3] = 255;
						}
					}
				}
				else
				{
					if (insidecursor)
					{
						//write previous cursor imagedata pixel
						cursordata.data[index - 4] = 32;
						cursordata.data[index - 3] = 32;
						cursordata.data[index - 2] = 32;
						cursordata.data[index - 1] = 255;
						insidecursor = false;
					}
				}
			}
			insidecursor = false;
		}
		//do cursor
		if (1 < currentshape.edge)
		{
			//hotspot pixel for cursor
			index = ((currentshape.hotspot[1] * currentshape.edge) + currentshape.hotspot[0]) * 4;
			cursordata.data[index] = 127;
			cursordata.data[index + 1] = 127;
			cursordata.data[index + 2] = 127;
			cursordata.data[index + 3] = 255;
			tegaki.toolmaskctx.putImageData(cursordata, 0, 0);
			$(tegaki.workspace).css('cursor', 'url(' + tegaki.toolmaskcanvas.toDataURL() + ') ' + currentshape.hotspot[0] + ' ' + currentshape.hotspot[1] + ', default');
		}
		else
		{
			$(tegaki.workspace).css('cursor', 'default');
		}
		$(tegaki.toolmaskcanvas).attr('width', currentshape.edge).attr('height', currentshape.edge);
		tegaki.toolmaskctx.putImageData(toolmaskdata, 0, 0);
	}
	tegaki.buildtonemask = function()
	{
		console.log('building tone mask');
		var tonerow = 0;
		var tonecol = 0;
		tegaki.tonemask = Array(tegaki.canvasw * tegaki.canvash);
		//for each row of the canvas
		for (var i = 0; i < tegaki.canvash; ++i)
		{
			//for each col of the canvas
			for (var j = 0; j < tegaki.canvasw; ++j)
			{
				var index = (i * tegaki.canvasw) + j;
				tegaki.tonemask[index] = tegaki.tonepack[tegaki.tone].data[(tonerow * tegaki.tonepack[tegaki.tone].edge) + tonecol];
				++tonecol;
				if (tonecol == tegaki.tonepack[tegaki.tone].edge)
				{
					tonecol = 0;
				}
			}
			++tonerow;
			if (tonerow == tegaki.tonepack[tegaki.tone].edge)
			{
				tonerow = 0;
			}
		}
	}
	tegaki.changetool = function(toolid)
	{
		if (tegaki.tool == toolid)
		{
			return;
		}
		for (var toolname in tegaki.toolid)
		{
			if (toolid == tegaki.toolid[toolname])
			{
				break;
			}
		}
		console.log('changing tool to ' + toolid + '(' + toolname + ') from ' + tegaki.tool);
		//store previous tool
		tegaki.toolprev = tegaki.tool;
		//set current tool
		tegaki.tool = toolid;
		$('.tool').removeClass('selected');
		$(tegaki.control.tool[toolname]).addClass('selected');
		if (tegaki.toolid.brush == tegaki.tool || tegaki.toolid.eraser == tegaki.tool)
		{
			tegaki.control.size.stepDown(tegaki.shapepack.length);
			tegaki.control.size.stepUp(tegaki.size[tegaki.tool]);
			$(tegaki.control.sizecount).text(tegaki.size[tegaki.tool]);
			tegaki.buildtoolmask();
		}
	}
	tegaki.sizeup = function()
	{
		tegaki.changesize(parseInt(tegaki.size[tegaki.tool]) + 1);
	}
	tegaki.sizedn = function()
	{
		tegaki.changesize(parseInt(tegaki.size[tegaki.tool]) - 1);
	}
	tegaki.changesize = function(size)
	{
		if (tegaki.toolid.brush != tegaki.tool && tegaki.toolid.eraser != tegaki.tool)
		{
			console.log('tool size has no meaning for tools other than brush and eraser');
			return 1;
		}
		if ('undefined' == typeof tegaki.shapepack[size])
		{
			console.log('size ' + size + ' not found for current shape pack');
			return 1;
		}
		console.log('changing size to ' + size);
		$(tegaki.control.size).attr('value', 0);
		tegaki.control.size.stepDown(tegaki.shapepack.length);
		tegaki.control.size.stepUp(size);
		tegaki.size[tegaki.tool] = size;
		$(tegaki.control.sizecount).text(tegaki.size[tegaki.tool]);
		tegaki.buildtoolmask();
	}
	tegaki.changetone = function(tone)
	{
		if (tegaki.tone == tone)
		{
			return 0;
		}
		//set tone globally
		if ('undefined' == typeof tegaki.tonepack[tone])
		{
			console.log('tone ' + tone + ' not found in tonepack');
			return 1;
		}
		console.log('changing tone to ' + tone);
		tegaki.tone = tone;
		$('.tone').removeClass('selected');
		$(tegaki.control.tone[tegaki.tone]).addClass('selected');
		//build tone mask
		tegaki.buildtonemask();
		return 0;
	}
	tegaki.undo = function()
	{
		console.log('undo history length: ' + tegaki.undohistory.length);
		if (0 < tegaki.undohistory.length)
		{
			//push to redo buffer
			var redoimagedata = tegaki.drawcanvasctx.getImageData(
				0, 
				0,
				tegaki.canvasw,
				tegaki.canvash
			);
			tegaki.redohistory.push([redoimagedata, tegaki.flipped]);
			//unwind last buffer in undohistory
			var undostate = tegaki.undohistory.pop();
			if ((undostate[1] && !tegaki.flipped) || (!undostate[1] && tegaki.flipped))
			{
				tegaki.localcanvasflip();
			}
			tegaki.drawcanvasctx.putImageData(undostate[0], 0, 0);
			tegaki.safetysave();
		}
		//!if undo history size is larger than undolevels then slice the earliest undo out of array
	}
	tegaki.redo = function()
	{
		console.log('redo history length: ' + tegaki.redohistory.length);
		if (0 < tegaki.redohistory.length)
		{
			//push to undo buffer
			var undoimagedata = tegaki.drawcanvasctx.getImageData(
				0, 
				0,
				tegaki.canvasw,
				tegaki.canvash
			);
			tegaki.undohistory.push([undoimagedata, tegaki.flipped]);
			//unwind last buffer in redohistory
			var redostate = tegaki.redohistory.pop();
			if ((redostate[1] && !tegaki.flipped) || (!redostate[1] && tegaki.flipped))
			{
				tegaki.localcanvasflip();
			}
			tegaki.drawcanvasctx.putImageData(redostate[0], 0, 0);
			tegaki.safetysave();
		}
	}
	tegaki.safetysave = function()
	{
		if ('undefined' != typeof tegaki.store)
		{
			tegaki.store.setItem('tegakisafety', window.JSON.stringify({flipped:tegaki.flipped,canvasw:tegaki.canvasw,canvash:tegaki.canvash,data:tegaki.drawcanvas.toDataURL()}));
		}
		else
		{
			//!fall back to cookie here
		}
	}
	tegaki.safetyclear = function()
	{
		if ('undefined' != typeof tegaki.store)
		{
			tegaki.store.removeItem('tegakisafety');
		}
		else
		{
			//!fall back to cookie here
		}
	}
	tegaki.safetyrestore = function()
	{
		if ('undefined' != typeof tegaki.store)
		{
			console.log('checking local storage for safety');
			var safety = window.JSON.parse(tegaki.store.getItem('tegakisafety'));
			if ('undefined' == typeof safety || null == safety || 'undefined' == typeof safety.data || null == safety.data || 'undefined' == typeof safety.data || 0 == safety.data.length)
			{
				return 1;
			}
			console.log('safety save existed, prompt to restore');
			if (true != confirm('Restore from safety data?'))
			{
				tegaki.store.removeItem('tegakisafety');
				return 1;
			}
			var prevcursor = $(tegaki.workspace).css('cursor');
			$(tegaki.workspace).css('cursor', 'wait');
			//restore from data
			if (safety.flipped)
			{
				tegaki.localcanvasflip();
			}
			tegaki.canvasw = safety.canvasw;
			tegaki.canvash = safety.canvash;
			tegaki.reinitializecanvas();
			var img = new Image();
			img.onload = function()
			{
				tegaki.drawcanvasctx.drawImage(img, 0, 0);
			}
			img.src = safety.data;
			$(tegaki.workspace).css('cursor', prevcursor);
		}
		else
		{
			//!fall back to cookie restore here
		}
		return 0;
	}
	tegaki.save = function()
	{
		console.log('saving');
		var savecanvas = document.createElement('canvas');
		$(savecanvas).attr('width', tegaki.canvasw).attr('height', tegaki.canvash);
		var savecanvasctx = savecanvas.getContext('2d');
		savecanvasctx.globalCompositeOperation = 'source-over';
		if (tegaki.flipped)
		{
			console.log('canvas was flipped, returning to normal before saving');
			tegaki.localcanvasflip();
		}
		savecanvasctx.putImageData
		(
			tegaki.drawcanvasctx.getImageData
			(
				0, 
				0,
				tegaki.canvasw,
				tegaki.canvash
			),
			0,
			0
		);
		savecanvasctx.globalCompositeOperation = 'destination-over';
		console.log('filling save canvas context destination-over with #' + tegaki.colorbg);
		savecanvasctx.fillStyle = '#' + tegaki.colorbg;
		savecanvasctx.fillRect
		(
			0, 
			0, 
			tegaki.canvasw, 
			tegaki.canvash
		);
		var canvasdata = savecanvas.toDataURL();
		if ('undefined' == typeof tegaki.saveurl)
		{
			//do local save
			return;
		}
		//do remote save
		var saveresponse = '';
		var fd = new FormData();
		fd.append('image', canvasdata);
		//!fd.append('event', JSON.stringify(tegaki.strokebuffer));
		$.ajax(
		{
			url			: tegaki.saveurl,
			type		: 'post',
			data		: fd,
			processData	: false,
			contentType	: false,
			statusCode	: 
			{
				200: function ()
				{
					console.log('save success');
					tegaki.savesuccess();
					tegaki.safetyclear();
				},
				404: function ()
				{
					console.log('save url was not found');
				},
				401: function ()
				{
					console.log('not authorized, maybe you need to log in');
				},
				403: function ()
				{
					console.log('forbidden, maybe you\'re not allowed');
				},
				429: function ()
				{
					console.log('cooldown');
				}
			}
		}).done(function (data)
		{
			saveresponse = data;
			console.log(saveresponse);
		});
	}
	tegaki.clearin = function()
	{
		console.log('clearing canvas');
		//push to undo buffer
		var undoimagedata = tegaki.drawcanvasctx.getImageData(
			0, 
			0,
			tegaki.canvasw,
			tegaki.canvash
		);
		tegaki.undohistory.push([undoimagedata, tegaki.flipped]);
		tegaki.strokehistory.push(Array(Array(-1, 0, 0)));
		//there is an active selection area on layer
		if (0)
		{
			//clear inside selection on layer
			return 0;
		}
		//clear entire layer
		tegaki.drawcanvasctx.clearRect
		(
			0, 
			0, 
			(tegaki.canvasw), 
			(tegaki.canvash)
		);
		return 0;
	}
	tegaki.clearout = function()
	{
		//!clear outside selection not done yet
	}
	tegaki.localcanvasflip	= function()
	{
		//flipping local canvas
		console.log('flipping local canvas');
		var input = tegaki.drawcanvasctx.getImageData(0, 0, tegaki.canvasw, tegaki.canvash);
		var output = tegaki.drawcanvasctx.createImageData(tegaki.canvasw, tegaki.canvash);
		var w = tegaki.canvasw;
		var h = tegaki.canvash;
		var inputData = input.data;
		var outputData = output.data
		for (var y = 0; y < h; y++)
		{
			for (var x = 0; x < w; x++)
			{
				// RGB
				var i = (((y - 1) * w) + x)*4;
				var flip = (((y - 1) * w) + (w - x - 1))*4;
				for (var c = 0; c < 4; c++)
				{
						outputData[(i + c)] = inputData[(flip + c)];
				}
			}
		}
		tegaki.drawcanvasctx.putImageData
		(
			output,
			0,
			0
		);
		tegaki.flipped = !tegaki.flipped;
		if (tegaki.flipped)
		{
			$(tegaki.control.tool.flip).addClass('flipped');
		}
		else
		{
			$(tegaki.control.tool.flip).removeClass('flipped');
		}
	}
	tegaki.reinitializecanvas	= function()
	{
		$(tegaki.drawcanvaswrap).css('width', tegaki.canvasw).css('height', tegaki.canvash);
		$(tegaki.drawcanvas).attr('width', tegaki.canvasw).attr('height', tegaki.canvash);
		$(tegaki.overlaycanvas).attr('width', tegaki.canvasw).attr('height', tegaki.canvash);
	}
	tegaki.initialize = function()
	{
		console.log('initializing tegaki');
		if ('undefined' == typeof tegaki.shapepack)
		{
			console.log('missing shapepack');
			return 1;
		}
		if ('undefined' == typeof tegaki.tonepack)
		{
			console.log('missing tonepack');
			return 1;
		}
		//properties
		tegaki.container = conf.container;
		tegaki.canvasw = conf.canvasw;
		tegaki.canvash = conf.canvash;
		tegaki.input = false; //input button
		tegaki.mod = false; //modifier button
		tegaki.flipped = false; //local canvas is flipped
		tegaki.step = 1; //distance for interpolation
		tegaki.colorfg = '000000'; //tegaki tegaki client user's color representation
		tegaki.colorbg = 'ffffff'; //canvas color
		tegaki.strokebuffer = Array(); //current stroke buffer for ongoing stroke
		tegaki.strokehistory = Array(); //array of stroke buffers for event
		tegaki.undolevels = 64; //max number of undos to store
		tegaki.undohistory = Array(); //array of canvas states for undo history
		tegaki.redohistory = Array(); //array of canvas states for redo history after undo
		//!maybe layers someday
		//!tegaki.layer = Array(); //array of layer canvases
		//!tegaki.layerctx = Array(); //array of layer contexts
		tegaki.size = Array(); //array of tool sizes
		tegaki.tonemask = Array(); //array for current tone mask
		tegaki.safety = Array(); //array for safety save imagedata
		tegaki.cursor =
		{
			pagex : 0, //pagewide x position
			pagey : 0, //pagewide y position
			realx : 0, //actual x position
			realy : 0 //actual y position
		};
		tegaki.toolid =
		{
			brush : 0,
			eraser : 1,
			marquee : 4,
			lasso : 5,
			wand : 6,
			move : 7,
			fill : 8,
			gradient : 9,
			jumble : 10
		};
		//custom configuration
		if ('undefined' != typeof conf.saveurl)
		{
			tegaki.saveurl = conf.saveurl;
		}
		if ('undefined' != typeof conf.savesuccess)
		{
			tegaki.savesuccess = conf.savesuccess;
		}
		//create tool representation
		tegaki.toolmaskcanvas = document.createElement('canvas');
		tegaki.toolmaskctx = tegaki.toolmaskcanvas.getContext('2d');
		//create tool tone respresentation
		tegaki.tooltonecanvas = document.createElement('canvas');
		tegaki.tooltonectx = tegaki.tooltonecanvas.getContext('2d');
		//create menus and workspace
		console.log('creating menus');
		tegaki.controlmenu = document.createElement('div');
		tegaki.toolmenu = document.createElement('div');
		tegaki.sizemenu = document.createElement('div');
		tegaki.tonemenu = document.createElement('div');
		tegaki.workspace = document.createElement('div');
		tegaki.drawcanvaswrap = document.createElement('span');
		//create controls
		tegaki.control =
		{
			tool :
			{
				brush : document.createElement('span'),
				eraser : document.createElement('span'),
				marquee : document.createElement('span'),
				lasso : document.createElement('span'),
				wand : document.createElement('span'),
				move : document.createElement('span'),
				fill : document.createElement('span'),
				gradient : document.createElement('span'),
				jumble : document.createElement('span'),
				flip : document.createElement('span'),
				undo : document.createElement('span'),
				redo : document.createElement('span'),
				save : document.createElement('span'),
				clear : document.createElement('span')
			},
			tone : Array(),
			size : document.createElement('input'),
			sizecount : document.createElement('span'),
			sizeup : document.createElement('button'),
			sizedn : document.createElement('button')
		};
		//build tool menu
		for (var toolid in tegaki.control.tool)
		{
			$(tegaki.toolmenu).append($(tegaki.control.tool[toolid]).addClass('tool').addClass(toolid));
		}
		//build tone menu
		for (toneid in tegaki.tonepack)
		{
			tegaki.control.tone[toneid] = document.createElement('span');
			$(tegaki.tonemenu).append($(tegaki.control.tone[toneid]).addClass('tone').data('id', toneid));
			$(tegaki.control.tone[toneid]).on('click', function()
			{
				tegaki.changetone($(this).data('id'));
			});
		}
		tegaki.rendertones();
		//default bindings
		console.log('assigning default key bindings');
		tegaki.binding = 
		{
			modadd : [16, false], //shift
			modmove : [17, false], //ctrl
			modsubtract : [18, false], //alt
			sizedn : [65, false], //a
			brush : [66, false], //b
			copy : [67, true], //ctrl+c
			deselect : [68, true], //ctrl+d
			eraser : [69, false], //e
			merge : [69, true], //ctrl+e
			fill : [70, false], //f
			gradient : [71, false],	//g
			localcanvasflip : [72, false], //h
			invertselection : [73, true], //i
			lasso : [76, false], //l
			newlayer : [76, true], //ctrl+l
			marquee : [77, false], //m
			jumble : [82, false], //r
			sizeup : [83, false], //s
			save : [83, true], //ctrl+s
			transform : [84, true], //ctrl+t
			move : [86, false], //v
			paste : [86, true],	//ctrl+v
			wand : [87, false], //w
			swap : [88, false], //x
			cut : [88, true], //ctrl+x
			redo : [89, true], //ctrl+y
			undo : [90, true], //ctrl+z
			clearin : [46, false], //del
			clearout : [46, true] //ctrl+del
		};
		//override defaults with custom bindings if provided
		if ('undefined' != typeof conf.binding)
		{
			console.log('assigning custom key bindings');
			for (var currentbind in conf.binding)
			{
				tegaki.binding[currentbind] = conf.binding[currentbind];
			}
		}
		//listeners for keys
		tegaki.simulateclick = function(obj)
		{
			$(obj).addClass('active');
			setTimeout(function(){$(obj).removeClass('active')}, 60);
		}
		console.log('registering listeners for shortcut keys');
		$(window).keydown(function(e)
		{
			//switch tool to brush
			if (e.keyCode == tegaki.binding.brush[0] && (false == tegaki.binding.brush[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.brush);
				tegaki.simulateclick(tegaki.control.tool.brush);
				return 0;
			}
			//switch tool to eraser
			if (e.keyCode == tegaki.binding.eraser[0] && (false == tegaki.binding.brush[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.eraser);
				tegaki.simulateclick(tegaki.control.tool.eraser);
				return 0;
			}
			//switch tool to marquee
			if (e.keyCode == tegaki.binding.marquee[0] && (false == tegaki.binding.marquee[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.marquee);
				tegaki.simulateclick(tegaki.control.tool.marquee);
				return 0;
			}
			//switch tool to lasso
			if (e.keyCode == tegaki.binding.lasso[0] && (false == tegaki.binding.lasso[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.lasso);
				tegaki.simulateclick(tegaki.control.tool.lasso);
				return 0;
			}
			//switch tool to wand
			if (e.keyCode == tegaki.binding.wand[0] && (false == tegaki.binding.wand[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.wand);
				tegaki.simulateclick(tegaki.control.tool.wand);
				return 0;
			}
			//switch tool to move
			if (e.keyCode == tegaki.binding.move[0] && (false == tegaki.binding.move[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.move);
				tegaki.simulateclick(tegaki.control.tool.move);
				return 0;
			}
			//switch tool to fill
			if (e.keyCode == tegaki.binding.fill[0] && (false == tegaki.binding.fill[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.fill);
				tegaki.simulateclick(tegaki.control.tool.fill);
				return 0;
			}
			//switch tool to gradient
			if (e.keyCode == tegaki.binding.gradient[0] && (false == tegaki.binding.gradient[1] || e.ctrlKey))
			{
				tegaki.changetool(tegaki.toolid.gradient);
				tegaki.simulateclick(tegaki.control.tool.gradient);
				return 0;
			}
			//flip local canvas horizontally
			if (e.keyCode == tegaki.binding.localcanvasflip[0] && (false == tegaki.binding.localcanvasflip[1] || e.ctrlKey))
			{
				tegaki.localcanvasflip();
				return 0;
			}
			//undo
			if (e.keyCode == tegaki.binding.undo[0] && (false == tegaki.binding.undo[1] || e.ctrlKey))
			{
				tegaki.undo();
				tegaki.simulateclick(tegaki.control.tool.undo);
				return 0;
			}
			//redo
			if (e.keyCode == tegaki.binding.redo[0] && (false == tegaki.binding.redo[1] || e.ctrlKey))
			{
				tegaki.redo();
				tegaki.simulateclick(tegaki.control.tool.redo);
				return 0;
			}
			//save
			if (e.keyCode == tegaki.binding.save[0] && (false == tegaki.binding.save[1] || e.ctrlKey))
			{
				tegaki.save();
				tegaki.simulateclick(tegaki.control.tool.save);
				return 0;
			}
			//clear
			if (e.keyCode == tegaki.binding.clearin[0] && (false == tegaki.binding.clearin[1] || e.ctrlKey))
			{
				tegaki.clearin();
				tegaki.simulateclick(tegaki.control.tool.clear);
				return 0;
			}
			//clear out of selection
			if (e.keyCode == tegaki.binding.clearout[0] && (false == tegaki.binding.clearout[1] || e.ctrlKey))
			{
				tegaki.clearout();
				tegaki.simulateclick(tegaki.control.tool.clear);
				return 0;
			}
			//swap brush/eraser
			if (e.keyCode == tegaki.binding.swap[0] && (false == tegaki.binding.swap[1] || e.ctrlKey))
			{
				if (tegaki.toolid.brush == tegaki.tool)
				{
					tegaki.changetool(tegaki.toolid.eraser);
				}
				else if (tegaki.toolid.eraser == tegaki.tool)
				{
					tegaki.changetool(tegaki.toolid.brush);
				}
				return 0;
			}
			//copy selection
			if (e.keyCode == tegaki.binding.copy[0] && (false == tegaki.binding.copy[1] || e.ctrlKey))
			{
				tegaki.copy();
				return 0;
			}
			//cut selection
			if (e.keyCode == tegaki.binding.cut[0] && (false == tegaki.binding.cut[1] || e.ctrlKey))
			{
				tegaki.cut();
				return 0;
			}
			//paste selection
			if (e.keyCode == tegaki.binding.paste[0] && (false == tegaki.binding.paste[1] || e.ctrlKey))
			{
				tegaki.paste();
				return 0;
			}
			//invert selection
			if (e.keyCode == tegaki.binding.invertselection[0] && (false == tegaki.binding.invertselection[1] || e.ctrlKey))
			{
				tegaki.invertselection();
				return 0;
			}
			//selection modifiers
			if (tegaki.toolid.marquee == tegaki.tool || tegaki.toolid.lasso == tegaki.tool || tegaki.toolid.wand == tegaki.tool)
			{
				//enter modifier selection add mode
				if (e.keyCode == tegaki.binding.modadd[0] && (false == tegaki.binding.modadd[1] || e.ctrlKey))
				{
					tegaki.mod = true;
					tegaki.selectmode = 1;
					return 0;
				}
				//enter modifier selection subtract mode
				if (e.keyCode == tegaki.binding.modsubtract[0] && (false == tegaki.binding.modsubtract[1] || e.ctrlKey))
				{
					tegaki.mod = true;
					tegaki.selectmode = 2;
					return 0;
				}
				//enter modifier move mode
				if (e.keyCode == tegaki.binding.modmove[0] && (false == tegaki.binding.modmove[1] || e.ctrlKey))
				{
					tegaki.mod = true;
					tegaki.changetool(tegaki.toolid.move);
					return 0;
				}
			}
			//size down current shape
			if (e.keyCode == tegaki.binding.sizedn[0] && (false == tegaki.binding.sizedn[1] || e.ctrlKey))
			{
				tegaki.sizedn();
				return 0;
			}
			//size up current shape
			if (e.keyCode == tegaki.binding.sizeup[0] && (false == tegaki.binding.sizeup[1] || e.ctrlKey))
			{
				tegaki.sizeup();
				return 0;
			}
		});
		$(window).keyup(function(e)
		{
			//exit modifier mode if ctrl is released
			if (tegaki.mod && 17 == e.keyCode)
			{
				tegaki.mod = false;
				tegaki.selectmode = 0;
				tegaki.changetool(tegaki.toolprev);
				return 0;
			}
			//exit modifier selection add/subtract mode
			if (tegaki.mod && (tegaki.toolid.marquee == tegaki.tool || tegaki.toolid.lasso == tegaki.tool || tegaki.toolid.wand == tegaki.tool) && (e.keyCode == tegaki.binding.modadd[0] || e.keyCode == tegaki.binding.modsubtract[0]))
			{
				tegaki.mod = false;
				tegaki.selectmode = 0;
				return 0;
			}
			//exit modifier move mode
			if (tegaki.mod && e.keyCode == tegaki.binding.modmove[0])
			{
				tegaki.mod = false;
				if (tegaki.toolid.move == tegaki.tool)
				{
					tegaki.changetool(tegaki.toolprev);
				}
				return 0;
			}
		});
		//listeners for control button clicks
		$(tegaki.control.tool.brush).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.brush);
		});
		$(tegaki.control.tool.eraser).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.eraser);
		});
		$(tegaki.control.tool.marquee).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.marquee);
		});
		$(tegaki.control.tool.lasso).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.lasso);
		});
		$(tegaki.control.tool.wand).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.wand);
		});
		$(tegaki.control.tool.move).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.move);
		});
		$(tegaki.control.tool.fill).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.fill);
		});
		$(tegaki.control.tool.gradient).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.gradient);
		});
		$(tegaki.control.tool.jumble).on('click', function(e)
		{
			tegaki.changetool(tegaki.toolid.jumble);
		});
		$(tegaki.control.tool.flip).on('click', function(e)
		{
			tegaki.localcanvasflip();
		});
		$(tegaki.control.tool.undo).on('click', function(e)
		{
			tegaki.undo();
		});
		$(tegaki.control.tool.redo).on('click', function(e)
		{
			tegaki.redo();
		});
		$(tegaki.control.tool.save).on('click', function(e)
		{
			tegaki.save();
		});
		$(tegaki.control.tool.clear).on('click', function(e)
		{
			tegaki.clearin();
		});
		$(tegaki.control.sizedn).on('click', function(e)
		{
			tegaki.sizedn();
		});
		$(tegaki.control.sizeup).on('click', function(e)
		{
			tegaki.sizeup();
		});
		//listener for size change
		console.log('registering listener for size change');
		$(tegaki.control.size).change(function(e)
		{
			tegaki.changesize($(this).val());
		});
		//listeners for workspace clicks
		console.log('registering listeners for workspace clicks');
		$(tegaki.workspace).mousedown(function(e)
		{
			//already doing a stroke, cancel it
			if (tegaki.input) // && 2 == e.button
			{
				tegaki.inputcancel();
				return;
			}
			if (2 == e.button)
			{
				return;
			}
			tegaki.cursor.pagex = e.pageX;
			tegaki.cursor.pagey = e.pageY;
			//start input
			tegaki.inputstart();
			//do first input update
			tegaki.inputupdate();
		});
		$(document).mouseup(function()
		{
			if (tegaki.input)
			{
				tegaki.inputfinish();
			}
		});
		//listeners for workspace movement
		console.log('registering listeners for workspace movement');
		$(tegaki.workspace).mousemove(function(e)
		{
			tegaki.cursor.pagex = e.pageX;
			tegaki.cursor.pagey = e.pageY;
			tegaki.cursorupdate();
			if (!tegaki.input)
			{
				return;
			}
			tegaki.inputupdate();
		});
		//create overlay
		console.log('creating overlay canvas');
		tegaki.overlaycanvas = document.createElement('canvas');
		$(tegaki.overlaycanvas).attr('width', tegaki.canvasw).attr('height', tegaki.canvash);
		tegaki.overlayctx = tegaki.overlaycanvas.getContext('2d');
		tegaki.drawcanvas = document.createElement('canvas');
		tegaki.drawcanvasctx = tegaki.drawcanvas.getContext('2d');
		$(tegaki.overlaycanvas).after();
		console.log('clearing container, building control menus and workspace');
		//initialize drawing canvas
		console.log('adding drawcanvas');
		tegaki.container.innerHTML = '';
		$(tegaki.container).addClass('nktcontainer').css('display', 'block').css('font-size', '0')
		.append
		(
			$(tegaki.controlmenu).addClass('nktcontrol')
			.append
			(
				$(tegaki.toolmenu).addClass('toolmenu')
			)
			.append
			(
				$(tegaki.sizemenu).addClass('sizemenu')
				.append($(tegaki.control.sizecount).addClass('sizecount'))
				.append($(tegaki.control.size).attr('type', 'range').attr('step', 1).attr('min', 0).attr('max', (tegaki.shapepack.length - 1)))
				.append($(tegaki.control.sizedn).addClass('sizeup').text('-'))
				.append($(tegaki.control.sizeup).addClass('sizedn').text('+'))
			)
			.append
			(
				$(tegaki.tonemenu).addClass('tonemenu')
			)
		)
		.append
		(
			$(tegaki.workspace).addClass('nktworkspace')
			.append
			(
				$(tegaki.drawcanvaswrap).addClass('drawcanvaswrap')
				.css('width', tegaki.canvasw).css('height', tegaki.canvash)
				.append($(tegaki.overlaycanvas).attr('width', tegaki.canvasw).attr('height', tegaki.canvash).addClass('overlay'))
				.append($(tegaki.drawcanvas).attr('width', tegaki.canvasw).attr('height', tegaki.canvash).addClass('drawcanvas'))
			)
		);
		//initial color
		tegaki.changecolor('000');
		//start with eraser size 6
		tegaki.changetool(1);
		tegaki.changesize(6);
		//start with brush size 1
		tegaki.changetool(0);
		tegaki.changesize(1);
		//!move shape and tone packs to external json eventually, right now they're hardcoded before initialization
		//!start with circle-basic shapepack
		//!tegaki.changeshapepack('circle-basic');
		//!start with classic-lowres tonepack
		//!tegaki.changetonepack('classic-lowres');
		//start with opaque
		tegaki.changetone(0);
		//disable normal right click behavior over workspace
		tegaki.workspace.oncontextmenu = function()
		{
			return false;
		}
		//check for local storage
		if (function ()
		{
			try
			{
				return 'localStorage' in window && window['localStorage'] !== null;
			}
			catch (e)
			{
				return false;
			}
		})
		{
			//localstorage available
			tegaki.store = localStorage;
		}
		else
		{
			//!fall back to cookie storage
		}
		//retouch
		if (conf.loadimage)
		{
			var prevcursor = $(tegaki.workspace).css('cursor');
			$(tegaki.workspace).css('cursor', 'wait');
			function fetchBlob(uri, callback)
			{
				var xhr = new XMLHttpRequest();
				xhr.open('GET', uri, true);
				xhr.responseType = 'arraybuffer';
				xhr.onload = function(e)
				{
					if (this.status == 200)
					{
						var blob = this.response;
						if (callback)
						{
							callback(blob);
						}
					}
				};
				xhr.send();
			};
			function _arrayBufferToBase64(buffer)
			{
				var binary = '';
				var bytes = new Uint8Array(buffer);
				var len = bytes.byteLength;
				for (var i = 0; i < len; i++)
				{
					binary += String.fromCharCode(bytes[i]);
				}
				return window.btoa(binary);
			};
			var retouchobj = new Image();
			retouchobj.onload = function()
			{
				console.log('retouch image loaded');
				tegaki.canvasw = this.width;
				tegaki.canvash = this.height;
				tegaki.reinitializecanvas();
				tegaki.drawcanvasctx.drawImage(this, 0, 0);
				$(tegaki.workspace).css('cursor', prevcursor);
			}
			fetchBlob(conf.loadimage, function(blob)
			{
				retouchobj.src = 'data:image/*;base64,' + _arrayBufferToBase64(blob);
			});
        }
		else
		{
			console.log('checking for safety to restore');
			tegaki.safetyrestore();
		}
	}
	tegaki.shapepack = 
	[
		{
			"edge":1,
			"data":[
				1
			],
			"hotspot":[0,0]
		},
		{
			"edge":2,
			"data":[
				1,1,
				1,1
			],
			"hotspot":[0,0]
		},
		{
			"edge":3,
			"data":[
				0,1,0,
				1,1,1,
				0,1,0
			],
			"hotspot":[1,1]
		},
		{
			"edge":3,
			"data":[
				1,1,1,
				1,1,1,
				1,1,1
			],
			"hotspot":[1,1]
		},
		{
			"edge":4,
			"data":[
				0,1,1,0,
				1,1,1,1,
				1,1,1,1,
				0,1,1,0
			],
			"hotspot":[1,1]
		},
		{
			"edge":5,
			"data":[
				0,1,1,1,0,
				1,1,1,1,1,
				1,1,1,1,1,
				1,1,1,1,1,
				0,1,1,1,0
			],
			"hotspot":[2,2]
		},
		{
			"edge":6,
			"data":[
				0,1,1,1,1,0,
				1,1,1,1,1,1,
				1,1,1,1,1,1,
				1,1,1,1,1,1,
				1,1,1,1,1,1,
				0,1,1,1,1,0
			],
			"hotspot":[2,2]
		},
		{
			"edge":7,
			"data":[
				0,1,1,1,1,1,0,
				1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,
				0,1,1,1,1,1,0
			],
			"hotspot":[3,3]
		},
		{
			"edge":8,
			"data":[
				0,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,0
			],
			"hotspot":[3,3]
		},
		{
			"edge":9,
			"data":[
				0,0,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,0,0
			],
			"hotspot":[4,4]
		},
		{
			"edge":11,
			"data":[
				0,0,0,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,0,0,0
			],
			"hotspot":[5,5]
		},
		{
			"edge":13,
			"data":[
				0,0,0,0,1,1,1,1,1,0,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,0,1,1,1,1,1,0,0,0,0
			],
			"hotspot":[6,6]
		},
		{
			"edge":15,
			"data":[
				0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,0,1,1,1,1,1,0,0,0,0,0
			],
			"hotspot":[7,7]
		},
		{
			"edge":17,
			"data":[
				0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0
			],
			"hotspot":[8,8]
		},
		{
			"edge":19,
			"data":[
				0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0
			],
			"hotspot":[9,9]
		},
		{
			"edge":21,
			"data":[
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0
			],
			"hotspot":[10,10]
		},
		{
			"edge":23,
			"data":[
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0
			],
			"hotspot":[11,11]
		},
		{
			"edge":25,
			"data":[
				0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[12,12]
		},
		{
			"edge":27,
			"data":[
				0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[13,13]
		},
		{
			"edge":29,
			"data":[
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[14,14]
		},
		{
			"edge":31,
			"data":[
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[15,15]
		},
		{
			"edge":35,
			"data":[
				0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[17,17]
		},
		{
			"edge":39,
			"data":[
				0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[19,19]
		},
		{
			"edge":45,
			"data":[
				0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
				0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
				0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
			],
			"hotspot":[22,22]
		}
	];
	tegaki.tonepack = 
	[
		{
			"edge":1,
			"data":[
				1
			]
		},
		{
			"edge":4,
			"data":[
				0,1,1,1,
				1,1,1,1,
				1,1,1,1,
				1,1,1,1
			]
		},
		{
			"edge":4,
			"data":[
				0,1,1,1,
				1,1,1,1,
				1,1,0,1,
				1,1,1,1
			]
		},
		{
			"edge":2,
			"data":[
				0,1,
				1,1
			]
		},
		{
			"edge":4,
			"data":[
				0,1,0,1,
				1,0,1,1,
				0,1,0,1,
				1,1,1,1
			]
		},
		{
			"edge":4,
			"data":[
				0,1,0,1,
				1,0,1,1,
				0,1,0,1,
				1,1,1,0
			]
		},
		{
			"edge":4,
			"data":[
				0,1,0,1,
				1,0,1,0,
				0,1,0,1,
				1,1,1,0
			]
		},
		{
			"edge":2,
			"data":[
				0,1,
				1,0
			]
		},
		{
			"edge":4,
			"data":[
				1,0,1,0,
				0,1,0,0,
				1,0,1,0,
				0,0,0,1
			]
		},
		{
			"edge":4,
			"data":[
				1,0,1,0,
				0,1,0,0,
				1,0,1,0,
				0,0,0,0
			]
		},
		{
			"edge":2,
			"data":[
				1,0,
				0,0
			]
		},
		{
			"edge":4,
			"data":[
				1,0,0,0,
				0,0,0,0,
				0,0,1,0,
				0,0,0,0
			]
		},
		{
			"edge":4,
			"data":[
				1,0,0,0,
				0,0,0,0,
				0,0,0,0,
				0,0,0,0
			]
		}
	];
	tegaki.initialize();
};
