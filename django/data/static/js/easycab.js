var client = new Paho.MQTT.Client("46.101.17.239", 10001,
				"myclientid_" + parseInt(Math.random() * 100, 10));
				

client.onConnectionLost = function (responseObject) {
	console.log("connection lost");
	client = new Paho.MQTT.Client("46.101.17.239", 10001,
				"myclientid_" + parseInt(Math.random() * 100, 10));
	client.connect(options);
};

client.onMessageArrived = function (message) {
	var recievedmsg = message.payloadString;
	var myObj = jQuery.parseJSON(recievedmsg);
	if (myObj.disconnected) {
		removeMarker(myObj.disconnected);
	}
	else {
		var myDate = new Date(myObj.time *1000); //convert epoch time to readible local datetime
		addMarker(
			myObj.gps.latitude,
			myObj.gps.longitude,
			recievedmsg); //add marker based on lattitude and longittude, using timestamp for description for now
		// center = bounds.getCenter(); //center on marker, zooms in to far atm, needs to be fixed!
		// map.fitBounds(bounds);
	}
};

var options = {
	timeout: 3,
	onSuccess: function () {
		console.log("mqtt connected");
		client.subscribe('position', {qos: 0});
	},
	onFailure: function (message) {
		alert("Connection failed: " + message.errorMessage);
		console.log("connection failed");
	}
};

var djangoRootPath = "http://46.101.17.239/data";
var center = null;
var map = null;
var currentPopup;
var bounds = new google.maps.LatLngBounds();
var activeMarker = null;
var markers = {};
var timeouts = {};
var database = {};
var path;
var activeMarkerUrl = djangoRootPath + "/map_marker/img/marker-template-active.png?text_size=14&text_y=8&text_colour=315aa6&text="
var inactiveMarkerUrl = djangoRootPath + "/map_marker/img/marker-template-inactive.png?text_size=14&text_y=8&text_colour=f8d360&text="

function removeMarker(key) {
	var marker = markers[key];
	if (marker) {
		if (key == activeMarker) {
			activeMarker = null;
		}
		marker.setIcon(inactiveMarkerUrl + database.taxis[key].name);
	}
	$("h3.car" + database.taxis[key].name).removeClass("active");
}

function refreshAccordion() {

	$("#accordion").accordion();
	$("#accordion").accordion("refresh");

	$("#accordion h3.ui-state-active").click(function(event) {
		var $target = $(event.target);
		var targetId = $target.attr("data-key");
		if (markers[targetId]) {
			new google.maps.event.trigger(markers[targetId], 'click');
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
	    	var dateArray = formatDateTime($.datepicker.formatDate('yy-mm-dd', date)
	    		+ " " 
	    		+ date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()).split(" ");
	    	$target.parent().parent().find('.date').val(dateArray[0]);
	    	$target.parent().parent().find('.time').val(dateArray[1]);
    	}
    	else {
	    	$target.parent().parent().find('.dateRow').hide();
	    	if (path) {
	    		path.setMap(null);
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
	        url: djangoRootPath + "/path/" + startTime + "/" + endTime + "/" + taxiId,
	        success: function( data ) {
	        	if (path) {
	        		path.setMap(null);
	        	}
	        	var json = $.parseJSON(data);
				path = new google.maps.Polyline({
				    path: json,
				    geodesic: true,
				    strokeColor: '#f8d360',
				    strokeOpacity: 1.0,
				    strokeWeight: 2
				});
				path.setMap(map);
	        }
	    });
    });

	$("#accordion h3").each(function(index, object) {
		var $object = $(object);
		var latlng = $object.attr("data-position").split(",");
		var key = $object.attr("data-key");
		var name = $object.attr("data-name");
		if (!markers[key]) {
			addMarker(latlng[0], latlng[1], '{ "car": "' + key + '", "gps": { "latitude": ' + latlng[0] + ', "longitude": ' + latlng[1] + ' } }');
		}
	});
}

function showAll() {
	for (var key in markers) {
		var $header = $("h3.car"+database.taxis[key].name);
		$(".car"+database.taxis[key].name).show();
		markers[key].setMap(map);
	}
}

function showActive() {
	for (var key in markers) {
		var $header = $("h3.car"+database.taxis[key].name);
		if ($header.hasClass("active")) {
			$(".car"+database.taxis[key].name).show();
			markers[key].setMap(map);
		}
		else {
			$(".car"+database.taxis[key].name).hide();
			markers[key].setMap(null);
		}
	}
}

function showInactive() {
	for (var key in markers) {
		var $header = $("h3.car"+database.taxis[key].name);
		if ($header.hasClass("active")) {
			$(".car"+database.taxis[key].name).hide();
			markers[key].setMap(null);

		}
		else {
			$(".car"+database.taxis[key].name).show();
			markers[key].setMap(map);
		}
	}
}

function addMarker(lat, lng, info) {
	var data = jQuery.parseJSON(info);
	var pt = new google.maps.LatLng(lat, lng);

	if (data.car) {

		var icon = new google.maps.MarkerImage(activeMarkerUrl + database.taxis[data.car].name,
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		if (!data.time) {
			icon = new google.maps.MarkerImage(inactiveMarkerUrl + database.taxis[data.car].name,
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		}

		if (!markers[data.car]) {

			var marker = new google.maps.Marker({
				position: pt,
				icon: icon,
				map: map
			});

			if ($('.car' + database.taxis[data.car].name).length <= 0) {
				$.ajax({
			        url: djangoRootPath + "/menu/" + data.car,
			        success: function( data ) {
			            $('#accordion').append(data);
			        }
			    });			
			}

			var elem = $('#accordion').find('h3, div').sort(sortByTagAndClass);			


			google.maps.event.addListener(marker, "click", function() {
				var index = Math.floor(parseInt($(".car" + database.taxis[data.car].name).attr("id").replace("ui-id-", ""), 10) / 2);
			    $("#accordion").accordion({ active: index });
				map.setCenter(new google.maps.LatLng(
					parseFloat($(".car" + database.taxis[data.car].name + " *[data-key='gps.latitude']").html()),
					parseFloat($(".car" + database.taxis[data.car].name + " *[data-key='gps.longitude']").html())));
				map.setZoom(16);
				activeMarker = data.car;
			});
			markers[data.car] = marker;

			updateSize();
		}

		markers[data.car].setPosition(new google.maps.LatLng(data.gps.latitude, data.gps.longitude));
	}

	fitMapToMarkers();

	if (data.time && 
		(new Date() - parseDateTimeString(data.time) < 60000)) {

		$(".car" + database.taxis[data.car].name + " *[data-key='time']").html(formatDateTime(data.time));
		$(".car" + database.taxis[data.car].name + " *[data-key='driver']").html(getDriverNameFromToken(data.driver));
		$(".car" + database.taxis[data.car].name + " *[data-key='phone']").html(getPhoneNumberFromMac(data.phone));
		$(".car" + database.taxis[data.car].name + " *[data-key='gps.latitude']").html(data.gps.latitude);
		$(".car" + database.taxis[data.car].name + " *[data-key='gps.longitude']").html(data.gps.longitude);
		$('h3.car' + database.taxis[data.car].name).addClass("active");
	}

	$("*[data-key='driver']").each(function(index, object) {
		if ($.trim($(object).html()) == "") {
			$.ajax({
		        url: djangoRootPath + "/drivers",
		        success: function( data ) {
		            $(object).html(data);
		            $(".driver select").change(function(event) {
		            	var oldId = $(event.target).parent().attr("data-id");
		            	var id = $(event.target).val();
		            	var driverName = event.target.options[event.target.selectedIndex].innerHTML;
		            	if (id != "" && window.confirm("Wollen Sie wirklich den Fahrer auf " + driverName + " ändern?")) {	            		
			            	var taxi = $(event.target).parent().parent().parent().parent().parent().prev().attr("data-key");
			            	$.ajax({ url: djangoRootPath + "/driver_change/" + taxi + "/" + id });
			            	$(event.target).parent().attr("data-id", id);
			            	$(event.target).parent().html(driverName);
		            	}
		            });
		        }
		    });
		}
	});

	if (timeouts[data.car]) {
		window.clearTimeout(timeouts[data.car]);
	}
	timeouts[data.car] = window.setTimeout(function() {
		removeMarker(data.car);
	}, 15000);
	if (activeMarker) {
		new google.maps.event.trigger(markers[activeMarker], 'click');
	}
	updateSize();
	refreshAccordion();
};

function sortByTagAndClass(a, b) {
    return (a.className < b.className || a.tagName > b.tagName);
}

function initMap() {
	map = new google.maps.Map(document.getElementById("map"), {
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
	map.setCenter(new google.maps.LatLng(47.000,7.400));
	$("body").append('<a href="#" class="btn" id="resetView">Reset</a>');
	$("#resetView").click(function(event) {
		map.setCenter(new google.maps.LatLng(47.000,7.400));
		map.setZoom(10);
		activeMarker = null;
		event.preventDefault();
	});

	client.connect(options);
};

function fitMapToMarkers() {
	var bounds = new google.maps.LatLngBounds();
	for(i in markers) {
		bounds.extend(markers[i].getPosition());
	}
	map.fitBounds(bounds);
}

function updateSize() {
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

function getDatabase() {
	database = {};
	$.ajax({
		url: djangoRootPath + "/json_driver"
	})
	.done(function( data ) {
		database["drivers"] = {};
		items = $.parseJSON(data);
		for (var j = 0; j < items.length; j++) {
			for (var elem in items[j]) {
				database["drivers"][elem] = items[j][elem];
			}
		}
	});
	$.ajax({
		url: djangoRootPath + "/json_phone"
	})
	.done(function( data ) {
		database["phones"] = {};
		items = $.parseJSON(data);
		for (var j = 0; j < items.length; j++) {
			database["phones"][items[j]['mac']] = items[j];
		}
	});
	$.ajax({
		url: djangoRootPath + "/json_taxi"
	})
	.done(function( data ) {
		database["taxis"] = {};
		items = $.parseJSON(data);
		for (var j = 0; j < items.length; j++) {
			database["taxis"][items[j]['token']] = items[j];
		}
	});
}

function getDriverNameFromToken(token) {
	if (database && database.drivers && database.drivers[token]) {
		return database.drivers[token].name;
	}
	return token;
}

function getPhoneNumberFromMac(mac_addr) {
	if (database && database.phones && database.phones[mac_addr]) {
		return database.phones[mac_addr].number;
	}
	return mac_addr;
}

function formatDateTime(timeString) {
	var date = parseDateTimeString(timeString);
	return ('0' + date.getDate()).slice(-2) + '.'
		+ ('0' + (date.getMonth()+1)).slice(-2) + '.'
		+ date.getFullYear() + " "
		+ ('0' + date.getHours()).slice(-2) + ':'
		+ ('0' + date.getMinutes()).slice(-2) + ':'
		+ ('0' + date.getSeconds()).slice(-2);
}

function parseDateTimeString(timeString) {
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

$(document).ready(function() {
	getDatabase();
	initMap();
	updateSize();
	$(window).resize(function() {
		updateSize();
	});
	$.ajax({
        url: djangoRootPath + "/menu",
        success: function( data ) {
        	$('#accordion').html(data);
			refreshAccordion();
        }
    });
	$(".displayFilter").change(function(event) {
		eval($(event.target).val() + "()");
	})
});