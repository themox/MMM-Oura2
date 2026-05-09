var NodeHelper = require("node_helper");
const { getOuraData } = require("./oura_data.js");

module.exports = NodeHelper.create({

    start: function() {
        console.log("Starting node helper for: " + this.name);

    },

    socketNotificationReceived: function(notification, payload) {

        if (notification === "REQUEST_UPDATE") {
		console.log("MMM-Oura: got update request.");
	        this.getOura(payload);

		} else if (notification === "MODULE_READY") {
			this.getOura(payload);
		} else if (notification ==="UPDATE_CHART") {
			console.log("got chart update in wrong place... :(");
		}

    },


	getOura: async function(config) {
		try {
			const ouradata = await getOuraData(config);
			this.sendSocketNotification("UPDATE_CHART", ouradata);
		} catch (err) {
			console.log("MMM-Oura2: Oura fetch error");
			console.log(err.response?.data || err.message || err);
		}
	},
});
