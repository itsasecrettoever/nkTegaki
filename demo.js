var tegakiinstance;
$(document).ready(function()
{
	var triggercontainer = document.createElement('div');
	var triggers = document.createElement('a');
	var triggerm = document.createElement('a');
	var triggerl = document.createElement('a');
	$('#tegakicontainer').before
	(
		$(triggercontainer).attr('id', 'tegakitriggers')
		.append($(triggers).data('size', 's').html('S'))
		.append($(triggerm).data('size', 'm').html('M'))
		.append($(triggerl).data('size', 'l').html('L'))
	);
	var tegakisavecallback = function(){console.log('saving');};
	var tegakiobj = document.getElementById('mytegaki');
	$('#tegakitriggers').on('click', 'a', function()
	{
		console.log('here');
		if ('undefined' != typeof tegakiinstance)
		{
			if (true != confirm('This will clear the current canvas, are you sure?'))
			{
				return;
			}
		}
		switch ($(this).data('size'))
		{
			case 's':
				console.log('preset size 512x256');
				var width = 512;
				var height = 256;
				break;
			case 'm':
				console.log('preset size 512x512');
				var width = 512;
				var height = 512;
				break;
			case 'l':
				console.log('preset size 512x768');
				var width = 512;
				var height = 768;
				break;
		}
		$('#tegakicontainer').css('display', 'block');
		tegakiinstance = new nkTegaki(
		{
			container	: tegakiobj, 
			canvasw		: width, 
			canvash		: height, 
			saveurl		: 'remote save url here', 
			savesuccess	: tegakisavecallback, 
			loadimage	: '', 
			loadevent	: '',
			intittool	: 0,
			initshape	: 0,
			initsize	: 1,
			inittone	: 0
		});
	});
});