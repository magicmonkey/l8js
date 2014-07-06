var l8 = require('./l8');
var util = require('util');
var SerialPortStream = require('serial-port-stream');

var l8_pics = require('./l8_pics');

var streama = new SerialPortStream('/dev/rfcomm0');
var l8a = l8.init(streama);

l8a
.on('packet', function(pkt) {
	//console.log("A", pkt);
})
.on("VOLTAGE_RESPONSE", function(pkt) {
	console.log("L8 A has a battery level of " + pkt.level + "%");
});

streama.on('open', function() {

	console.log("Open (a)");

	//l8a.send('VOLTAGE_QUERY');
	//l8a.send('MATRIX_OFF');
	//l8a.send('SUPERLED_SET', {b:0x00, g:0x00, r:0x00});
	var pixels = [];
	for (var i=0; i<64; i++) {
		pixels[i] = {b:(i%2), g:(i%4), r:(i%8)};
	}
	//l8a.send('MATRIX_SET', {pixels:pixels});

	setInterval(function() {
		l8a.send('VOLTAGE_QUERY');
	}, 1000);
});

var stdin = process.openStdin();
process.stdin.setRawMode(true);
process.stdin.resume();
var x = 0;
var y = 0;
var colour = {b:15,g:0,r:0};

stdin.on('data', function (key) {
	//console.log(key);

	switch (key[0]) {

		case 0x31:
			l8a.send('MATRIX_OFF');
			l8a.send('SUPERLED_SET', {bgr:{b:0x0,g:0x0,r:0x0}});
			break;

		case 0x32:
			var pixels = [];
			for (var i=0; i<64; i++) {
				pixels[i] = {b:(i%2), g:(i%4), r:(i%8)};
			}
			l8a.send('MATRIX_SET', {pixels:pixels});
			break;

		case 0x33:
			l8a.send('VOLTAGE_QUERY');
			break;

		case 0x34:
			l8a.send('MATRIX_SET', {pixels:l8_pics.mail});
			break;

		case 0x35:
			l8a.send('MATRIX_SET', {pixels:l8_pics.boxes});
			break;

		case 0x03: // ctrl-c
			console.log("Closing...");
			process.stdin.pause();
			process.exit();
			break;

		case 0x38:
			l8a.send('SUPERLED_SET', {bgr:{b:0xf,g:0x0,r:0x0}});
			break;

		case 0x39:
			l8a.send('SUPERLED_SET', {bgr:{b:0x0,g:0xf,r:0xf}});
			break;

		case 0x0d:
			colour.b = 15 - colour.b;
			colour.g = 15 - colour.g;
			l8a.send('LED_SET', {x:x, y:y, bgr:colour});
			break;

		case 0x1b:
			if (key.length == 3) {
				//l8a.send('LED_SET', {x:x, y:y, bgr:{b:0,g:0,r:0}});
				switch (key[2]) {
					case 0x41:
						x--;
						break;
					case 0x42:
						x++;
						break;
					case 0x43:
						y++;
						break;
					case 0x44:
						y--;
						break;
				}
				if (x<0) x=0;
				if (y<0) y=0;
				if (x>7) x=7;
				if (y>7) y=7;
				l8a.send('LED_SET', {x:x, y:y, bgr:colour});
			}
			break;
	}

});

