/*!
 * easycab.js v1.0
 * Class to display and edit information of the EasyCab Application
 * on Google Maps.
 */

 var EasyCab = function() {
 	this.windowTopOffset = 0;
	this.activeMarker = null;
	this.markers = {};
	this.goalMarker = {};
	this.timeouts = {};
	this.database = {};
	this.path;
	// Define base-URLs for marker-icons
	var markerParameters = "?text_size=46" +
						"&text_y=19";
	this.pathMarkerUrl = EasyCabUtil.djangoRootPath + "/map_marker/img/marker-template-path-large.png" + markerParameters + "&text_colour=315aa6&text="
	this.activeMarkerUrl = EasyCabUtil.djangoRootPath + "/map_marker/img/marker-template-active-large.png" + markerParameters + "&text_colour=315aa6&text="
	this.inactiveMarkerUrl = EasyCabUtil.djangoRootPath + "/map_marker/img/marker-template-inactive-large.png" + markerParameters + "&text_colour=f8d360&text="
	// Define map property and initialize map helper classes
	this.map = null;
	this.directionsService = new google.maps.DirectionsService();
	this.directionsDisplay = new google.maps.DirectionsRenderer({ 
		suppressMarkers: true,
		suppressInfoWindows: true,
		polylineOptions: {
			strokeColor: '#f8d360',
			strokeWeight: 5
		}
	});
	// Define MQTT options and initialize MQTT client
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
	this.initMqttClient();

	this.client.onConnectionLost = function (responseObject) {
		easyCab.initMqttClient();
	};

	this.client.onMessageArrived = function (message) {
		var recievedmsg = easyCab.decrypt(message.payloadString);
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

	$(document).ready(function() {
		easyCab.getDatabase();
		easyCab.initMap();
		easyCab.updateSize();
		easyCab.initMenu();
		$(window).resize(function() {
			easyCab.updateSize();
		});
		$(document).scroll(function() {
			var distance = $(document).scrollTop()-easyCab.windowTopOffset;
			easyCab.windowTopOffset = $(document).scrollTop();
			$("#map").css({
				"top": (parseInt($("#map").css("top"), 10)+distance)+"px"
			});
			$("#routeWindow").css({
				"top": (parseInt($("#routeWindow").css("top"), 10)+distance)+"px"
			});
		});
	});
}

/**
 * Initializes MQTT client
 */
EasyCab.prototype.initMqttClient = function() {
	this.client = new Paho.MQTT.Client(EasyCabUtil.mqttUrl, EasyCabUtil.mqttPort,
		"myclientid_" + parseInt(Math.random() * 100, 10)); 
	this.client.connect(this.options);
}

/**
 * Initializes menu with Taxi entries
 */
EasyCab.prototype.initMenu = function() {
	$.ajax({
        url: EasyCabUtil.djangoRootPath + "/menu",
        success: function( data ) {
        	// Add and initialize accordion
        	$('#accordion').html(data);
        	$('#accordion').accordion({
        		collapsible: true,
        		active: false,

        	});
        	// Add map markers for all accordion entries
			$('#accordion h3').each(function(index, object) {
				var $object = $(object);
				var latlng = $object.attr("data-position").split(",");
				var key = $object.attr("data-key");
				var name = $object.attr("data-name");
				if (!easyCab.markers[key]) {
					easyCab.addMarker(latlng[0], latlng[1], '{ "car": "' + key + '", "gps": { "latitude": ' + latlng[0] + ', "longitude": ' + latlng[1] + ' } }');
				}
			});
			$("#accordion").accordion("refresh");
			// $("#accordion").find("h3").first().click(); // Open first accordion entry on start.
        }
    });
	$(".displayFilter").change(function(event) {
		easyCab.filterView($(event.target).val());
	});
	$(".displayFilter").click(function(event) {
		easyCab.filterView($(event.target).val());
	});
}

/**
 * Hides path on map
 */
EasyCab.prototype.hidePath = function() {
	$('.dateRow').hide();
	if (this.path) {
		this.path.setMap(null);
	}
}

/**
 * Removes marker from map
 * @param {String} key Key of the marker in markers object
 */
EasyCab.prototype.removeMarker = function(key) {
	var marker = this.markers[key];
	if (marker) {
		if (key == this.activeMarker) {
			this.activeMarker = null;
		}
		marker.setIcon(this.inactiveMarkerUrl + this.database.taxis[key]);
	}
	$("h3.car" + this.database.taxis[key]).removeClass("active");
}

/**
 * Refreshes accordion after changes on markup
 * @param {String} parentSelector CSS selector of the accordion container
 */
EasyCab.prototype.refreshAccordion = function(parentSelector) {
	if (parentSelector && (parentSelector != "")) {
		parentSelector += " ";
	}

    EasyCabUtil.initDateTimePicker(parentSelector);

    $(parentSelector + '.dateRow').hide();

    $(parentSelector + '.showPath').change(function(event) {
    	var $target = $(event.target);
    	if($target.is(':checked')) {
	    	$target.parent().parent().find('.dateRow').show();
	    	var date = new Date();
	    	var dateArray = EasyCabUtil.formatDateTime($.datepicker.formatDate('yy-mm-dd', date)
	    		+ " " 
	    		+ date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()).split(" ");
	    	$target.parent().parent().find('.date').val(dateArray[0]);
	    	$target.parent().parent().find('.time').val(dateArray[1]);
    	}
    	else {
    		easyCab.hidePath();
    	}
		$("#accordion").accordion("refresh");
    });

    $(parentSelector + '.dateRow input').change(function(event) {
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
	        url: EasyCabUtil.djangoRootPath + "/path/" + startTime + "/" + endTime + "/" + taxiId,
	        success: function( data ) {
	        	if (easyCab.path) {
	        		easyCab.path.setMap(null);
	        	}
	        	var json = $.parseJSON(data);
				easyCab.path = new google.maps.Polyline({
				    path: json,
				    geodesic: true,
				    strokeColor: '#f8d360',
				    strokeOpacity: 1.0,
				    strokeWeight: 5
				});
				easyCab.path.setMap(easyCab.map);
	        }
	    });
    });

	// MouseDown event for accordion headers (Click event is triggered too late, so MouseDown is required)
	$("#accordion h3" + parentSelector).mousedown(function(event) {
		var $target = $(event.target);
		var targetId = $target.attr("data-key");
		var targetName = $target.attr("data-name");
		var $checkbox = $('div[data-key="' + easyCab.activeMarker + '"] input[type="checkbox"]')
		if ($checkbox.is(':checked')) {
			$checkbox.trigger("click");
		}
		var $container = $target.next();
		if ($target.hasClass("ui-accordion-header-active")) {
			// accordion item is active and will close, reset map and active marker
			easyCab.activeMarker = null;
			var $activeContainer = $container;
			easyCab.fitMapToMarkers();
		}
		else {
			// accordion item is not active and will open, trigger click on related marker
			if (easyCab.markers[targetId]) {
				var index = Math.floor(parseInt($(".car" + targetName).attr("id").replace("ui-id-", ""), 10) / 2);
				easyCab.map.setCenter(new google.maps.LatLng(
					parseFloat($(".car" + targetName + " *[data-key='gps.latitude']").html()),
					parseFloat($(".car" + targetName + " *[data-key='gps.longitude']").html())));
				easyCab.map.setZoom(16);
				easyCab.activeMarker = targetId;
			}
		}
	});

	// Click event on link to draw route from taxi to a destination place
	$(parentSelector + ".showRoute a").click(function(event) {
		var $target = $(event.target);
		var $container = $target.parents(".ui-accordion-content");
		var start = new google.maps.LatLng(
			parseFloat($container.find('span[data-key="gps.latitude"]').text()),
			parseFloat($container.find('span[data-key="gps.longitude"]').text())
		);
		// If no destination point is found, try using the start point as destination
		var end = $("#endPoint").val();
		if (end == "") {
			end = $("#startPoint").val();
		}
		if (start && end != "") {
			easyCab.drawRoute(start, end, $container.attr("data-name"));
		}
	});
}


/**
 * Filters the map overview to display all, active or inactive taxis
 * @param {float} value filter value, either "showAll", "showActive" or "showInactive"
 */
EasyCab.prototype.filterView = function(value) {
    $(".ui-accordion-header-active").trigger('click');
	switch (value) {
		case "showAll":
			for (var key in this.markers) {
				var $header = $("h3.car"+this.database.taxis[key]);
				$(".car"+this.database.taxis[key]).show();
				this.markers[key].setMap(this.map);
			}
			$("#accordion").accordion({
		        collapsible: true,
		        active: false
		    });
			break;
		case "showActive":
			for (var key in this.markers) {
				var $header = $("h3.car"+this.database.taxis[key]);
				if ($header.hasClass("active")) {
					$(".car"+this.database.taxis[key]).show();
					this.markers[key].setMap(this.map);
				}
				else {
					$(".car"+this.database.taxis[key]).hide();
					this.markers[key].setMap(null);
				}
			}
			break;
		case "showInactive":
			for (var key in this.markers) {
				var $header = $("h3.car"+this.database.taxis[key]);
				if ($header.hasClass("active")) {
					$(".car"+this.database.taxis[key]).hide();
					this.markers[key].setMap(null);
				}
				else {
					$(".car"+this.database.taxis[key]).show();
					this.markers[key].setMap(this.map);
				}
			}
			break;
	}
	this.activeMarker = null;
    this.fitMapToMarkers();
	$("#accordion").accordion("refresh");
	$("#accordion").find("h3:visible").first().click();
}

/**
 * Adds a new marker to markers object (if not exists already) and displays it on map
 * @param {float} lat Latitude
 * @param {float} lng Longitude
 * @param {string} info Additional data JSON string
 */
EasyCab.prototype.addMarker = function(lat, lng, info) {
	var data = jQuery.parseJSON(info);
	var pt = new google.maps.LatLng(lat, lng);

	if (data.car && this.database.taxis && this.database.taxis[data.car]) {

		var icon = new google.maps.MarkerImage(this.activeMarkerUrl + this.database.taxis[data.car],
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		if (!data.time || (new Date()-EasyCabUtil.parseDateTimeString(data.time) > EasyCabUtil.config.session_timeout*1000)) {
			icon = new google.maps.MarkerImage(this.inactiveMarkerUrl + this.database.taxis[data.car],
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		}

		if (!this.markers[data.car]) {

			var marker = new google.maps.Marker({
				position: pt,
				icon: icon,
				map: this.map
			});

			if ($('.car' + this.database.taxis[data.car]).length <= 0) {
				$.ajax({
			        url: EasyCabUtil.djangoRootPath + "/menu/" + data.car,
			        success: function( data ) {
			            $('#accordion').append(data);
			            easyCab.refreshAccordion();
			        }
			    });			
			}

			var elem = $('#accordion').find('h3, div').sort(this.sortByTagAndClass);			

			google.maps.event.addListener(marker, "click", function() {
				var $checkbox = $('div[data-key="' + easyCab.activeMarker + '"] input[type="checkbox"]')
				if ($checkbox.is(':checked')) {
					$checkbox.trigger("click");
				}
				var index = Math.floor(parseInt($(".car" + easyCab.database.taxis[data.car]).attr("id").replace("ui-id-", ""), 10) / 2);
				easyCab.map.setCenter(new google.maps.LatLng(
					parseFloat($(".car" + easyCab.database.taxis[data.car] + " *[data-key='gps.latitude']").html()),
					parseFloat($(".car" + easyCab.database.taxis[data.car] + " *[data-key='gps.longitude']").html())));
				easyCab.map.setZoom(16);
				easyCab.activeMarker = data.car;
				$("#accordion").accordion('option', 'active', index);
			});
			this.markers[data.car] = marker;

			this.updateSize();
			this.refreshAccordion(".car" + this.database.taxis[data.car]);

		}
		this.markers[data.car].setPosition(new google.maps.LatLng(data.gps.latitude, data.gps.longitude));
		this.markers[data.car].setIcon(icon);
	}

	if (data.time && 
		(new Date() - EasyCabUtil.parseDateTimeString(data.time) < 60000)) {

		$(".car" + this.database.taxis[data.car] + " *[data-key='time']").html(EasyCabUtil.formatDateTime(data.time));
		$(".car" + this.database.taxis[data.car] + " *[data-key='driver']").html(this.getDriverNameFromToken(data.driver));
		$(".car" + this.database.taxis[data.car] + " *[data-key='phone']").html(this.getPhoneNumberFromMac(data.phone));
		$(".car" + this.database.taxis[data.car] + " *[data-key='gps.latitude']").html(data.gps.latitude);
		$(".car" + this.database.taxis[data.car] + " *[data-key='gps.longitude']").html(data.gps.longitude);
		$('h3.car' + this.database.taxis[data.car]).addClass("active");
	}

	$("*[data-key='driver']").each(function(index, object) {
		if ($.trim($(object).html()) == "") {
			$.ajax({
		        url: EasyCabUtil.djangoRootPath + "/drivers",
		        success: function( data ) {
		            $(object).html(data);
		            $(".driver select").change(function(event) {
		            	var oldId = $(event.target).parent().attr("data-id");
		            	var id = $(event.target).val();
		            	var driverName = event.target.options[event.target.selectedIndex].innerHTML;
		            	if (id != "") {	            		
			            	var taxi = $(event.target).parent().parent().parent().parent().parent().prev().attr("data-key");
			            	$.ajax({ url: EasyCabUtil.djangoRootPath + "/driver_change/" + taxi + "/" + id });
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
	}, EasyCabUtil.config.session_timeout*1000);
	if (this.activeMarker && (this.activeMarker == data.car)) {
		new google.maps.event.trigger(this.markers[this.activeMarker], 'click');
	}
	this.updateSize();
};

/**
 * Places all markers on map
 */
EasyCab.prototype.placeMarkers = function() {
	for (var marker in this.markers) {
		this.markers[marker].setMap(this.map);
	}
}

/**
 * Sorting function to sort items by class (1) and tag-name (2) for accordion-menu
 */
EasyCab.prototype.sortByTagAndClass = function(a, b) {
    return (a.className < b.className || a.tagName > b.tagName);
}

/**
 * Initializes map
 */
EasyCab.prototype.initMap = function() {
	var mapOptions = {
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
	};
	this.map = new google.maps.Map(document.getElementById("map"), mapOptions);
	this.map.setCenter(new google.maps.LatLng(47.000,7.400));
	this.directionsDisplay.setPanel($("#routeDisplay")[0]);
	this.directionsDisplay.setMap(this.map);					

	var options = {
		markerOptions: {
			draggable: true
		}
	};

	$('#routeWindowHeader .btnClose').click(function(event) {
		$("#routeWindow").hide();
		if (easyCab.markers["startPoint"]) {
			easyCab.markers["startPoint"].setMap(null);
			delete(easyCab.markers["startPoint"]);
		}
		if (easyCab.markers["endPoint"]) {
			easyCab.markers["endPoint"].setMap(null);
			delete(easyCab.markers["endPoint"]);		} 		
		if (easyCab.directionsDisplay) easyCab.directionsDisplay.setMap(null);
		$(".placeSearch").val("");
		easyCab.fitMapToMarkers();
	});

	// if user presses enter (confirms location), show links from taxi to destination
	$('.placeSearch').keyup(function(event) {
		var $target = $(event.target);
		if (event.keyCode == 13) {
			var value = $target.val();
			if (value != "") {
				if ($target.attr('id') == 'endPoint') $('.showRoute').show();
				$target.attr("data-fixedgoal", "true");
			}
			else {
				if ($target.attr('id') == 'endPoint') $('.showRoute').hide();
				$target.attr("data-fixedgoal", "false");
			}
			$("#accordion").accordion("refresh");
		}
		else if ($target.attr("data-oldvalue") != $target.val()) {
			$target.attr("data-fixedgoal", "false");
		}
		console.log($target.attr("data-oldvalue") + " > " + $target.val());
		$target.attr("data-oldvalue", $target.val());
	});

	$('.placeSearch').blur(function(event) {
		var $target = $(event.target);
		if ($target.attr("data-fixedgoal") != "true") {
			$target.val('');
			if ($target.attr('id') == 'endPoint') $('.showRoute').hide();
		}
		$("#accordion").accordion("refresh");
	});

	$('.placeSearch').geocomplete(options).bind("geocode:result", function(event, result){
		var $target = $(event.target);
		var name = "";
		switch ($target.attr("id")) {
			case "startPoint":
				name = "Start";
				break;
			case "endPoint":
				name = "Ziel";
				break;
		}
		var icon = new google.maps.MarkerImage(easyCab.pathMarkerUrl + name,
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		if (easyCab.markers[$target.attr("id")]) {
			easyCab.markers[$target.attr("id")].setMap(null);
		}
		var marker = new google.maps.Marker({
			position: result.geometry.location,
			icon: icon,
			map: easyCab.map
		});
		google.maps.event.addListener(marker, "click", function() {
			easyCab.map.setCenter(result.geometry.location);
			easyCab.map.setZoom(16);
		});
		marker.setMap(easyCab.map);
		easyCab.markers[$target.attr("id")] = marker;
		// Draw path between start and goal if both are set
		var start = $("#startPoint").val();
		var end = $("#endPoint").val();
		if (start != "" && end != "") {
			easyCab.drawRoute(start, end);
		}
		easyCab.fitMapToMarkers();
		$target.attr("data-fixedgoal", "true");
	});
}

/**
 * Draws a route on map
 * @param {String} start Start-position location string
 * @param {String} end End-position location string
 * @param {String} taxi Taxi name (optional to set current location of taxi as start-location) 
 */
EasyCab.prototype.drawRoute = function(start, end, taxi) {
	var request = {
		origin:start,
		destination:end,
		provideRouteAlternatives: true,
		travelMode: google.maps.TravelMode.DRIVING,

	};
	easyCab.directionsService.route(request, function(result, status) {
		if (status == google.maps.DirectionsStatus.OK) {
			easyCab.directionsDisplay.setDirections(result);
			$routeWindow = $("#routeWindow");
			$('#routeWindowHeader .start').text(taxi ? taxi : start.substring(0, start.indexOf(',')));
			$('#routeWindowHeader .end').text(end.substring(0, end.indexOf(',')));
			$routeWindow.show();
			$routeWindow.on('mousemove',function(){ // Update containment each time it's dragged
			    $(this).draggable({
			        greedy: true, 
			        handle: '#routeWindowHeader',

			        containment: // Set containment to current viewport
			        [$(document).scrollLeft(),
			        $(document).scrollTop(),
			        $(document).scrollLeft()+$(window).width()-$(this).outerWidth(),
			        $(document).scrollTop()+$(window).height()-$(this).outerHeight()]
			    }).resizable({
			    	handles: 'se'
			    });
			})
			easyCab.directionsDisplay.setMap(easyCab.map);
			easyCab.fitMapToMarkers();
		}
	});
}

/**
 * Positions and zooms map to fit to all visible markers
 */
EasyCab.prototype.fitMapToMarkers = function() {
	var bounds = new google.maps.LatLngBounds();
	for(i in this.markers) {
		bounds.extend(this.markers[i].getPosition());
	}
	this.map.fitBounds(bounds);
}

/**
 * Repositions and scales elements when window is resized
 */
EasyCab.prototype.updateSize = function() {
	var mapWidth = $(window).width();
	var mapHeight = $(window).height();
	var mapPosY = 0;
	if(mapHeight < mapWidth) {
		mapWidth -= $("#menu").outerWidth();
	}
	else {
		mapHeight = mapWidth;
		mapPosY = $("#menu").outerHeight();
	}
	if (easyCab.activeMarker) {
		new google.maps.event.trigger(this.markers[this.activeMarker], 'click');
	}
	else {
		easyCab.fitMapToMarkers();
	}
	$("#map").css({
		top: mapPosY,
		width: mapWidth,
		height: mapHeight
	});
}

/**
 * Loads taxis, drivers and phones from database to be used as a JavaScript-object
 */
EasyCab.prototype.getDatabase = function() {
	this.database = {};
	$.ajax({
		url: EasyCabUtil.djangoRootPath + "/json_data"
	})
	.done(function( data ) {
		easyCab.database = $.parseJSON(data);
	})
	.error(function( data ) {
		easyCab.getDatabase();
	});
}

/**
 * Loads a driver object by NFC-token UUID
 * @param {String} token NFC-token UUID of the driver
 * @returns Driver object if successful, otherwise token-string
 * @type object
 */
EasyCab.prototype.getDriverNameFromToken = function(token) {
	if (this.database && this.database.drivers && this.database.drivers[token]) {
		return this.database.drivers[token];
	}
	return token;
}

/**
 * Loads a phone object by MAC-address
 * @param {String} mac_addr MAC-address of the phone
 * @returns Phone object if successful, otherwise token-string
 * @type object
 */
EasyCab.prototype.getPhoneNumberFromMac = function(mac_addr) {
	if (this.database && this.database.phones && this.database.phones[mac_addr]) {
		return this.database.phones[mac_addr].number;
	}
	return mac_addr;
}

/**
 * AES String decryption
 * @param {String} encrypted string
 * @returns Decrypted string
 * @type string
 */
EasyCab.prototype.decrypt = function(encrypted) {

    var ciphertext = CryptoJS.enc.Base64.parse(encrypted);

    // split iv and ciphertext
    var iv = ciphertext.clone();
    iv.sigBytes = 16;
    iv.clamp();
    ciphertext.words.splice(0, 4); // delete 4 words = 16 bytes
    ciphertext.sigBytes -= 16;

    var key = CryptoJS.enc.Utf8.parse(EasyCabUtil.config.encryption_key);

    // decryption
    var decrypted = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
      iv: iv,
      mode: CryptoJS.mode.CFB
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
}

// Instanciate EasyCab object
var easyCab = new EasyCab();