// A handy library of images suitable for display on the L8

function bgr_from_array(a) {
	var output = [];
	for (var i in a) {
		output[i] = {
			b:parseInt(a[i].substr(0, 1),16),
			g:parseInt(a[i].substr(1, 1),16),
			r:parseInt(a[i].substr(2, 1),16),
		};
	}
	return output;
}

module.exports = {
	'boxes': bgr_from_array([
		'fff','fff','fff','fff','fff','fff','fff','fff',
		'fff','000','000','000','000','000','000','fff',
		'fff','000','f00','f00','f00','f00','000','fff',
		'fff','000','f00','000','000','f00','000','fff',
		'fff','000','f00','000','000','f00','000','fff',
		'fff','000','f00','f00','f00','f00','000','fff',
		'fff','000','000','000','000','000','000','fff',
		'fff','fff','fff','fff','fff','fff','fff','fff',
	]),
	'mail': bgr_from_array([
		'111','888','888','888','888','888','888','111',
		'00f','00f','888','888','888','888','00f','00f',
		'00f','00f','00f','888','888','00f','00f','00f',
		'00f','888','00f','00f','00f','00f','888','00f',
		'00f','888','888','00f','00f','888','888','00f',
		'00f','888','888','888','888','888','888','00f',
		'00f','888','888','888','888','888','888','00f',
		'111','111','111','111','111','111','111','111',
	]),
};
