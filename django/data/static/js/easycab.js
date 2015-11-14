var EasyCab = function() {

	// this.djangoRootPath = "http://46.101.17.239/data";
	this.djangoRootPath = "http://localhost:8000";
	this.map = null;
	this.directionsService = new google.maps.DirectionsService();
	this.directionsDisplay = new google.maps.DirectionsRenderer();
	this.inactiveTimeout = 60;
	this.activeMarker = null;
	this.markers = {};
	this.goalMarker = {};
	this.timeouts = {};
	this.database = {};
	this.path;
	var markerParameters = "?text_size=46" +
						"&text_y=19";
	this.pathMarkerUrl = this.djangoRootPath + "/map_marker/img/marker-template-path-large.png" + markerParameters + "&text_colour=315aa6&text="
	this.activeMarkerUrl = this.djangoRootPath + "/map_marker/img/marker-template-active-large.png" + markerParameters + "&text_colour=315aa6&text="
	this.inactiveMarkerUrl = this.djangoRootPath + "/map_marker/img/marker-template-inactive-large.png" + markerParameters + "&text_colour=f8d360&text="
	this.client = new Paho.MQTT.Client("46.101.17.239", 10001,
		"myclientid_" + parseInt(Math.random() * 100, 10)); 
	this.directionsService = new google.maps.DirectionsService();
	this.directionsDisplay = new google.maps.DirectionsRenderer({ 
		suppressMarkers: true,
		suppressInfoWindows: true,
		polylineOptions: {
			strokeColor: '#f8d360',
			strokeWeight: 5
		}
	});
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
		easyCab.initMenu();
		$(window).resize(function() {
			easyCab.updateSize();
		});
	});
}

EasyCab.prototype.initMenu = function() {
	$.ajax({
        url: easyCab.djangoRootPath + "/menu",
        success: function( data ) {
        	$('#accordion').html(data);
        	$('#accordion').accordion();
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
        },
        error: function( data ) {
        	easyCab.initMenu();
        }
    });
	$(".displayFilter").change(function(event) {
		eval("easyCab." + $(event.target).val() + "()");
	});
}

EasyCab.prototype.hidePath = function() {
	$('.dateRow').hide();
	if (this.path) {
		this.path.setMap(null);
	}
}

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

EasyCab.prototype.refreshAccordion = function(parentSelector) {
	if (parentSelector && (parentSelector != "")) {
		parentSelector += " ";
	}

	$(parentSelector + '.pathForm .time').timepicker({
        'timeFormat': 'H:i:s'
    });

    $(parentSelector + '.pathForm .date').datepicker({
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
			// $(this).parent().find(".time").trigger("click");
			$(".to_date").datepicker("option", "minDate", selectedDate);
			return $(".to_date").datepicker("show");
			}		    
		});

    $(parentSelector + '.dateRow').hide();

    $(parentSelector + '.showPath').change(function(event) {
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
	        url: easyCab.djangoRootPath + "/path/" + startTime + "/" + endTime + "/" + taxiId,
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

	$("h3" + parentSelector).click(function(event) {
		var $target = $(event.target);
		var $container = $target.next();
		if ($target.hasClass("ui-state-active")) {
			var targetId = $target.attr("data-key");
			if (easyCab.markers[targetId]) {
				new google.maps.event.trigger(easyCab.markers[targetId], 'click');
			}
		}
		else {
			easyCab.activeMarker = null;
			var $activeContainer = $('h3.ui-state-active').next();
			var $showPath = $activeContainer.find('.showPath input');
			if ($showPath[0].checked) {
				$showPath.trigger('click');
			}
			easyCab.fitMapToMarkers();
		}
	});

	$(parentSelector + ".showRoute a").click(function(event) {
		var $target = $(event.target);
		var $container = $target.parents(".ui-accordion-content");
		var start = new google.maps.LatLng(
			parseFloat($container.find('span[data-key="gps.latitude"]').text()),
			parseFloat($container.find('span[data-key="gps.longitude"]').text())
		);
		var end = $("#endPoint").val();
		if (end == "") {
			end = $("#startPoint").val();
		}
		if (start && end != "") {
			easyCab.drawRoute(start, end, $container.attr("data-name"));
		}
	});
}

EasyCab.prototype.showAll = function() {
	for (var key in this.markers) {
		var $header = $("h3.car"+this.database.taxis[key]);
		$(".car"+this.database.taxis[key]).show();
		this.markers[key].setMap(this.map);
	}
}

EasyCab.prototype.showActive = function() {
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
}

EasyCab.prototype.showInactive = function() {
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
}

EasyCab.prototype.addMarker = function(lat, lng, info) {
	var data = jQuery.parseJSON(info);
	var pt = new google.maps.LatLng(lat, lng);

	if (data.car && this.database.taxis && this.database.taxis[data.car]) {

		var icon = new google.maps.MarkerImage(this.activeMarkerUrl + this.database.taxis[data.car],
				   new google.maps.Size(120, 48), new google.maps.Point(0, 0),
				   new google.maps.Point(60, 48));

		if (!data.time || (new Date()-this.parseDateTimeString(data.time) > this.inactiveTimeout*1000)) {
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
			        url: this.djangoRootPath + "/menu/" + data.car,
			        success: function( data ) {
			            $('#accordion').append(data);
			            $("h3").click(function(event) {
							var $target = $(event.target);
							if ($target.hasClass("ui-state-active")) {
								var targetId = $target.attr("data-key");
								if (easyCab.markers[targetId]) {
									new google.maps.event.trigger(easyCab.markers[targetId], 'click');
								}
							}
							else {
								easyCab.activeMarker = null;
								easyCab.fitMapToMarkers();
							}
						});
			        }
			    });			
			}

			var elem = $('#accordion').find('h3, div').sort(this.sortByTagAndClass);			

			google.maps.event.addListener(marker, "click", function() {
				var index = Math.floor(parseInt($(".car" + easyCab.database.taxis[data.car]).attr("id").replace("ui-id-", ""), 10) / 2);
			    $("#accordion").accordion({ active: index });
				easyCab.map.setCenter(new google.maps.LatLng(
					parseFloat($(".car" + easyCab.database.taxis[data.car] + " *[data-key='gps.latitude']").html()),
					parseFloat($(".car" + easyCab.database.taxis[data.car] + " *[data-key='gps.longitude']").html())));
				easyCab.map.setZoom(16);
				easyCab.activeMarker = data.car;
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

		$(".car" + this.database.taxis[data.car] + " *[data-key='time']").html(this.formatDateTime(data.time));
		$(".car" + this.database.taxis[data.car] + " *[data-key='driver']").html(this.getDriverNameFromToken(data.driver));
		$(".car" + this.database.taxis[data.car] + " *[data-key='phone']").html(this.getPhoneNumberFromMac(data.phone));
		$(".car" + this.database.taxis[data.car] + " *[data-key='gps.latitude']").html(data.gps.latitude);
		$(".car" + this.database.taxis[data.car] + " *[data-key='gps.longitude']").html(data.gps.longitude);
		$('h3.car' + this.database.taxis[data.car]).addClass("active");
	}

	$("*[data-key='driver']").each(function(index, object) {
		if ($.trim($(object).html()) == "") {
			$.ajax({
		        url: easyCab.djangoRootPath + "/drivers",
		        success: function( data ) {
		            $(object).html(data);
		            $(".driver select").change(function(event) {
		            	var oldId = $(event.target).parent().attr("data-id");
		            	var id = $(event.target).val();
		            	var driverName = event.target.options[event.target.selectedIndex].innerHTML;
		            	if (id != "" && window.confirm("Wollen Sie wirklich den Fahrer auf " + driverName + " ändern?")) {	            		
			            	var taxi = $(event.target).parent().parent().parent().parent().parent().prev().attr("data-key");
			            	$.ajax({ url: easyCab.djangoRootPath + "/driver_change/" + taxi + "/" + id });
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
	this.refreshAccordion(".car" + this.database.taxis[data.car]);
};

EasyCab.prototype.placeMarkers = function() {
	for (var marker in this.markers) {
		this.markers[marker].setMap(this.map);
	}
}

EasyCab.prototype.sortByTagAndClass = function(a, b) {
    return (a.className < b.className || a.tagName > b.tagName);
}

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

	$("body").append('<a href="#" class="btn" id="resetView">Reset</a>');
	$("#resetView").click(function(event) {
		easyCab.fitMapToMarkers();
		easyCab.activeMarker = null;
		event.preventDefault();
	});
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
/*		var name = result.formatted_address.substring(0, result.formatted_address.indexOf(","));
		if (name.length > 13) {
			name = name.substring(0, 10) + "...";
		}*/
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
	});
}

EasyCab.prototype.drawRoute = function(start, end, taxi) {
	var request = {
		origin:start,
		destination:end,
		travelMode: google.maps.TravelMode.DRIVING,

	};
	easyCab.directionsService.route(request, function(result, status) {
		if (status == google.maps.DirectionsStatus.OK) {
			easyCab.directionsDisplay.setDirections(result);
			$routeWindow = $("#routeWindow");
			// $('#routeWindowHeader .start').text(taxi ? taxi : start.substring(0, start.indexOf(',')));
			// $('#routeWindowHeader .end').text(end.substring(0, end.indexOf(',')));
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
		url: this.djangoRootPath + "/json_data"
	})
	.done(function( data ) {
		easyCab.database = $.parseJSON(data);
	})
	.error(function( data ) {
		easyCab.getDatabase();
	});
}

EasyCab.prototype.getDriverNameFromToken = function(token) {
	if (this.database && this.database.drivers && this.database.drivers[token]) {
		return this.database.drivers[token];
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