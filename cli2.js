var l8 = require('./l8');
var util = require('util');
var SerialPortStream = require('serial-port-stream');

var l8_pics = require('./l8_pics');

var streama = new SerialPortStream('/dev/rfcomm0');
var l8a = l8.init(streama);
var streamb = new SerialPortStream('/dev/rfcomm1');
var l8b = l8.init(streamb);

l8a
	.on('packet', function(pkt) {
		//console.log("A", pkt);
	})
	.on("VOLTAGE_RESPONSE", function(pkt) {
		console.log("L8 A has a battery level of " + pkt.level + "%");
	});

l8b
	.on('packet', function(pkt) {
		//console.log("B", pkt);
	})
	.on("VOLTAGE_RESPONSE", function(pkt) {
		console.log("L8 B has a battery level of " + pkt.level + "%");
	});

streama.on('open', function() {
	console.log("Open (a)");

	l8a.send('MATRIX_OFF');
	l8a.send('SUPERLED_SET', {bgr:{b:0x00, g:0x00, r:0x00}});
	setInterval(function() {
		l8a.send('VOLTAGE_QUERY');
	}, 1000);

});

streamb.on('open', function() {
	console.log("Open (b)");

	l8b.send('MATRIX_OFF');
	l8b.send('SUPERLED_SET', {bgr:{b:0x00, g:0x00, r:0x00}});
	setInterval(function() {
		l8b.send('VOLTAGE_QUERY');
	}, 1000);
});

var stdin = process.openStdin();
process.stdin.setRawMode(true);
process.stdin.resume();
stdin.on('data', function (key) {
	//console.log(key);

	switch (key[0]) {

		case 0x31:
			l8a.send('MATRIX_OFF');
			l8b.send('MATRIX_OFF');
			l8a.send('SUPERLED_SET', {bgr:{b:0x0,g:0x0,r:0x0}});
			l8b.send('SUPERLED_SET', {bgr:{b:0x0,g:0x0,r:0x0}});
			break;

		case 0x32:
			var pixels = [];
			for (var i=0; i<64; i++) {
				pixels[i] = {b:7-(i%8), g:parseInt(i/8), r:0};
			}
			l8b.send('MATRIX_SET', {pixels:pixels});

			var pixels = [];
			for (var i=0; i<64; i++) {
				pixels[i] = {b:(i%8), r:7-(i%8), g:parseInt(i/8)};
			}
			l8a.send('MATRIX_SET', {pixels:pixels});
			break;

		case 0x33:
			l8a.send('VOLTAGE_QUERY');
			l8b.send('VOLTAGE_QUERY');
			break;

		case 0x34:
			l8a.send('MATRIX_SET', {pixels:l8_pics.mail});
			break;

		case 0x35:
			l8a.send('MATRIX_SET', {pixels:l8_pics.boxes});
			break;

		case 0x36:
			l8b.send('MATRIX_SET', {pixels:l8_pics.mail});
			break;

		case 0x37:
			l8b.send('MATRIX_SET', {pixels:l8_pics.boxes});
			break;

		case 0x38:
			l8a.send('SUPERLED_SET', {bgr:{b:0xf,g:0x0,r:0x0}});
			l8b.send('SUPERLED_SET', {bgr:{b:0xf,g:0x0,r:0x0}});
			break;

		case 0x39:
			l8a.send('SUPERLED_SET', {bgr:{b:0x0,g:0xf,r:0xf}});
			l8b.send('SUPERLED_SET', {bgr:{b:0x0,g:0xf,r:0xf}});
			break;

		case 0x03: // ctrl-c
			console.log("Closing...");
			process.stdin.pause();
			process.exit();
			break;

		case 0x1b: // control character
			if (key.length == 3) {

			}
			break;
	}

});

