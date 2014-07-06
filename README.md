l8js
====

A NodeJS library for talking to an L8 Smartlight

I use Ubuntu, and find that I have to have this in /etc/bluetooth/rfcomm.conf:

```
rfcomm0 {
	# Automatically bind the device at startup
	bind no;

	# Bluetooth address of the device
	device 00:17:EC:4C:60:9D;

	# RFCOMM channel for the connection
	channel	1;

	# Description of the connection
	comment "L8 serial port";
}
```

and then run this to open the serial port:

```
sudo rfcomm connect 0
```

and then I can run this:

```
node cli
```

