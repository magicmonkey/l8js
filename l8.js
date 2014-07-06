var crc = require('crc');
var util = require('util');
var events = require('events');

function init(stream) {
	return new L8(stream);
}

function L8(_stream) {
	events.EventEmitter.call(this);

	var self = this;
	this.stream = _stream;
	this.stream.on('data', function(d) {
		while (d.length > 0) {
			d = self.parsePacket(d, function(pkt) {
				self.emit('packet', pkt);
				self.emit(pkt.type, pkt);
			});
		}

	});
}
L8.prototype.__proto__ = events.EventEmitter.prototype;

L8.prototype.send = function(name, params) {
	var cmdbyte = 0;
	if (typeof l8cmds[name] == 'undefined') {
		throw "Unknown L8 cmd: " + name;
	}
	//console.log("Sending "+name);
	var cmd = l8cmds[name];
	var pkt = this.createPacket(cmd, params);
	this.sendPacket(pkt);
}

L8.prototype.makePacket = function(payload) {
	var b = new Buffer(payload.length + 4);
	b[0] = 0xaa;
	b[1] = 0x55;
	b[2] = payload.length;
	payload.copy(b, 3);
	b[(b.length - 1)] = parseInt("0x"+crc.crc8(payload));
	return b;
}

L8.prototype.sendPacket = function(payload) {
	var packet = this.makePacket(payload);
	//console.log("Sending:  ", packet);
	this.stream.write(packet);
}

L8.prototype.createPacket = function(cmd, params) {
	var pkt = new Buffer(this.getPacketSize(cmd));
	pkt[0] = cmd.cmdbyte;
	var runningPlace = 1;
	for (var i in cmd.params) {
		//console.log(cmd.params);
		cmd.params[i].type.unparse(pkt, runningPlace, params[cmd.params[i].name]);
		runningPlace += cmd.params[i].type.size;
	}
	return pkt;
}

L8.prototype.getPacketSize = function(l8cmd) {
	var pktsize = 1;
	for (var i in l8cmd.params) {
		pktsize += l8cmd.params[i].type.size;
	}
	return pktsize;
}

L8.prototype.parsePacket = function(d, cb) {
	var pkt = {type:null};
	if (d[0] != 0xaa && d[1] != 0x55) {
		// Half way through a packet, not sure what to do with that
		return d;
	}
	var length = d[2];
	//console.log(' - ' + length + ',' + d.length);
	if (length > (d.length - 4)) {
		// Not a complete packet yet
		return d;
	}
	var cmdbyte = d[3];
	for (var i in l8cmds) {
		l8cmd = l8cmds[i];
		if (l8cmd.cmdbyte == cmdbyte) {
			pkt.type = i;
			//console.log("Found a " + i + " packet");
			break;
		}
	}
	if (pkt.type == null) {
		throw "Unknown packet";
	}
	var runningPlace = 4; // After the start bytes, length, and packet type
	for (var i=0; i<l8cmd.params.length; i++) {
		var f = l8cmd.params[i];
		pkt[f.name] = f.type.parse(d, runningPlace);
		runningPlace += f.type.size;
	}

	// TODO: Check the checksum
	runningPlace += 1;

	cb(pkt);
	return d.slice(runningPlace);
}

type = {
	uint8: {
		size: 1,
		parse: function(b, start) {
			return b.readUInt8(start);
		},
		unparse: function(b, start, p) {
			return b.writeUInt8(p, start);
		}
	},
	uint16_be: {
		size: 2,
		parse: function(b, start) {
			return b.readUInt16BE(start);
		},
		unparse: function(b, start, p) {
			return b.writeUInt16BE(p, start);
		}
	},
	temperature: {
		size: 2,
		parse: function(b, start) {
			return parseInt(b.readUInt16BE(start)) / 10;
		},
		unparse: function(b, start, p) {
			return b.writeUInt16BE(p*10, start);
		}
	},
	uid: {
		size: 12,
		parse: function(b, start) {
			var size = 12;
			return b.slice(start, start+size);
		},
		unparse: function(b, start, p) {
			var b2 = new Buffer(p);
			return b2.copy(b, start, 0, 12);
		}
	},
	bgr: {
		size: 3,
		parse: function(b, start) {
			return {
				b:b.readUInt8(start),
				g:b.readUInt8(start+1),
				r:b.readUInt8(start+2)
			};
		},
		unparse: function(b, start, params) {
			b.writeUInt8(params.b, start);
			b.writeUInt8(params.g, start + 1);
			b.writeUInt8(params.r, start + 2);
		}
	},
	pixels: {
		size: 128,
		parse: function(b, start) {
			return 0;
		},
		unparse: function(b, start, params) {
			if (params.length != 64) {
				throw "Should be 64 pixels specified";
			}
			for (var i=0; i<64; i++) {
				b.writeUInt8(params[i].b, start + (2*i));
				b.writeUInt8(params[i].g << 4 | params[i].r, start + (2*i) + 1);
			}
		}
	},
	version_maj_min_micro: {
		size: 3,
		parse: function(b, start) {
			var major = b.readUInt8(start);
			var minor = b.readUInt8(start + 1);
			var micro = b.readUInt8(start + 2);
			return major + "." + minor + "." + micro;
		},
		unparse: function(b, start, params) {
		}
	},
	version_maj_min: {
		size: 2,
		parse: function(b, start) {
			var major = b.readUInt8(start);
			var minor = b.readUInt8(start + 1);
			return major + "." + minor;
		},
		unparse: function(b, start, params) {
		}
	},
	packetType: {
		size: 1,
		parse: function(b, start) {
			var name = "";
			var found = false;
			var cmdbyte = parseInt(b.readUInt8(start));

			for (var i in l8cmds) {
				if (l8cmds[i].cmdbyte == cmdbyte) {
					name = i;
					found = true;
					break;
				}
			}
			if (!found) {
				throw "Unknown acknowledgement ID: " + cmdbyte;
			}
			return name;
		},
		unparse: function(b, start, p) {
		}
	},
};

l8cmds = {
	'ERR':{
		cmdbyte: 0xff,
		params:[
			{name:'ID', type:type.packetType}
		]
	},
	'OK':{
		cmdbyte: 0x00,
		params:[
			{name:'ID', type:type.packetType}
		]
	},
	'PING':{
		cmdbyte: 0x01,
		params:[]
	},
	'PONG':{
		cmdbyte: 0x02,
		params:[]
	},
	'LED_SET':{
		cmdbyte: 0x43,
		params:[
			{name:'x', type:type.uint8},
			{name:'y', type:type.uint8},
			{name:'BGR', type:type.bgr}
		]
	},
	'MATRIX_SET':{
		cmdbyte: 0x44,
		params:[
			{name:'pixels', type:type.pixels}
		]
	},
	'MATRIX_OFF':{
		cmdbyte: 0x45,
		params:[]
	},
	'VOLTAGE_QUERY':{
		cmdbyte: 0x46,
		params:[]
	},
	'VOLTAGE_RESPONSE':{
		cmdbyte: 0x47,
		params: [
			{name:"voltage", type: type.uint16_be},
			{name:"level",   type: type.uint8}
		]
	},
	'TEMP_QUERY':{
		cmdbyte: 0x48,
		params:[]
	},
	'TEMP_RESPONSE':{
		cmdbyte: 0x49,
		params: [
			{name:"temperature", type:type.temperature}
		]
	},
	/*
	'BOOTLOADER':{
		cmdbyte: 0x4A,
		params:[]
	},
	*/
	'SUPERLED_SET':{
		cmdbyte: 0x4B,
		params:[
			{name:"bgr", type:type.bgr}
		]
	},
	'ACC_QUERY':{
		cmdbyte: 0x4C,
		params:[]
	},
	'ACC_RESPONSE':{
		cmdbyte: 0x4D,
		params:[
			{name:"x"          , type: type.uint8},
			{name:"y"          , type: type.uint8},
			{name:"z"          , type: type.uint8},
			{name:"lying"      , type: type.uint8},
			{name:"orientation", type: type.uint8},
			{name:"tap"        , type: type.uint8},
			{name:"shake"      , type: type.uint8}
		]
	},
	'UID_QUERY':{
		cmdbyte: 0x4E,
		params:[]
	},
	'UID_RESPONSE':{
		cmdbyte: 0x4F,
		params:[
			{name:"uid", type: type.uid}
		]
	},
	'AMBIENT_QUERY':{
		cmdbyte: 0x50,
		params:[]
	},
	'AMBIENT_RESPONSE':{
		cmdbyte: 0x51,
		params:[
			{name:"value",        type: type.uint16_be},
			{name:"pct",          type: type.uint8},
			{name:"notification", type: type.uint8},
		]
	},
	'PROX_QUERY':{
		cmdbyte: 0x52,
		params:[]
	},
	'PROX_RESPONSE':{
		cmdbyte: 0x53,
		params:[
			{name:"value",        type: type.uint16_be},
			{name:"pct",          type: type.uint8},
			{name:"notification", type: type.uint8},
		]
	},
	'VERSIONS_QUERY':{
		cmdbyte: 0x60,
		params:[]
	},
	'VERSIONS_RESPONSE':{
		cmdbyte: 0x61,
		params:[
			{name:"firmware",   type: type.version_maj_min_micro},
			{name:"hardware",   type: type.version_maj_min},
			{name:"bootloader", type: type.version_maj_min},
			{name:"usermemory", type: type.version_maj_min},
		]
	},
	'BUTTON_QUERY':{
		cmdbyte: 0x62,
		params:[]
	},
	'BUTTON_RESPONSE':{
		cmdbyte: 0x63,
		params:[
			{name:"pressed", type: type.uint8},
		]
	},
	'MIC_QUERY':{
		cmdbyte: 0x64,
		params:[]
	},
	'MIC_RESPONSE':{
		cmdbyte: 0x65,
		params:[
			{name:"value", type: type.uint16_be},
		]
	},
	'VBUS_QUERY':{
		cmdbyte: 0x66,
		params:[]
	},
	'VBUS_RESPONSE':{
		cmdbyte: 0x67,
		params:[
			{name:"value", type: type.uint16_be},
		]
	},
	'MCUTEMP_QUERY':{
		cmdbyte: 0x68,
		params:[]
	},
	'MCUTEMP_RESPONSE':{
		cmdbyte: 0x69,
		params:[
			{name:"temperature", type: type.uint16_be},
		]
	},
	'STORE_L8Y':{
		cmdbyte: 0x6A,
		params:[
			{name:"pixels", type: type.pixels},
		]
	},
	'STORE_L8Y_RESPONSE':{
		cmdbyte: 0x6B,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'READ_L8Y':{
		cmdbyte: 0x6C,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'READ_L8Y_RESPONSE':{
		cmdbyte: 0x6D,
		params:[
			{name:"pixels", type: type.pixels},
		]
	},
	'SET_STORED_L8Y':{
		cmdbyte: 0x6E,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'DELETE_L8Y':{
		cmdbyte: 0x6F,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'STORE_FRAME':{
		cmdbyte: 0x70,
		params:[
			{name:"pixels", type: type.pixels},
		]
	},
	'STORE_FRAME_RESPONSE':{
		cmdbyte: 0x71,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'READ_FRAME':{
		cmdbyte: 0x72,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'READ_FRAME_RESPONSE':{
		cmdbyte: 0x73,
		params:[
			{name:"pixels", type: type.pixels},
		]
	},
	'DELETE_FRAME':{
		cmdbyte: 0x74,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'BATCHG_QUERY':{
		cmdbyte: 0x75,
		params:[]
	},
	'BATCHG_RESPONSE':{
		cmdbyte: 0x76,
		params:[
			{name:"status", type: type.uint8},
		]
	},
	/*
	'STORE_ANIM':{
		cmdbyte: 0x77,
		params:[]
	},
	'STORE_ANIM_RESPONSE':{
		cmdbyte: 0x78,
		params:[]
	},
	'READ_ANIM':{
		cmdbyte: 0x79,
		params:[]
	},
	'READ_ANIM_RESPONSE':{
		cmdbyte: 0x7A,
		params:[]
	},
	'DELETE_ANIM':{
		cmdbyte: 0x7B,
		params:[]
	},
	*/
	'PLAY_ANIM':{
		cmdbyte: 0x7C,
		params:[
			{name:"index", type: type.uint8},
			{name:"loop",  type: type.uint8},
		]
	},
	'STOP_ANIM':{
		cmdbyte: 0x7D,
		params:[]
	},
	'DELETE_USER_MEMORY':{
		cmdbyte: 0x7E,
		params:[]
	},
	'DISP_CHAR':{
		cmdbyte: 0x7F,
		params:[
			{name:"char",  type: type.uint8},
			{name:"shift", type: type.uint8},
		]
	},
	'SET_ORIENTATION':{
		cmdbyte: 0x80,
		params:[
			{name:"orientation",  type: type.uint8},
		]
	},
	/*
	'APP_RUN':{
		cmdbyte: 0x81,
		params:[]
	},
	'APP_STOP':{
		cmdbyte: 0x82,
		params:[]
	},
	'SET_TEXT':{
		cmdbyte: 0x83,
		params:[]
	},
	*/
	'TRACE_MSG':{
		cmdbyte: 0x84,
		params:[
			{name:"type",  type: type.uint8},
			{name:"code",  type: type.uint8},
		]
	},
	'INIT_STATUS_QUERY':{
		cmdbyte: 0x85,
		params:[]
	},
	'SET_AUTOROTATE':{
		cmdbyte: 0x86,
		params:[
			{name:"enabled",  type: type.uint8},
		]
	},
	'ORIENTATION_QUERY':{
		cmdbyte: 0x8A,
		params:[]
	},
	'ORIENTATION_RESPONSE':{
		cmdbyte: 0x8B,
		params:[
			{name:"orientation", type: type.uint8},
		]
	},
	'NUML8IES_QUERY':{
		cmdbyte: 0x8C,
		params:[]
	},
	'NUML8IES_RESPONSE':{
		cmdbyte: 0x8D,
		params:[
			{name:"num", type: type.uint8},
		]
	},
	'NUMANIMS_QUERY':{
		cmdbyte: 0x8E,
		params:[]
	},
	'NUMANIMS_RESPONSE':{
		cmdbyte: 0x8F,
		params:[
			{name:"num", type: type.uint8},
		]
	},
	'NUMFRAMES_QUERY':{
		cmdbyte: 0x90,
		params:[]
	},
	'NUMFRAMES_RESPONSE':{
		cmdbyte: 0x91,
		params:[
			{name:"num", type: type.uint8},
		]
	},
	/*
	'NOTIFAPP_STORE':{
		cmdbyte: 0x92,
		params:[]
	},
	'NOTIFAPP_QUERY':{
		cmdbyte: 0x93,
		params:[]
	},
	'NOTIFAPP_RESPONSE':{
		cmdbyte: 0x94,
		params:[]
	},
	*/
	'NOTIFAPPS_NUM_QUERY':{
		cmdbyte: 0x95,
		params:[]
	},
	'NOTIFAPPS_NUM_RESPONSE':{
		cmdbyte: 0x96,
		params:[
			{name:"num", type: type.uint8},
		]
	},
	'NOTIFAPP_ENABLE':{
		cmdbyte: 0x97,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	'NOTIFAPP_DELETE':{
		cmdbyte: 0x98,
		params:[
			{name:"index", type: type.uint8},
		]
	},
	/*
	'SET_NOTIFICATION':{
		cmdbyte: 0x99,
		params:[]
	},
	'SET_LOW_BRIGHTNESS':{
		cmdbyte: 0x9A,
		params:[]
	},
	*/
	'FRAMEGRAB_QUERY':{
		cmdbyte: 0x9B,
		params:[]
	},
	'FRAMEGRAB_RESPONSE':{
		cmdbyte: 0x9C,
		params:[
			{name:'pixels', type:type.pixels}
		]
	},
	'POWEROFF':{
		cmdbyte: 0x9D,
		params:[]
	},
	'STATUSLEDS_ENABLE':{
		cmdbyte: 0x9E,
		params:[
			{name:'enabled', type:type.uint8}
		]
	},
	'NOISE_THRESHOLDS_SET':{
		cmdbyte: 0x9F,
		params:[
			{name:'minimum', type:type.uint16_be},
			{name:'maximum', type:type.uint16_be}
		]
	},
	'PROX_THRESHOLDS_SET':{
		cmdbyte: 0xA0,
		params:[
			{name:'minimum', type:type.uint16_be},
			{name:'maximum', type:type.uint16_be}
		]
	},
	'AMB_THRESHOLDS_SET':{
		cmdbyte: 0xA1,
		params:[
			{name:'minimum', type:type.uint16_be},
			{name:'maximum', type:type.uint16_be}
		]
	},
	'SENSORS_THRESHOLDS_QUERY':{
		cmdbyte: 0xA2,
		params:[]
	},
	'SENSORS_THRESHOLDS_RESPONSE':{
		cmdbyte: 0xA3,
		params:[
			{name:'noise_minimum'  , type:type.uint16_be},
			{name:'noise_maximum'  , type:type.uint16_be},
			{name:'prox_minimum'   , type:type.uint16_be},
			{name:'prox_maximum'   , type:type.uint16_be},
			{name:'ambient_minimum', type:type.uint16_be},
			{name:'ambient_maximum', type:type.uint16_be},
		]
	},
	'NOTIFAPPS_ENABLE_ALL':{
		cmdbyte: 0xA4,
		params:[
			{name:'enabled', type:type.uint8},
		]
	},
	'NOTIFAPPS_SILENCE':{
		cmdbyte: 0xA5,
		params:[
			{name:'silenced', type:type.uint8},
		]
	},
	'NOTIFAPPS_SILENCE_QUERY':{
		cmdbyte: 0xA6,
		params:[]
	},
	'NOTIFAPPS_SILENCE_RESPONSE':{
		cmdbyte: 0xA7,
		params:[
			{name:'silenced', type:type.uint8},
		]
	},
};

module.exports = {
	init:init,
};
