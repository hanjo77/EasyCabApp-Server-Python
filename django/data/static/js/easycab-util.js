/*!
 * easycab-util.js v1.0
 * Global settings and Static functions used within the EasyCab Application
 */

 var EasyCabUtil = {
	// djangoRootPath: "http://46.101.17.239/data",
	djangoRootPath: "http://localhost:8000",
	// adminRootPath: "http://46.101.17.239/data/admin",
	adminRootPath: "http://localhost:8000/admin",
	mqttUrl: "46.101.17.239", // Host / IP for MQTT connection
	mqttPort: 10001, // Port for MQTT connection
	inactiveTimeout: 60, // Timeout in seconds after last measurement when taxi turns inactive
	// Converts a UTC-Time string to format "DD.MM.YYYY HH:mm:ss"
	formatDateTime: function(timeString) {
		var date = this.parseDateTimeString(timeString);
		return ('0' + date.getDate()).slice(-2) + '.'
			+ ('0' + (date.getMonth()+1)).slice(-2) + '.'
			+ date.getFullYear() + " "
			+ ('0' + date.getHours()).slice(-2) + ':'
			+ ('0' + date.getMinutes()).slice(-2) + ':'
			+ ('0' + date.getSeconds()).slice(-2);
	},
	// Returns a date object from a UTC-Time string
	parseDateTimeString: function(timeString) {
		var dateArray = timeString.split(/[\s,T,\-,\.,\:]/);
		return new Date(
			parseInt(dateArray[0], 10), 
			parseInt(dateArray[1], 10)-1, 
			parseInt(dateArray[2], 10), 
			parseInt(dateArray[3], 10), 
			parseInt(dateArray[4], 10), 
			parseInt(dateArray[5], 0)
			);
	},
	// Initializes DateTime picker inside a container defined by its CSS-selector
	initDateTimePicker: function(selector) {
		$(selector + ' .time').timepicker({
	        'timeFormat': 'H:i:s'
	    });

	    $(selector + ' .date').datepicker({
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
				$(".to_date").datepicker("option", "minDate", selectedDate);
				return $(".to_date").datepicker("show");
			}		    
		});

	}
}