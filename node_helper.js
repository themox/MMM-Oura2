var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({

    start: function() {
        console.log("Starting node helper for: " + this.name);

    },

    socketNotificationReceived: function(notification, payload) {

        if (notification === "REQUEST_UPDATE") {
		console.log("MMM-Oura: got update request.");
	        this.getOura(payload);
		//this.sendNotification("UPDATE_CHART", "bunnies.");

	} else if (notification === "MODULE_READY") {
		this.getOura(payload);
	} else if (notification ==="UPDATE_CHART") {
		console.log("got chart update in wrong place... :(");
	}

    },


    getOura: function(config) {
	var self = this;

	// send as socket notification back to oura module with payload of oura data.

	const spawn = require("child_process").spawn;

	activity =  "all"; // @TODO: fix this to be configurable so we only get the actual data we want.  May need to modify the python file.
	interval = config.interval;
	unit = config.unit;
	token = config.token;

	console.log("activity:" + activity + " interval: " + interval + " unit: " + unit + " toke:n " + token + "\n");


        const child = spawn("python3", [__dirname + "/python/oura.py -activity="+activity+" -interval="+interval+" -token="+token +" -unit=" + unit], {shell: true});

	/*
	chart_columns = ["activity_score", "activity_active_calories","activity_steps", "activity_total_calories",
	    "hr_mean_bpm", "hr_max_bpm", "hr_min_bpm", "sleep_duration", "sleep_efficiency", "sleep_onset_latency", "sleep_score", 
	    "readiness_score", "readiness_score_hrv_balance", "readiness_score_recovery_index"];

	["sleep_efficiency", "activity_score", "hr_mean_bpm"]);
	*/

	// ["hr_min_bpm", "hr_max_bpm", "hr_mean_bpm"]; // Heartrate graph, roughly 0-200, y = bpm
	// ["activity_score", "sleep_score", "readiness_score"]; // overall score graph, roughly 0-100, y = score
	// @TODO add sleep chart

	chart_columns = ["activity_score", "sleep_score", "readiness_score"];
	chartTitle = "Overall Readiness";

	// chart_colu;mns = ["hr_min_bpm", "hr_max_bpm", "hr_mean_bpm"];
	// chartTitle = "Heart Rate Data";

	child.stdout.on('data', function(res) {
		ouradata = JSON.parse(res);
	        self.sendSocketNotification("UPDATE_CHART", ouradata);
		console.log("got data! " + self.name);
	});

	child.stderr.on('data', function(data) {
		console.log("got python error?");
		console.log(data);
	});

	child.on('close', function(code) {
		// @TODO: is this necessary?
        	console.log('MMM-Oura2 module, oura.py process exited with exit code '+code);
	});

    },
});
