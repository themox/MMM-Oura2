#!/usr/bin/env node

module.exports = {
  getOuraData
};

const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "oura_auth.json");

function loadTokenFromFile() {
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  return tokens.access_token;
}

const _ = require("lodash");
const { DateTime } = require("luxon");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const OURA_BASE = "https://api.ouraring.com/v2/usercollection";

async function getOuraData(config) {
  const activity = config.activity || "all";
  const today = DateTime.now();

  let startDateObj;

  if (config.unit === "months") {
    startDateObj = today.minus({ months: config.interval });
  } else if (config.unit === "weeks") {
    startDateObj = today.minus({ days: config.interval * 7 });
  } else {
    startDateObj = today.minus({ days: config.interval });
  }

  const startDate = startDateObj.toFormat("yyyy-MM-dd");
  const endDate = today.toFormat("yyyy-MM-dd");

  let rows;

  if (activity === "heartrate") {
    rows = await getHRData(startDate, endDate, config.token);
  } else if (activity === "sleep") {
    rows = await getSleepDataV2("sleep", startDate, endDate, config.token);
  } else if (activity === "all") {
    rows = await getAllData(startDate, endDate, config.token);
  } else {
    rows = await getDailyDataV2(activity, startDate, endDate, config.token);
  }

  return rowsToColumns(rows);
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function fillMissing(row) {
  return _.mapValues(row, v => v ?? 0);
}

function rowsToColumns(rows, indexKey = "day") {
  const out = {};

  for (const row of rows) {
    const idx = row[indexKey];

    for (const [key, value] of Object.entries(row)) {
      if (key === indexKey) continue;

      if (!out[key]) out[key] = {};
      out[key][idx] = value ?? 0;
    }
  }

  return out;
}

async function getHttpResponse(page, startDate, endDate, token) {
  const url =
    `${OURA_BASE}/${page}?` +
    new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

  const resp = await fetch(url, {
    headers: authHeaders(token),
  });

  if (!resp.ok) {
    throw new Error(
      `HTTP ${resp.status}: ${await resp.text()}`
    );
  }

  return await resp.json();
}

async function getHRData(startDate, endDate, token) {
  const url = `${OURA_BASE}/heartrate`;

  const startDatetime = `${startDate}T00:00:00-04:00`;
  const endDatetime = `${endDate}T23:59:59-04:00`;

  let nextToken = null;
  let rows = [];

  do {
    const params = {
      start_datetime: startDatetime,
      end_datetime: endDatetime,
    };

    if (nextToken) params.next_token = nextToken;

    const resp = await fetch(
    `${url}?${new URLSearchParams(params)}`,
      {
        headers: authHeaders(token),
      }
    );

    if (!resp.ok) {
      throw new Error(
        `HTTP ${resp.status}: ${await resp.text()}`
      );
    }

    const response = await resp.json();

    rows.push(...(response.data || []));
    nextToken = response.next_token;
  } while (nextToken);

  const grouped = _.groupBy(rows, row =>
    DateTime.fromISO(row.timestamp).toFormat("yyyy-MM-dd")
  );

  return Object.entries(grouped).map(([day, dayRows]) => {
    const bpm = dayRows.map(r => r.bpm).filter(_.isFinite);

    return fillMissing({
      day,
      hr_mean_bpm: _.mean(bpm),
      hr_max_bpm: _.max(bpm),
      hr_min_bpm: _.min(bpm),
    });
  });
}

async function getDailyDataV2(dataType, startDate, endDate, token) {
  const okTypes = ["activity", "workouts", "readiness"];
  if (!okTypes.includes(dataType)) return null;

  let url;
  let dropColumns = [];

  if (dataType === "activity") {
    url = "daily_activity";
    dropColumns = [
      "class_5_min",
      "average_met_minutes",
      "contributors",
      "equivalent_walking_distance",
      "high_activity_met_minutes",
      "high_activity_time",
      "inactivity_alerts",
      "low_activity_met_minutes",
      "low_activity_time",
      "medium_activity_met_minutes",
      "medium_activity_time",
      "meters_to_target",
      "non_wear_time",
      "resting_time",
      "sedentary_met_minutes",
      "sedentary_time",
      "target_calories",
      "target_meters",
      "timestamp",
      "met",
      "id",
    ];
  } else if (dataType === "workouts") {
    url = "workout";
    dropColumns = [
      "end_datetime",
      "source",
      "start_datetime",
      "distance",
    ];
  } else if (dataType === "readiness") {
    url = "daily_readiness";
    dropColumns = [
      "id",
      "timestamp",
      "temperature_deviation",
      "contributors",
      "temperature_trend_deviation",
    ];
  }

  const response = await getHttpResponse(url, startDate, endDate, token);
  let rows = response.data || [];

  if (dataType === "workouts") {
    rows = rows.map(row => ({
      ...row,
      duration:
        DateTime.fromISO(row.end_datetime).toMillis() -
        DateTime.fromISO(row.start_datetime).toMillis(),
    }));
  }

  if (dataType === "readiness") {
    rows = rows.map(row => ({
      ...row,
      ...(row.contributors || {}),
    }));
  }

  return rows.map(row => {
    const out = {};

    for (const [key, value] of Object.entries(row)) {
      if (dropColumns.includes(key)) continue;

      if (key === "day") {
        out.day = value;
      } else {
        const newKey = key.includes(dataType)
          ? key
          : `${dataType}_${key}`;

        out[newKey] = value ?? 0;
      }
    }

    return fillMissing(out);
  });
}

async function getSleepDataV2(dataType, startDate, endDate, token) {
  if (dataType !== "sleep") return null;

  const dailySleepResp = await getHttpResponse(
    "daily_sleep",
    startDate,
    endDate,
    token
  );

  const sleepResp = await getHttpResponse(
    "sleep",
    startDate,
    endDate,
    token
  );

  const dailySleep = (dailySleepResp.data.data || []).map(row =>
    _.omit(row, ["id", "contributors", "timestamp"])
  );

  const sleep = (sleepResp.data.data || [])
    .filter(row => row.type === "long_sleep")
    .map(row =>
      _.omit(row, [
        "id",
        "sleep_algorithm_version",
        "time_in_bed",
        "heart_rate",
        "deep_sleep_duration",
        "rem_sleep_duration",
        "restless_periods",
        "sleep_phase_5_min",
        "movement_30_sec",
        "readiness_score_delta",
        "sleep_score_delta",
        "light_sleep_duration",
        "low_battery_alert",
        "period",
        "readiness",
        "bedtime_end",
        "bedtime_start",
        "hrv",
        "type",
      ])
    );

  const sleepByDay = _.keyBy(sleep, "day");

  return dailySleep
    .map(row => ({
      ...row,
      ...(sleepByDay[row.day] || {}),
    }))
    .map(row => {
      const out = {};

      for (const [key, value] of Object.entries(row)) {
        if (key === "day") {
          out.day = value;
        } else if (key === "latency") {
          out.sleep_onset_latency = value / 60;
        } else if (key === "total_sleep_duration") {
          out.sleep_duration = value / 60;
        } else {
          const newKey = key.includes("sleep")
            ? key
            : `sleep_${key}`;

          out[newKey] = value ?? 0;
        }
      }

      return fillMissing(out);
    });
}

function outerMergeByDay(...datasets) {
  const merged = {};

  for (const rows of datasets) {
    for (const row of rows || []) {
      if (!merged[row.day]) merged[row.day] = { day: row.day };
      Object.assign(merged[row.day], row);
    }
  }

  const allKeys = _.uniq(
    Object.values(merged).flatMap(row => Object.keys(row))
  );

  return Object.values(merged)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(row => {
      const filled = {};

      for (const key of allKeys) {
        filled[key] = key === "day" ? row.day : row[key] ?? 0;
      }

      return filled;
    });
}

async function getAllData(startDate, endDate, token) {
  const activity = await getDailyDataV2(
    "activity",
    startDate,
    endDate,
    token
  );

  const heartrate = await getHRData(startDate, endDate, token);

  const sleep = await getSleepDataV2(
    "sleep",
    startDate,
    endDate,
    token
  );

  const readiness = await getDailyDataV2(
    "readiness",
    startDate,
    endDate,
    token
  );

  return outerMergeByDay(activity, heartrate, sleep, readiness);
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("token", {
      type: "string",
      demandOption: false,
      describe: "Oura personal access token",
    })
    .option("interval", {
      type: "number",
      demandOption: true,
      describe: "Number of units to query",
    })
    .option("unit", {
      type: "string",
      demandOption: true,
      describe: "One of: months, weeks, days",
    })
    .option("activity", {
      type: "string",
      demandOption: true,
      describe: "One of: activity, sleep, readiness, heartrate, all",
    })
    .help()
    .argv;

  const activities = [
    "activity",
    "heartrate",
    "sleep",
    "readiness",
    "all",
  ];

  if (!activities.includes(argv.activity)) {
    console.error("Invalid arguments.");
    process.exit(1);
  }

  const token = argv.token || loadTokenFromFile();

  const today = DateTime.now();

  let startDateObj;

  if (argv.unit === "months") {
    startDateObj = today.minus({ months: argv.interval });
  } else if (argv.unit === "weeks") {
    startDateObj = today.minus({ days: argv.interval * 7 });
  } else {
    startDateObj = today.minus({ days: argv.interval });
  }

  const startDate = startDateObj.toFormat("yyyy-MM-dd");
  const endDate = today.toFormat("yyyy-MM-dd");

  let rows;

  if (argv.activity === "heartrate") {
    rows = await getHRData(startDate, endDate, token);
  } else if (argv.activity === "sleep") {
    rows = await getSleepDataV2(
      "sleep",
      startDate,
      endDate,
      token
    );
  } else if (argv.activity === "all") {
    rows = await getAllData(startDate, endDate, token);
  } else {
    rows = await getDailyDataV2(
      argv.activity,
      startDate,
      endDate,
      token
    );
  }

  console.log(JSON.stringify(rowsToColumns(rows)));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.response?.data || err.message || err);
    process.exit(1);
  });
}
