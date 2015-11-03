var EasyCab = function() {

	this.djangoRootPath = "http://46.101.17.239/data";
	this.map = null;
	this.activeMarker = null;
	this.markers = {};
	this.timeouts = {};
	this.database = {};
	this.path;
	this.activeMarkerUrl = this.djangoRootPath + "/map_marker/img/marker-template-active.png?text_size=14&text_y=8&text_colour=315aa6&text="
	this.inactiveMarkerUrl = this.djangoRootPath + "/map_marker/img/marker-template-inactive.png?text_size=14&text_y=8&text_colour=f8d360&text="
	this.client = new Paho.MQTT.Client("46.101.17.239", 10001,
		"myclientid_" + parseInt(Math.random() * 100, 10)); 
					
	this.client.onConnectionLost = function (responseObject) {
		console.log("connection lost");
		easyCab.client = new Paho.MQTT.Client("46.101.17.239", 10001,
					"myclientid_" + parseInt(Math.random() * 100, 10));
		easyCab.client.connect(this.options);
	};

	this.client.onMessageArrived = function (message) {
		var recievedmsg = message.payloadString;
		var myObj = jQuery.parseJSON(recievedmsg);
		if (myObj.disconnected) {
			easyCab.removeMarker(myObj.disconnected);
		}
		else {
			var myDate = new Date(myObj.time *1000); //convert epoch time to readible local datetime
			easyCab.addMarker(
				myObj.gps.latitude,
				myObj.gps.longitude,
				recievedmsg); //add marker based on lattitude and longittude, using timestamp for description for now
		}
	};

	this.options = {
		timeout: 3,
		onSuccess: function () {
			console.log("mqtt connected");
			easyCab.client.subscribe('position', {qos: 0});
		},
		onFailure: function (message) {
			alert("Connection failed: " + message.errorMessage);
			console.log("connection failed");
		}
	};

	$(document).ready(function() {
		easyCab.getDatabase();
		easyCab.initMap();
		easyCab.updateSize();
		$(window).resize(function() {
			easyCab.updateSize();
		});
		$.ajax({
	        url: easyCab.djangoRootPath + "/menu",
	        success: function( data ) {
	        	$('#accordion').html(data);
				easyCab.refreshAccordion();
	        }
	    });
		$(".displayFilter").change(function(event) {
			eval($(event.target).val() + "()");
		})
	});
}

EasyCab.prototype.removeMarker = function(key) {
	var marker = this.markers[key];
	if (marker) {
		if (key == this.activeMarker) {
			this.activeMarker = null;
		}
		marker.setIcon(this.inactiveMarkerUrl + this.database.taxis[key].name);
	}
	$("h3.car" + this.database.taxis[key].name).removeClass("active");
}

EasyCab.prototype.refreshAccordion = function() {

	$("#accordion").accordion();
	$("#accordion").accordion("refresh");

	$("#accordion h3.ui-state-active").click(function(event) {
		var $target = $(event.target);
		var targetId = $target.attr("data-key");
		if (this.markers[targetId]) {
			new google.maps.event.trigger(this.markers[targetId], 'click');
		}
	});

	$('.pathForm .time').timepicker({
        'timeFormat': 'H:i:s'
    });

    $('.pathForm .date').datepicker({
	    'closeText': 'schliessen',
	    'prevText': 'zurück',
	    'nextText': 'weiter',
	    'currentText': 'Heute',
	    'dateFormat': 'dd.mm.yy',
	    'monthNames': ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
	    'dayNames': ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag','Samstag'],
	    'dayNamesMin': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
        'autoclose': true,
		onClose: function(selectedDate) {
			$(this).parent().find(".time").trigger("click");
			$(".to_date").datepicker("option", "minDate", selectedDate);
			return $(".to_date").datepicker("show");
			}		    
		});

    $('.dateRow').hide();

    $('#showPath').change(function(event) {
    	var $target = $(event.target);
    	if($target.is(':checked')) {
	    	$target.parent().parent().find('.dateRow').show();
	    	var date = new Date();
	    	var dateArray = easyCab.formatDateTime($.datepicker.formatDate('yy-mm-dd', date)
	    		+ " " 
	    		+ date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()).split(" ");
	    	$target.parent().parent().find('.date').val(dateArray[0]);
	    	$target.parent().parent().find('.time').val(dateArray[1]);
    	}
    	else {
	    	$target.parent().parent().find('.dateRow').hide();
	    	if (this.path) {
	    		this.path.setMap(null);
	    	}
    	}
    });

    $('.dateRow input').change(function(event) {
    	var $target = $(event.target);
    	var $localRoot = $target.closest('div');
    	var dateArray = $localRoot.find('.start.date').val().split(".");
    	var startTime = dateArray[2]+"-"+dateArray[1]+"-"+dateArray[0];
    	startTime += " " + $localRoot.find('.start.time').val();
    	dateArray = $localRoot.find('.end.date').val().split(".");
    	var endTime = dateArray[2]+"-"+dateArray[1]+"-"+dateArray[0];
    	endTime += " " + $localRoot.find('.end.time').val();
    	var taxiId = $localRoot.attr('data-id');
    	// http://localhost:8000/path/19.10.2015%2000:00:00/20.10.2015%2001:00:00/1
		$.ajax({
	        url: this.djangoRootPath + "/path/" + startTime + "/" + endTime + "/" + taxiId,
	        success: function( data ) {
	        	if (this.path) {
	        		this.path.setMap(null);
	        	}
	        	var json = $.parseJSON(data);
				this.path = new google.maps.Polyline({
				    path: json,
				    geodesic: true,
				    strokeColor: '#f8d360',
				    strokeOpacity: 1.0,
				    strokeWeight: 2
				});
				this.path.setMap(this.map);
	        }
	    });
    });

	$("#accordion h3").each(function(index, object) {
		var $object = $(object);
		var latlng = $object.attr("data-position").split(",");
		var key = $object.attr("data-key");
		var name = $object.attr("data-name");
		if (!easyCab.markers[key]) {
			easyCab.addMarker(latlng[0], latlng[1], '{ "car": "' + key + '", "gps": { "latitude": ' + latlng[0] + ', "longitude": ' + latlng[1] + ' } }');
		}
	});
}

EasyCab.prototype.showAll = function() {
	for (var key in this.markers) {
		var $header = $("h3.car"+this.database.taxis[key].name);
		$(".car"+this.database.taxis[key].name).show();
		this.markers[key].setMap(this.map);
	}
}

EasyCab.prototype.showActive = function() {
	for (var key in this.markers) {
		var $header = $("h3.car"+this.database.taxis[key].name);
		if ($header.hasClass("active")) {
			$(".car"+this.database.taxis[key].name).show();
			this.markers[key].setMap(this.map);
		}
		else {
			$(".car"+this.database.taxis[key].name).hide();
			this.markers[key].setMap(null);
		}
	}
}

EasyCab.prototype.showInactive = function() {
	for (var key in this.markers) {
		var $header = $("h3.car"+this.database.taxis[key].name);
		if ($header.hasClass("active")) {
			$(".car"+this.database.taxis[key].name).hide();
			this.markers[key].setMap(null);

		}
		else {
			$(".car"+this.database.taxis[key].name).show();
			this.markers[key].setMap(this.map);
		}
	}
}

EasyCab.prototype.addMarker = function(lat, lng, info) {
	var data = jQuery.parseJSON(info);
	var pt = new google.maps.LatLng(lat, lng);

	if (data.car) {

		var icon = new google.maps.MarkerImage(this.activeMarkerUrl + this.database.taxis[data.car].name,
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		if (!data.time) {
			icon = new google.maps.MarkerImage(this.inactiveMarkerUrl + this.database.taxis[data.car].name,
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		}

		if (!this.markers[data.car]) {

			var marker = new google.maps.Marker({
				position: pt,
				icon: icon,
				map: this.map
			});

			if ($('.car' + this.database.taxis[data.car].name).length <= 0) {
				$.ajax({
			        url: this.djangoRootPath + "/menu/" + data.car,
			        success: function( data ) {
			            $('#accordion').append(data);
			        }
			    });			
			}

			var elem = $('#accordion').find('h3, div').sort(this.sortByTagAndClass);			


			google.maps.event.addListener(marker, "click", function() {
				var index = Math.floor(parseInt($(".car" + this.database.taxis[data.car].name).attr("id").replace("ui-id-", ""), 10) / 2);
			    $("#accordion").accordion({ active: index });
				this.map.setCenter(new google.maps.LatLng(
					parseFloat($(".car" + this.database.taxis[data.car].name + " *[data-key='gps.latitude']").html()),
					parseFloat($(".car" + this.database.taxis[data.car].name + " *[data-key='gps.longitude']").html())));
				this.map.setZoom(16);
				this.activeMarker = data.car;
			});
			this.markers[data.car] = marker;

			this.updateSize();
		}
		this.markers[data.car].setPosition(new google.maps.LatLng(data.gps.latitude, data.gps.longitude));
		this.markers[data.car].setIcon(icon);
	}

	this.fitMapToMarkers();

	if (data.time && 
		(new Date() - this.parseDateTimeString(data.time) < 60000)) {

		$(".car" + this.database.taxis[data.car].name + " *[data-key='time']").html(this.formatDateTime(data.time));
		$(".car" + this.database.taxis[data.car].name + " *[data-key='driver']").html(this.getDriverNameFromToken(data.driver));
		$(".car" + this.database.taxis[data.car].name + " *[data-key='phone']").html(this.getPhoneNumberFromMac(data.phone));
		$(".car" + this.database.taxis[data.car].name + " *[data-key='gps.latitude']").html(data.gps.latitude);
		$(".car" + this.database.taxis[data.car].name + " *[data-key='gps.longitude']").html(data.gps.longitude);
		$('h3.car' + this.database.taxis[data.car].name).addClass("active");
	}

	$("*[data-key='driver']").each(function(index, object) {
		if ($.trim($(object).html()) == "") {
			$.ajax({
		        url: this.djangoRootPath + "/drivers",
		        success: function( data ) {
		            $(object).html(data);
		            $(".driver select").change(function(event) {
		            	var oldId = $(event.target).parent().attr("data-id");
		            	var id = $(event.target).val();
		            	var driverName = event.target.options[event.target.selectedIndex].innerHTML;
		            	if (id != "" && window.confirm("Wollen Sie wirklich den Fahrer auf " + driverName + " ändern?")) {	            		
			            	var taxi = $(event.target).parent().parent().parent().parent().parent().prev().attr("data-key");
			            	$.ajax({ url: this.djangoRootPath + "/driver_change/" + taxi + "/" + id });
			            	$(event.target).parent().attr("data-id", id);
			            	$(event.target).parent().html(driverName);
		            	}
		            });
		        }
		    });
		}
	});

	if (this.timeouts[data.car]) {
		window.clearTimeout(this.timeouts[data.car]);
	}
	this.timeouts[data.car] = window.setTimeout(function() {
		easyCab.removeMarker(data.car);
	}, 15000);
	if (this.activeMarker) {
		new google.maps.event.trigger(this.markers[this.activeMarker], 'click');
	}
	this.updateSize();
	this.refreshAccordion();
};

EasyCab.prototype.sortByTagAndClass = function(a, b) {
    return (a.className < b.className || a.tagName > b.tagName);
}

EasyCab.prototype.initMap = function() {
	this.map = new google.maps.Map(document.getElementById("map"), {
		zoom: 10,
		mapTypeId: google.maps.MapTypeId.HYBRID,
		mapTypeControl: true,
		mapTypeControlOptions: {
			style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR
		},
		navigationControl: true,
		navigationControlOptions: {
			style: google.maps.NavigationControlStyle.ZOOM_PAN
		}
	});
	this.map.setCenter(new google.maps.LatLng(47.000,7.400));
	$("body").append('<a href="#" class="btn" id="resetView">Reset</a>');
	$("#resetView").click(function(event) {
		this.map.setCenter(new google.maps.LatLng(47.000,7.400));
		this.map.setZoom(10);
		this.activeMarker = null;
		event.preventDefault();
	});

	this.client.connect(this.options);
};

EasyCab.prototype.fitMapToMarkers = function() {
	var bounds = new google.maps.LatLngBounds();
	for(i in this.markers) {
		bounds.extend(this.markers[i].getPosition());
	}
	this.map.fitBounds(bounds);
}

EasyCab.prototype.updateSize = function() {
	var mapWidth = $(window).width();
	var mapHeight = $(window).height();
	if(window.innerHeight < window.innerWidth) {
		mapWidth -= $("#menu").outerWidth();
	}
	else {
		mapHeight -= $("#menu").outerHeight();
	}
	$("#map").css({
		width: mapWidth,
		height: mapHeight
	});
}

EasyCab.prototype.getDatabase = function() {
	this.database = {};
	$.ajax({
		url: this.djangoRootPath + "/json_driver"
	})
	.done(function( data ) {
		easyCab.database["drivers"] = {};
		items = $.parseJSON(data);
		for (var j = 0; j < items.length; j++) {
			for (var elem in items[j]) {
				easyCab.database["drivers"][elem] = items[j][elem];
			}
		}
	});
	$.ajax({
		url: this.djangoRootPath + "/json_phone"
	})
	.done(function( data ) {
		easyCab.database["phones"] = {};
		items = $.parseJSON(data);
		for (var j = 0; j < items.length; j++) {
			easyCab.database["phones"][items[j]['mac']] = items[j];
		}
	});
	$.ajax({
		url: this.djangoRootPath + "/json_taxi"
	})
	.done(function( data ) {
		easyCab.database["taxis"] = {};
		items = $.parseJSON(data);
		for (var j = 0; j < items.length; j++) {
			easyCab.database["taxis"][items[j]['token']] = items[j];
		}
	});
}

EasyCab.prototype.getDriverNameFromToken = function(token) {
	if (this.database && this.database.drivers && this.database.drivers[token]) {
		return this.database.drivers[token].name;
	}
	return token;
}

EasyCab.prototype.getPhoneNumberFromMac = function(mac_addr) {
	if (this.database && this.database.phones && this.database.phones[mac_addr]) {
		return this.database.phones[mac_addr].number;
	}
	return mac_addr;
}

EasyCab.prototype.formatDateTime = function(timeString) {
	var date = this.parseDateTimeString(timeString);
	return ('0' + date.getDate()).slice(-2) + '.'
		+ ('0' + (date.getMonth()+1)).slice(-2) + '.'
		+ date.getFullYear() + " "
		+ ('0' + date.getHours()).slice(-2) + ':'
		+ ('0' + date.getMinutes()).slice(-2) + ':'
		+ ('0' + date.getSeconds()).slice(-2);
}

EasyCab.prototype.parseDateTimeString = function(timeString) {
	var dateArray = timeString.split(/[\s,T,\-,\.,\:]/);
	return new Date(
		parseInt(dateArray[0], 10), 
		parseInt(dateArray[1], 10)-1, 
		parseInt(dateArray[2], 10), 
		parseInt(dateArray[3], 10), 
		parseInt(dateArray[4], 10), 
		parseInt(dateArray[5], 0)
		);
}

var easyCab = new EasyCab();