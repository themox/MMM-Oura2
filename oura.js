
// normally get these from the config.js

//    ./oura.py -activity="all" -interval=3 -token="HT25TUPZEPSLGL6L52X7VZF34BIQ5SZ6" -unit="weeks"

getOura();

function getOura() {
    const spawn = require("child_process").spawn;

    const child = spawn("python3", ["python/oura.py -activity="+activity+" -interval="+interval+" -token="+token +" -unit=" + unit], {shell: true});


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

    child.stdout.on('data', function(data) {
        ouradata = JSON.parse(data);
        processOura(ouradata, chart_columns, chartTitle);
    });
    
    child.on('close', function(code) {
        console.log('Child process exited with exit code '+code);    
    });
}

// Takes a series of date labels in the format YYYY-MM-DD and coverts to be somewhat abbreviated.
function processLabels(labels) {
    //console.log("labels length: " + labels.length);

    for (let i = 0; i < labels.length; i++) {
        label = "";
        label_array = labels[i].split("-");

        if (i == 0) {
            //label += label_array[0] + "/" + label_array[1] + "/"; // Do we want year for this chart?
            label += parseInt(label_array[1]) + "/";
        }

        if (label_array[2] == "01" && i > 0) {
            // Only display month on first day of the month to simplify chart legend
            label +=  parseInt(label_array[1]) + "/";
        }

        label += parseInt(label_array[2]);

        labels[i] = label;

    }

    return labels;
}

function buildColorStr(colNum, pal) {

    var palette = [
        "rgba(0, 0, 255, .8)",       // blue 
        "rgba(255, 51, 51, .8)",     // red
        "rgba(0, 153, 153, .8)",     // green
        "rgba(255, 204, 153, .8)",   // salmonish
        "rgba(192, 192, 192, .8)",   // gray
        "rgba(0, 76, 153, .8)",      // dark blue
        "rgba(102, 102, 0, .8)",     // yellow
        "rgba(204, 153, 255, .8)",   // purplish
        "rgba(0, 204, 204, .8)",   // teal

    ];

    // colNum is 1-indexed
    var ind = ((colNum - 1) + (pal * 3)) % palette.length;

    return palette[ind];
}

function processOura(ouradata, columns, maxYAxis) {


    var shape_opts = ["circle", "rectRounded", "rectRot", "triangle"];

    var hasBorder = true;

    if (hasBorder) {
        border = "solid";
    } else {
        border = "none";
    }

    var ch = "<div style = \"width: 600px; background-color: black; color: white; border-style: " + border + "; border-width: 1px; border-color: #BBBBBB; border-radius: 5px;\" id=\"oura\">\n";
    ch += "<script src=\"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.8.0/chart.min.js\"></script>\n";
    ch += "<canvas id=\"myChart\" style=\"padding: 10px;\"></canvas>\n";
    ch += "<script>\n";
    ch += "const ctx = document.getElementById('myChart');\n";
    ch += "Chart.defaults.font.size = 12;\n";
    ch += "Chart.defaults.font.family = \"Roboto Condensed\";\n";
    ch += "const myChart = new Chart(ctx, {\n";
    ch += "\ttype: 'line',\n";
    ch += "\tdata: {\n";

    var labelstr = "\t\tlabels: ";
    var hasLabels = false;
    var datasets = "\n\t\tdatasets: [\n";
    var datastr = "";

    var numColumns = columns.length;
    var colNum = 0;

    // configurable options
    var palette = 2;
    var lineWeight = 1;
    var dotWeight = 3;
    var charttitle = "Oura HR Data";
    var chartTextColor = "white";
    var chartGridColor = "rgba(50, 50, 50, .8)";
    var maxYAxis = 100;
    var hasMax = false;
    var chartYLabel = "BPM";


    // source 
    // https://www.concept2.com/indoor-rowers/training/tips-and-general-info/training-heart-rate-range
    var age = 43;
    var maxhr = 205.8 - (0.685 * age); 

    for (column in ouradata) {

        if (!columns.includes(column)) {
            // Only pick up the columns we want
            continue;
        }

        colNum ++;

        data = [];
        labels = [];

        for (key in ouradata[column]) {

            if (!hasLabels) {
                labels.push(key);
            }

            data.push(ouradata[column][key]);
        }

        if (!hasLabels) {
            let newLabels = processLabels(labels);
            labelstr += "[";
            for (item in newLabels) {
                labelstr += "\"" + newLabels[item] + "\", ";
            }
            labelstr += "],";

            hasLabels = true;
        }

        datastr = "\t\t\tdata: [";
        colorstr = "\t\t\tborderColor: [\n";
        for (item in data) {
            if (data[item] == 0) {
                datastr += " , "; // put a null value in the data set so the chart doesn't try to graph 0's
            } else {
                datastr += data[item].toString() + ", ";
            }

            colorstr += "\t\t\t\t'" + buildColorStr(colNum, palette) + "',\n";
        }
        datastr += "],\n";
        colorstr += "\t\t\t],\n";

        // buid dataset string

        datasets += "\t\t{\n";
        datasets += "\t\t\tlabel: '" + column + "',\n";
        datasets += datastr;
        datasets += "\t\t\tborderWidth: " + lineWeight + ",\n";
        datasets += colorstr;

        // automate shapes based on choices; rotate through options
        shp = colNum % shape_opts.length;
        shape_sel = shape_opts[shp];

        datasets += "\t\t\tpointStyle: '" + shape_sel + "',\n";
        datasets += "\t\t\tpointRadius: " + dotWeight + ",\n";
        datasets += "\t\t\tpointBackgroundColor: '" + buildColorStr(colNum, palette) + "',\n";

        datasets += "\t\t},\n";
    }
    datasets += "\t\t],\n";

    ch += labelstr + datasets;

    ch += "\t},\n";
    ch += "options: {\n";

    // scales
    ch += "\tscales: {\n";
    
    // y scale
    ch += "\t\ty: {\n";
    ch += "\t\t\tbeginAtZero: false,\n";

    if (hasMax) {
        ch += "\t\t\tmax: " + maxYAxis + ",\n";
    }

    ch += "\t\t\ttitle: {\n";
    ch += "\t\t\t\t\ttext: '" + chartYLabel + "',\n";
    ch += "\t\t\t\t\tdisplay: true,\n";
    ch += "\t\t\t\t\tcolor: '" + chartTextColor + "',\n";
    ch += "\t\t\t\t},\n";

    ch += "\t\t\t\tticks: {\n";
    ch += "\t\t\t\t\tcolor: '" + chartTextColor + "',\n";
    ch += "\t\t\t\t},\n";

    ch += "\t\t\t\tgrid: {\n";
    ch += "\t\t\t\t\tcolor: '" + chartGridColor + "',\n";
    ch += "\t\t\t\t},\n";

    ch += "\t\t},\n"; // end y

    // x scale
    ch += "\t\tx: {\n";
    
    ch += "\t\t\tticks: {\n";
    ch += "\t\t\t\tcolor: '" + chartTextColor + "',\n";
    ch += "\t\t\t},\n";
    
    ch += "\t\t\tgrid: {\n";
    ch += "\t\t\t\tcolor: '" + chartGridColor + "',\n";
    ch += "\t\t\t},\n";
    
    ch += "\t\t},\n"; // end x

    ch += "\t},\n";

    // plugins
    ch += "\tplugins: {\n";
    
    // Legend
    ch += "\t\tlegend: {\n";
    ch += "\t\t\tlabels: {\n";
    ch += "\t\t\t\tusePointStyle: true,\n";
    ch += "\t\t\t\tcolor: '" + chartTextColor + "',\n";
    ch += "\t\t\t},\n";
    ch += "\t\t\tposition: 'bottom',\n";
    ch += "\t\t},\n";

    // Title
    ch += "\t\ttitle: {\n";
    ch += "\t\t\tdisplay: true,\n";
    ch += "\t\t\tcolor: '" + chartTextColor + "',\n";
    ch += "\t\t\ttext: '" + charttitle +  "',\n";
    ch += "\t\t\tpadding: {\n";
    ch += "\t\t\t\ttop: 0,\n";
    ch += "\t\t\t\tbottom: 10,\n";
    ch += "\t\t\t}\n";
    ch += "\t\t},\n";

    ch += "\t}\n";

    // End of section
    ch += "}\n";
    ch += "});\n";
    ch += "</script>\n";
    ch += "</div>\n";

    console.log(ch);
}
